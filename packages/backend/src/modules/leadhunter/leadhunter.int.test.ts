import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { SignJWT } from 'jose';
import { parse } from 'csv-parse/sync';
import { gzipSync } from 'node:zlib';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import { errorHandler } from '../../shared/middleware/errorHandler';
import { hasTestDb, makeTenant, makeUser, migrateTestDb, resetLeadHunter } from '../../test/db';
import { mapsSearchKey, validateCampaign, type CampaignConfig, type CompanyData } from './domain';
import { runCampaign } from './engine';
import { createProviders, type Settings } from './providers';
import * as store from './store';
import { sendCompaniesToContacts } from './contacts';
import { createCampaignChecked } from './leadhunter.service';
import leadhunterRoutes from './leadhunter.routes';

// A API é exercitada de ponta a ponta (guardas, Zod, errorHandler) por um servidor Express em porta
// efêmera de loopback e `fetch` nativo: sem supertest e sem dependência nova. Nenhuma rede externa.

const state = vi.hoisted(() => ({
  settings: { dataforseo: null, jevKey: null, jevModel: 'jev-1.13.0', runLimit: 80, dailyLimit: 200, cacheDays: 30 } as Settings,
}));
vi.mock('./providers', async (original) => ({
  ...(await original<typeof import('./providers')>()),
  loadSettings: () => state.settings,
}));

const BASE_SETTINGS: Settings = { ...state.settings };
const LIVE_SETTINGS: Settings = { ...BASE_SETTINGS, dataforseo: { login: 'l', password: 'p' } };

interface Actor {
  id: string;
  tenantId: string;
  role: 'admin' | 'manager' | 'seller';
}

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const sign = (actor: Actor) =>
  new SignJWT({ tenantId: actor.tenantId, role: actor.role, email: 'x@teste.local' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(actor.id)
    .setExpirationTime('5m')
    .sign(secret);

const config = (extra: Record<string, unknown> = {}): CampaignConfig =>
  validateCampaign({ niche: 'Loja de moda feminina', city: 'São Carlos,São Paulo,Brazil', source: 'demo', limit: 10, ...extra });

const lead = (extra: Partial<CompanyData> = {}): Partial<CompanyData> => ({
  name: 'Loja A',
  category: 'Moda feminina',
  city: 'São Carlos',
  address: 'Rua Teste 1',
  phone: null,
  website: null,
  reviews: null,
  rating: null,
  ...extra,
});

const NEW_CAMPAIGN = { niche: 'Loja de moda feminina', city: 'São Carlos,São Paulo,Brazil' };

describe.skipIf(!hasTestDb)('API do LeadHunter', () => {
  let server: Server;
  let url: string;
  let tenant: string;
  let admin: Actor;
  let manager: Actor;
  let seller: Actor;
  let adminB: Actor; // workspace sem a flag
  let adminC: Actor; // outro workspace com a flag

  const actorFor = async (tenantId: string, role: Actor['role']): Promise<Actor> => ({
    id: await makeUser(tenantId, role),
    tenantId,
    role,
  });

  async function api(actor: Actor | null, method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}) {
    const headers: Record<string, string> = { ...extraHeaders };
    if (actor) headers.Authorization = `Bearer ${await sign(actor)}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${url}/api/v1/leadhunter${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
    return { status: res.status, headers: res.headers, text, body: isJson ? JSON.parse(text) : null };
  }

  const csvRows = (text: string): string[][] => parse(text, { delimiter: ';', bom: true, relax_column_count: true }).slice(1);

  /** Importa um CSV, executa a campanha e devolve o id e as empresas já analisadas. */
  async function importedCampaign(names: string[], withPhone = true) {
    const csv = `Nome;Endereço;Categoria;Telefone\n${names.map((n, i) => `${n};Rua ${i};Moda;${withPhone ? `1699${i}` : ''}`).join('\n')}\n`;
    const res = await api(admin, 'POST', '/import', { config: NEW_CAMPAIGN, csv });
    expect(res.status).toBe(201);
    const id = res.body.data.id as string;
    await runCampaign(tenant, id, createProviders(state.settings), state.settings);
    return { id, companies: await store.companies(tenant, id) };
  }

  beforeAll(async () => {
    await migrateTestDb();
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/v1/leadhunter', leadhunterRoutes);
    app.use(errorHandler);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  beforeEach(async () => {
    state.settings = BASE_SETTINGS;
    await resetLeadHunter();
    tenant = await makeTenant({ leadhunterEnabled: true });
    admin = await actorFor(tenant, 'admin');
    manager = await actorFor(tenant, 'manager');
    seller = await actorFor(tenant, 'seller');
    const disabled = await makeTenant();
    adminB = await actorFor(disabled, 'admin');
    adminC = await actorFor(await makeTenant({ leadhunterEnabled: true }), 'admin');
  });
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.destroy();
  });

  describe('acesso', () => {
    it('rotas exigem admin: manager recebe 403', async () => {
      for (const actor of [manager, seller]) {
        const res = await api(actor, 'GET', '/status');
        expect(res.status).toBe(403);
      }
      expect((await api(admin, 'GET', '/status')).status).toBe(200);
    });

    it('workspace sem a flag recebe 404 mesmo para admin, antes da checagem de papel', async () => {
      expect((await api(adminB, 'GET', '/campaigns')).status).toBe(404);
      expect((await api(adminB, 'GET', '/campaigns')).body).toEqual({ error: 'Not found' });
      const managerB = await actorFor(adminB.tenantId, 'manager');
      expect((await api(managerB, 'GET', '/campaigns')).status).toBe(404);
    });

    it('sem token responde 401', async () => {
      expect((await api(null, 'GET', '/status')).status).toBe(401);
    });

    it('o status não expõe segredos', async () => {
      state.settings = { ...LIVE_SETTINGS, jevKey: 'segredo-jev' };
      const res = await api(admin, 'GET', '/status');
      expect(res.body.data).toEqual({
        dataforseo: true,
        jev: true,
        jevModel: 'jev-1.13.0',
        runLimit: 80,
        dailyLimit: 200,
        callsToday: 0,
        searchCacheDays: 30,
      });
      expect(res.text).not.toContain('segredo-jev');
      expect(res.text).not.toContain('"p"');
    });

    it('um workspace não alcança campanhas e empresas de outro', async () => {
      const id = await store.createCampaign(tenant, config());
      const companyId = await store.upsertCompany(tenant, id, lead(), 'import');
      expect((await api(adminC, 'GET', `/campaigns/${id}`)).status).toBe(404);
      expect((await api(adminC, 'GET', `/campaigns/${id}/export`)).status).toBe(404);
      expect((await api(adminC, 'POST', `/campaigns/${id}/cancel`)).status).toBe(404);
      expect((await api(adminC, 'POST', `/campaigns/${id}/contacts`, { ownerId: null })).status).toBe(404);
      expect((await api(adminC, 'GET', `/companies/${companyId}/history`)).status).toBe(404);
      expect((await api(adminC, 'PATCH', `/companies/${companyId}`, { stage: 'contacted' })).status).toBe(404);
      expect((await api(adminC, 'DELETE', `/companies/${companyId}`)).status).toBe(404);
      expect((await store.getCompany(tenant, companyId))?.stage).toBe('new');
      expect((await api(adminC, 'GET', '/campaigns')).body.data).toEqual([]);
    });
  });

  describe('ids e limites de entrada', () => {
    it('ids malformados respondem 422 antes de chegar ao banco', async () => {
      const uuid = '00000000-0000-4000-8000-000000000000';
      const cases: [string, string, unknown?][] = [
        ['GET', '/campaigns/not-a-uuid'],
        ['GET', '/campaigns/not-a-uuid/export'],
        ['POST', '/campaigns/x/cancel'],
        ['POST', '/campaigns/x/contacts', { ownerId: null }],
        ['POST', `/campaigns/${uuid}/contacts`, { ownerId: 'x' }],
        ['POST', `/campaigns/${uuid}/contacts`, { companyIds: ['x'], ownerId: null }],
        ['GET', '/companies/inexistente/history'],
        ['PATCH', '/companies/x', { stage: 'new' }],
        ['DELETE', '/companies/x'],
      ];
      for (const [method, path, body] of cases) {
        expect((await api(admin, method, path, body)).status, `${method} ${path}`).toBe(422);
      }
    });

    it('ownerId é obrigatório (pode ser null) ao criar contatos', async () => {
      const { id } = await importedCampaign(['Loja A']);
      const res = await api(admin, 'POST', `/campaigns/${id}/contacts`, {});
      expect(res.status).toBe(422);
      expect(res.body.details).toHaveProperty('ownerId');
      expect(await db('contacts').where({ tenant_id: tenant })).toHaveLength(0);
    });

    it('exportação recusa ids ruins (422)', async () => {
      const uuid = '00000000-0000-4000-8000-000000000000';
      const bad: unknown[] = [
        { companyIds: 'x' },
        { companyIds: [1] },
        { companyIds: ['x'] },
        { companyIds: Array(5001).fill(uuid) },
        { companyIds: { a: 1 } },
      ];
      for (const body of bad) {
        expect((await api(admin, 'POST', '/found-companies/export', body)).status, JSON.stringify(body).slice(0, 40)).toBe(422);
      }
    });

    it('corpo comprimido que incha acima de 1.000.000 bytes responde 413 mesmo com Content-Length pequeno', async () => {
      const raw = JSON.stringify({ config: NEW_CAMPAIGN, csv: 'x'.repeat(1_020_000) });
      const gzipped = gzipSync(raw);
      expect(gzipped.length).toBeLessThan(10_000);
      const res = await fetch(`${url}/api/v1/leadhunter/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await sign(admin)}`, 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
        body: gzipped,
      });
      expect(res.status).toBe(413);
      expect(await store.listCampaigns(tenant)).toEqual([]);
    });

    it('importação acima de 1 MB responde 413', async () => {
      const res = await api(admin, 'POST', '/import', { config: NEW_CAMPAIGN, csv: 'x'.repeat(1_000_100) });
      expect(res.status).toBe(413);
      expect(await store.listCampaigns(tenant)).toEqual([]);
    });
  });

  describe('campanhas', () => {
    it('jornada demo: criar, ler, filtrar, exportar, editar etapa e notas, excluir', async () => {
      const created = await api(admin, 'POST', '/campaigns', NEW_CAMPAIGN);
      expect(created.status).toBe(201);
      const id = created.body.data.id as string;
      expect((await store.getCampaign(tenant, id))?.createdBy).toBe(admin.id);
      await runCampaign(tenant, id, createProviders(state.settings), state.settings);

      const read = await api(admin, 'GET', `/campaigns/${id}`);
      expect(read.body.data.campaign.state).toBe('completed');
      expect(read.body.data.companies).toHaveLength(10);
      expect(read.body.data.usage).toEqual([]);
      expect(read.body.data.coverage).toHaveLength(1);
      const companyId = read.body.data.companies[0].id as string;

      const edit = await api(admin, 'PATCH', `/companies/${companyId}`, { stage: 'interested', notes: 'Conferir fonte' });
      expect(edit.status).toBe(200);
      expect(await store.getCompany(tenant, companyId)).toMatchObject({ stage: 'interested', notes: 'Conferir fonte' });

      const filtered = await api(admin, 'GET', `/campaigns/${id}?stage=interested`);
      expect(filtered.body.data.companies).toHaveLength(1);
      expect((await api(admin, 'GET', `/campaigns/${id}?q=nada-parecido`)).body.data.companies).toHaveLength(0);
      expect((await api(admin, 'GET', `/campaigns/${id}?priority=excluded`)).body.data.companies).toHaveLength(0);

      const exported = await api(admin, 'GET', `/campaigns/${id}/export?stage=interested`);
      expect(exported.headers.get('content-type')).toContain('text/csv; charset=utf-8');
      expect(exported.headers.get('content-disposition')).toBe(`attachment; filename="radar-demo-${id.slice(0, 8)}.csv"`);
      expect(csvRows(exported.text)).toHaveLength(1);

      expect((await api(admin, 'DELETE', `/companies/${companyId}`)).status).toBe(200);
      expect(await store.companies(tenant, id)).toHaveLength(9);
    });

    it('importação CSV cria campanha sem chamadas pagas', async () => {
      const payload = { config: NEW_CAMPAIGN, csv: 'Nome;Endereço\nLoja A;Rua 1\nLoja B;Rua 2\n' };
      const res = await api(admin, 'POST', '/import', payload);
      expect(res.status).toBe(201);
      const id = res.body.data.id as string;
      expect((await store.getCampaign(tenant, id))?.state).toBe('queued');
      await runCampaign(tenant, id, createProviders(state.settings), state.settings);
      expect(await store.companies(tenant, id)).toHaveLength(2);
      expect(await store.usage(tenant, id)).toEqual([]);

      const bad = await api(admin, 'POST', '/import', { ...payload, csv: 'Nome\nA\n' });
      expect(bad.status).toBe(400);
      expect(bad.body.error).toBe('O CSV precisa das colunas Nome e Endereço na primeira linha.');
      expect(await store.listCampaigns(tenant)).toHaveLength(1);
    });

    it('importação JSON guarda só os campos conhecidos da empresa', async () => {
      const res = await api(admin, 'POST', '/import', {
        config: NEW_CAMPAIGN,
        leads: [{ name: 'Loja J', address: 'Rua J', hack: { x: 1 }, stage: 'discarded', crm: { status: 'imported' } }],
      });
      expect(res.status).toBe(201);
      const [company] = await store.companies(tenant, res.body.data.id);
      expect(company).not.toHaveProperty('hack');
      expect(company).toMatchObject({ name: 'Loja J', stage: 'new', crm: null });
    });

    it('histórico acompanha a mesma empresa entre campanhas', async () => {
      const ids: string[] = [];
      for (const rank of [12, 5]) {
        const campaign = await store.createCampaign(tenant, config({ source: 'live' }));
        ids.push(
          await store.upsertCompany(tenant, campaign, lead({ placeId: 'p1' }), 'live', {
            query: 'moda', location: 'SC', rank, depth: 30, observedAt: new Date(2026, 0, rank).toISOString(), sourceUrl: null,
          }),
        );
      }
      expect(ids[0]).toBe(ids[1]);
      const res = await api(admin, 'GET', `/companies/${ids[0]}/history`);
      expect(res.body.data.map((h: { rank: number }) => h.rank)).toEqual([5, 12]);
      expect(res.body.data[0].niche).toBe('Loja de moda feminina');
      expect((await api(admin, 'GET', '/companies/00000000-0000-4000-8000-000000000000/history')).status).toBe(404);
    });

    it('live sem credenciais é recusado antes da fila', async () => {
      const res = await api(admin, 'POST', '/campaigns', { ...NEW_CAMPAIGN, source: 'live' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Configure as credenciais DataForSEO no .env e reinicie. Nenhuma busca foi iniciada.');
      expect(await store.listCampaigns(tenant)).toEqual([]);
    });

    it('formulário inválido e origem import respondem 400 com a mensagem do Python', async () => {
      expect((await api(admin, 'POST', '/campaigns', { ...NEW_CAMPAIGN, limit: 99 })).body.error).toBe('Número fora do intervalo permitido.');
      const res = await api(admin, 'POST', '/campaigns', { ...NEW_CAMPAIGN, source: 'import' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Use a importação de arquivo para esta origem.');
      expect((await api(admin, 'POST', '/campaigns/estimate', { niche: '' })).status).toBe(400);
    });

    it('limite de chamadas e estimativa descontam buscas reaproveitáveis', async () => {
      state.settings = { ...LIVE_SETTINGS, runLimit: 5 };
      const form = {
        ...NEW_CAMPAIGN,
        source: 'live',
        keywords: ['a', 'b', 'c'],
        coordinates: ['-22.0,-47.8,14z', '-22.1,-47.9,14z'],
        limit: 1,
        enrich: false,
        useJev: false,
      };
      const refused = await api(admin, 'POST', '/campaigns', form);
      expect(refused.status).toBe(400);
      expect(refused.body.error).toBe('A campanha pode exceder o limite de chamadas. Reduza termos, pontos ou empresas.');
      expect(await store.listCampaigns(tenant)).toEqual([]);

      const origin = await store.createCampaign(tenant, config());
      for (const keyword of ['a', 'b']) {
        await store.saveSearch(tenant, {
          campaignId: origin, provider: 'dataforseo', operation: 'maps', keyword, location: '-22.0,-47.8,14z', depth: 30,
          cacheKey: mapsSearchKey(keyword, 'São Carlos,São Paulo,Brazil', '-22.0,-47.8,14z'), results: [], cost: 0.002,
        });
      }
      const estimate = await api(admin, 'POST', '/campaigns/estimate', form);
      expect(estimate.body.data).toEqual({ searches: 6, reused: 2, calls: 4 });
      expect((await api(admin, 'POST', '/campaigns/estimate', { ...form, forceRefresh: true })).body.data.reused).toBe(0);
      expect((await api(admin, 'POST', '/campaigns', { ...form, forceRefresh: true })).status).toBe(400);
      expect((await api(admin, 'POST', '/campaigns', form)).status).toBe(201);
    });

    it('createCampaignChecked guarda o pedido de origem e quem criou', async () => {
      const requestId = '11111111-1111-4111-8111-111111111111';
      const { id, estimate } = await createCampaignChecked(tenant, admin.id, NEW_CAMPAIGN, { leadRequestId: requestId });
      expect(estimate).toEqual({ searches: 0, reused: 0, calls: 0 });
      const campaign = await store.getCampaign(tenant, id);
      expect(campaign?.config.leadRequestId).toBe(requestId);
      expect(campaign?.createdBy).toBe(admin.id);
      await expect(createCampaignChecked(tenant, admin.id, { ...NEW_CAMPAIGN, source: 'import' })).rejects.toMatchObject({ status: 400 });
    });

    it('cancelar: campanha na fila pede cancelamento; finalizada responde 400', async () => {
      const queued = await store.createCampaign(tenant, config());
      expect((await api(admin, 'POST', `/campaigns/${queued}/cancel`)).status).toBe(200);
      expect((await store.getCampaign(tenant, queued))?.cancelRequested).toBe(true);
      await store.updateCampaign(tenant, queued, { state: 'completed' });
      const again = await api(admin, 'POST', `/campaigns/${queued}/cancel`);
      expect(again.status).toBe(400);
      expect(again.body.error).toBe('Esta campanha já foi finalizada.');
      expect((await api(admin, 'POST', '/campaigns/00000000-0000-4000-8000-000000000000/cancel')).status).toBe(404);
    });

    it('lista de buscas oculta o conteúdo e marca as expiradas', async () => {
      const origin = await store.createCampaign(tenant, config());
      await store.saveSearch(tenant, {
        campaignId: origin, provider: 'dataforseo', operation: 'maps', cacheKey: 'k', keyword: 'moda', location: 'SC',
        depth: 30, results: [lead()], cost: 0.002,
      });
      const fresh = (await api(admin, 'GET', '/searches')).body.data;
      expect(fresh[0].expired).toBe(false);
      await db('lh_searches').update({ executed_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) });
      const old = (await api(admin, 'GET', '/searches')).body.data;
      expect(old[0].expired).toBe(true);
      expect(old[0]).not.toHaveProperty('results');
    });
  });

  describe('empresas', () => {
    it('DELETE de empresa inexistente responde 404', async () => {
      const res = await api(admin, 'DELETE', '/companies/00000000-0000-4000-8000-000000000000');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Empresa não encontrada.');
    });

    it('DELETE de empresa numa campanha queued ou running responde 409', async () => {
      const campaign = await store.createCampaign(tenant, config());
      const companyId = await store.upsertCompany(tenant, campaign, lead(), 'import');
      for (const stateName of ['queued', 'running'] as const) {
        await store.updateCampaign(tenant, campaign, { state: stateName });
        const res = await api(admin, 'DELETE', `/companies/${companyId}`);
        expect(res.status).toBe(409);
        expect(res.body.error).toBe('Aguarde ou cancele a campanha antes de excluir.');
      }
      expect(await store.getCompany(tenant, companyId)).not.toBeNull();
      await store.updateCampaign(tenant, campaign, { state: 'completed' });
      expect((await api(admin, 'DELETE', `/companies/${companyId}`)).status).toBe(200);
    });

    it('PATCH valida etapa, notas e Instagram; confirmar o Instagram recalcula a pontuação', async () => {
      const { id, companies } = await importedCampaign(['Loja A'], false);
      const [company] = companies;
      const before = company.analysis?.score ?? 0;

      expect((await api(admin, 'PATCH', `/companies/${company.id}`, { stage: 'inventada' })).status).toBe(422);
      const longNotes = await api(admin, 'PATCH', `/companies/${company.id}`, { notes: 'n'.repeat(5001) });
      expect(longNotes.status).toBe(400);
      const noUrl = await api(admin, 'PATCH', `/companies/${company.id}`, { instagramStatus: 'confirmed', instagram: 'https://x.com/a' });
      expect(noUrl.status).toBe(400);
      expect(noUrl.body.error).toBe('Informe o link de um perfil válido do Instagram.');

      const ok = await api(admin, 'PATCH', `/companies/${company.id}`, {
        instagramStatus: 'confirmed',
        instagram: 'https://instagram.com/loja',
      });
      expect(ok.status).toBe(200);
      const [after] = await store.companies(tenant, id);
      expect(after).toMatchObject({ instagram: 'https://www.instagram.com/loja/', instagramStatus: 'confirmed' });
      expect(after.analysis?.score).toBe(before + 15);
    });

    it('empresas já encontradas: lista só campos de tabela e esconde demonstração por padrão', async () => {
      const fx = await foundFixture();
      const res = await api(admin, 'GET', '/found-companies');
      expect(res.body.data.truncated).toBe(false);
      expect(res.body.data.limit).toBe(2000);
      expect(res.body.data.companies).toHaveLength(2);
      expect(Object.keys(res.body.data.companies[0]).sort()).toEqual(
        ['campaigns', 'category', 'city', 'crmStatus', 'demo', 'firstSeen', 'id', 'name', 'phone', 'rating', 'reviews'],
      );
      const shared = res.body.data.companies.find((c: { id: string }) => c.id === fx.shared);
      expect(shared).toMatchObject({ campaigns: 2, crmStatus: 'imported', demo: false });
      expect((await api(admin, 'GET', '/found-companies?demo=1')).body.data.companies).toHaveLength(3);
    });

    it('exporta só os ids pedidos, ignorando desconhecidos', async () => {
      const fx = await foundFixture();
      const unknown = '00000000-0000-4000-8000-000000000000';
      const res = await api(admin, 'POST', '/found-companies/export', { companyIds: [fx.shared, unknown] });
      expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="radar-empresas-\d{8}\.csv"$/);
      expect(res.headers.get('content-type')).toContain('text/csv');
      const rows = csvRows(res.text);
      expect(rows.map((r) => r[0])).toEqual(['Loja Compartilhada']);
      expect(rows[0][4]).toBe("'+55 16 99123-4567");
      expect(csvRows((await api(admin, 'POST', '/found-companies/export', { companyIds: [] })).text)).toEqual([]);
    });

    it('exporta sem ids pulando demonstração e neutralizando fórmulas', async () => {
      const fx = await foundFixture();
      const all = await api(admin, 'POST', '/found-companies/export', {});
      expect(csvRows(all.text).map((r) => r[0])).toEqual(["'=cmd()|calc", 'Loja Compartilhada']);
      const demo = await api(admin, 'POST', '/found-companies/export', { companyIds: [fx.demo] });
      expect(csvRows(demo.text).map((r) => r[0])).toEqual(['Loja Fictícia']);
    });

    async function foundFixture() {
      const first = await store.createCampaign(tenant, config({ source: 'live' }));
      const second = await store.createCampaign(tenant, config({ source: 'live' }));
      const shared = await store.upsertCompany(tenant, first, lead({ name: 'Loja Compartilhada', placeId: 'p1', phone: '+5516991234567', rating: 4.5, reviews: 10 }), 'live', {
        query: 'moda', location: 'SC', rank: 3, depth: 30, observedAt: new Date().toISOString(), sourceUrl: null,
      });
      await store.upsertCompany(tenant, second, lead({ name: 'Loja Compartilhada', placeId: 'p1' }), 'live');
      await store.upsertCompany(tenant, second, lead({ name: '=cmd()|calc', placeId: 'p2' }), 'live');
      const demoCampaign = await store.createCampaign(tenant, config());
      const demo = await store.upsertCompany(tenant, demoCampaign, lead({ name: 'Loja Fictícia' }), 'demo');
      await store.setCrm(tenant, shared, { contactId: null, status: 'imported', sentAt: new Date().toISOString(), ownerId: null });
      return { shared, demo };
    }
  });

  describe('Criar contatos', () => {
    const contactsOf = () => db('contacts').where({ tenant_id: tenant }).orderBy('full_name');

    it('envia como contatos, grava o resultado por empresa e não duplica no reenvio', async () => {
      const { id, companies } = await importedCampaign(['Loja A', 'Loja B', 'Loja C']);
      const res = await api(admin, 'POST', `/campaigns/${id}/contacts`, { ownerId: seller.id });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ imported: 3, duplicate: 0, error: 0, excluded: 0, skipped: 0 });

      const rows = await contactsOf();
      expect(rows.map((r) => r.full_name)).toEqual(['Loja A', 'Loja B', 'Loja C']);
      expect(rows[0]).toMatchObject({ owner_id: seller.id, source: 'leadhunter', type: 'lead' });
      expect(companies.map((c) => c.identity)).toContain(rows[0].external_id);
      expect(rows[0].lead_context).toContain('Prioridade');
      for (const c of await store.companies(tenant, id)) {
        expect(c.crm).toMatchObject({ status: 'imported', ownerId: seller.id });
        expect(rows.map((r) => r.id)).toContain(c.crm?.contactId);
      }

      const again = await api(admin, 'POST', `/campaigns/${id}/contacts`, { ownerId: seller.id });
      expect(again.status).toBe(400);
      expect(again.body.error).toBe('Nenhuma empresa nova para enviar ao CRM.');
      expect(await contactsOf()).toHaveLength(3);
    });

    it('erro pode ser reenviado; empresa já marcada como duplicada não', async () => {
      const { id, companies } = await importedCampaign(['Loja A', 'Loja B', 'Loja C']);
      const [a, b, c] = companies;
      const stamp = { sentAt: new Date().toISOString(), ownerId: null, contactId: null };
      await store.setCrm(tenant, a.id, { ...stamp, status: 'imported' });
      await store.setCrm(tenant, b.id, { ...stamp, status: 'duplicate' });
      await store.setCrm(tenant, c.id, { ...stamp, status: 'error', error: 'ruim' });

      const res = await api(admin, 'POST', `/campaigns/${id}/contacts`, { ownerId: null });
      expect(res.body.data).toMatchObject({ imported: 1, skipped: 2 });
      expect(await contactsOf()).toHaveLength(1);
      expect((await store.getCompany(tenant, c.id))?.crm?.status).toBe('imported');
      expect((await contactsOf())[0].owner_id).toBeNull();
    });

    it('contato já existente vira "duplicate" apontando para ele, sem criar outro', async () => {
      const { id, companies } = await importedCampaign(['Loja A']);
      await api(admin, 'POST', `/campaigns/${id}/contacts`, { ownerId: null });
      const [contact] = await contactsOf();
      await db('lh_companies').where({ id: companies[0].id }).update({ crm: null }); // estado do envio perdido
      const res = await api(admin, 'POST', `/campaigns/${id}/contacts`, { ownerId: null });
      expect(res.body.data).toMatchObject({ imported: 0, duplicate: 1 });
      expect((await store.getCompany(tenant, companies[0].id))?.crm).toMatchObject({ status: 'duplicate', contactId: contact.id });
      expect(await contactsOf()).toHaveLength(1);
    });

    it('descarta empresas do_not_contact, discarded e de demonstração, mesmo selecionadas', async () => {
      const { id, companies } = await importedCampaign(['Loja A', 'Loja B', 'Loja C']);
      const [a, b, c] = companies;
      await store.updateCompany(tenant, a.id, { stage: 'do_not_contact' });
      await store.updateCompany(tenant, b.id, { stage: 'discarded' });
      const res = await api(admin, 'POST', `/campaigns/${id}/contacts`, { ownerId: null, companyIds: [a.id, b.id, c.id] });
      expect(res.body.data).toMatchObject({ imported: 1, excluded: 2 });
      expect((await contactsOf()).map((r) => r.full_name)).toEqual(['Loja C']);

      const none = await api(admin, 'POST', `/campaigns/${id}/contacts`, { ownerId: null, companyIds: [a.id, b.id] });
      expect(none.status).toBe(400);
      expect(none.body.error).toBe('Nenhuma empresa nova para enviar ao CRM.');

      const demo = await store.createCampaign(tenant, config());
      await store.upsertCompany(tenant, demo, lead({ name: 'Demo' }), 'demo');
      const refused = await api(admin, 'POST', `/campaigns/${demo}/contacts`, { ownerId: null });
      expect(refused.status).toBe(400);
      expect(refused.body.error).toBe('Empresas de demonstração não são enviadas ao CRM.');
      expect(await contactsOf()).toHaveLength(1);
    });

    it('envia só os ids escolhidos e ignora empresas que não são da campanha', async () => {
      const { id, companies } = await importedCampaign(['Loja A', 'Loja B']);
      const other = await store.createCampaign(tenant, config());
      const foreign = await store.upsertCompany(tenant, other, lead({ name: 'Loja Z' }), 'import');
      const res = await api(admin, 'POST', `/campaigns/${id}/contacts`, { ownerId: null, companyIds: [companies[0].id, foreign] });
      expect(res.body.data.imported).toBe(1);
      expect((await contactsOf()).map((r) => r.full_name)).toEqual([companies[0].name]);
      expect((await store.getCompany(tenant, foreign))?.crm).toBeNull();
    });

    it('responsável precisa ser membro ativo do workspace (422 invalid_owner)', async () => {
      const { id } = await importedCampaign(['Loja A']);
      const inactive = await makeUser(tenant, 'seller', { active: false });
      const outsider = await makeUser(adminC.tenantId, 'seller');
      for (const ownerId of [inactive, outsider]) {
        const res = await api(admin, 'POST', `/campaigns/${id}/contacts`, { ownerId });
        expect(res.status).toBe(422);
        expect(res.body.code).toBe('invalid_owner');
      }
      expect(await contactsOf()).toHaveLength(0);
    });

    it('recusa mais de 500 empresas novas em um envio', async () => {
      const campaign = await store.createCampaign(tenant, config());
      const rows = Array.from({ length: 501 }, (_, i) => ({
        tenant_id: tenant,
        identity: String(i).padStart(32, '0'),
        source: 'import',
        data: JSON.stringify(lead({ name: `Empresa ${i}` })),
      }));
      const inserted = await db('lh_companies').insert(rows).returning('id');
      await db('lh_campaign_companies').insert(inserted.map((r) => ({ tenant_id: tenant, campaign_id: campaign, company_id: r.id })));
      const res = await api(admin, 'POST', `/campaigns/${campaign}/contacts`, { ownerId: null });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('O CRM aceita até 500 empresas por envio. Selecione menos empresas.');
      expect(await contactsOf()).toHaveLength(0);
    });

    it('sendCompaniesToContacts aceita transação e marca o pedido de origem', async () => {
      const { id, companies } = await importedCampaign(['Loja A']);
      const requestId = (
        await db('lead_requests')
          .insert({ tenant_id: tenant, requested_by: admin.id, niche: 'n', city: 'c', quantity: 1 })
          .returning('id')
      )[0].id as string;
      const result = await db.transaction((trx) =>
        sendCompaniesToContacts(tenant, [companies[0].id], { campaignId: id, ownerId: null, leadRequestId: requestId, trx }),
      );
      expect(result.imported).toBe(1);
      expect((await contactsOf())[0].lead_request_id).toBe(requestId);
      expect((await store.getCompany(tenant, companies[0].id))?.crm).toMatchObject({ status: 'imported' });
    });

    it('transação desfeita não deixa contatos nem marca "imported" nas empresas, e o reenvio funciona', async () => {
      const { id, companies } = await importedCampaign(['Loja A', 'Loja B']);
      await expect(
        db.transaction(async (trx) => {
          const sent = await sendCompaniesToContacts(tenant, undefined, { campaignId: id, ownerId: null, trx });
          expect(sent.imported).toBe(2);
          throw new Error('falha depois do envio');
        }),
      ).rejects.toThrow('falha depois do envio');

      expect(await contactsOf()).toHaveLength(0);
      for (const c of companies) expect((await store.getCompany(tenant, c.id))?.crm).toBeNull();

      const again = await api(admin, 'POST', `/campaigns/${id}/contacts`, { ownerId: null });
      expect(again.body.data).toMatchObject({ imported: 2, skipped: 0 });
    });
  });
});
