import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { SignJWT } from 'jose';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import { errorHandler } from '../../shared/middleware/errorHandler';
import { hasTestDb, makeTenant, makeUser, migrateTestDb, resetLeadHunter } from '../../test/db';
import { recover, onCampaignFinished, runCampaign } from '../leadhunter/engine';
import { deliverFinishedCampaigns, deliverForCampaign } from '../leadhunter/delivery';
import { createProviders, type Providers, type Settings, type Transport } from '../leadhunter/providers';
import type { CompanyData } from '../leadhunter/domain';
import * as store from '../leadhunter/store';
import leadRequestRoutes from './lead-requests.routes';

// Pedidos de leads do M25: o admin cria/executa/recusa e a entrega é automática ao fim da campanha.
// A API roda de ponta a ponta (guardas, Zod, errorHandler) num Express em porta efêmera. Nenhuma rede.

const state = vi.hoisted(() => ({
  settings: { dataforseo: null, jevKey: null, jevModel: 'jev-1.13.0', runLimit: 80, dailyLimit: 200, cacheDays: 30 } as Settings,
  failAfterSend: false,
}));
vi.mock('../leadhunter/providers', async (original) => ({
  ...(await original<typeof import('../leadhunter/providers')>()),
  loadSettings: () => state.settings,
}));
// Simula uma falha DEPOIS de contatos e marcas de CRM terem sido gravados, para provar o rollback.
vi.mock('../leadhunter/contacts', async (original) => {
  const actual = await original<typeof import('../leadhunter/contacts')>();
  return {
    ...actual,
    sendCompaniesToContacts: async (...args: Parameters<typeof actual.sendCompaniesToContacts>) => {
      const summary = await actual.sendCompaniesToContacts(...args);
      if (state.failAfterSend) throw Object.assign(new Error('Falha simulada na entrega.'), { status: 402 });
      return summary;
    },
  };
});

const BASE_SETTINGS: Settings = { ...state.settings };
const LIVE_SETTINGS: Settings = { ...BASE_SETTINGS, dataforseo: { login: 'l', password: 'p' } };

interface Actor {
  id: string;
  tenantId: string;
  role: 'admin' | 'manager' | 'seller' | 'captador';
}

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const sign = (actor: Actor) =>
  new SignJWT({ tenantId: actor.tenantId, role: actor.role, email: 'x@teste.local' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(actor.id)
    .setExpirationTime('5m')
    .sign(secret);

const FORM = { niche: 'Loja de moda feminina', city: 'São Carlos,São Paulo,Brazil', limit: 3, enrich: false, useJev: false };

const lead = (k: number): Partial<CompanyData> => ({
  name: `Loja ${k}`,
  category: 'Moda feminina',
  city: 'São Carlos',
  address: `Rua ${k}`,
  phone: `1699900000${k}`,
  placeId: `p${k}`,
  rank: k,
  rating: 4.5,
  reviews: 10,
  website: null,
});

/** Provedores falsos: o Maps devolve as empresas dadas; o resto nunca deve ser chamado. */
function fakeProviders(leads: Partial<CompanyData>[], afterMaps?: () => Promise<void>): Providers & { maps: ReturnType<typeof vi.fn> } {
  return {
    maps: vi.fn(async () => {
      await afterMaps?.();
      return { leads, cost: 0.002 };
    }),
    async instagram() {
      throw new Error('inesperado');
    },
    async classify() {
      throw new Error('inesperado');
    },
  };
}

describe.skipIf(!hasTestDb)('pedidos de leads (M25)', () => {
  let server: Server;
  let url: string;
  let tenant: string;
  let admin: Actor;
  let captador: Actor;

  const actorFor = async (tenantId: string, role: Actor['role']): Promise<Actor> => ({ id: await makeUser(tenantId, role), tenantId, role });

  async function api(actor: Actor | null, method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = {};
    if (actor) headers.Authorization = `Bearer ${await sign(actor)}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${url}/api/v1/lead-requests${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  /** Pedido legado na fila (vindo do fluxo antigo): inserido direto, sem passar pela API. */
  async function queuedRequest(requestedBy: string | null, extra: Record<string, unknown> = {}) {
    const [row] = await db('lead_requests')
      .insert({ tenant_id: tenant, requested_by: requestedBy, niche: 'Loja de moda feminina', city: 'São Carlos,São Paulo,Brazil', quantity: 3, ...extra })
      .returning('id');
    return row.id as string;
  }

  const requestRow = (id: string) => db('lead_requests').where({ id }).first();
  const campaignOf = async (id: string) => {
    const row = await requestRow(id);
    return row.campaign_id ? store.getCampaign(tenant, row.campaign_id as string) : null;
  };
  const contactsOf = (id: string) => db('contacts').where({ tenant_id: tenant, lead_request_id: id }).orderBy('full_name');
  const notificationsOf = (userId: string) => db('notifications').where({ tenant_id: tenant, user_id: userId });

  /** Executa a campanha do pedido com os provedores dados (o hook de entrega já está registrado). */
  async function runRequestCampaign(id: string, providers: Providers) {
    const row = await requestRow(id);
    await runCampaign(tenant, row.campaign_id as string, providers, state.settings);
  }

  /** Cria como admin o pedido já em execução e devolve o id. */
  async function adminRequest(extra: Record<string, unknown> = {}) {
    const res = await api(admin, 'POST', '/', { ...FORM, ...extra });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  }

  beforeAll(async () => {
    await migrateTestDb();
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/v1/lead-requests', leadRequestRoutes);
    app.use(errorHandler);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.destroy();
  });
  beforeEach(async () => {
    await resetLeadHunter();
    state.settings = LIVE_SETTINGS;
    state.failAfterSend = false;
    onCampaignFinished.handler = deliverForCampaign;
    tenant = await makeTenant({ leadhunterEnabled: true });
    admin = await actorFor(tenant, 'admin');
    captador = await actorFor(tenant, 'captador');
  });
  afterEach(() => {
    onCampaignFinished.handler = null;
    state.settings = BASE_SETTINGS;
    vi.restoreAllMocks();
  });

  describe('acesso', () => {
    it('captador, seller e manager recebem 403 em todas as rotas e nada é criado', async () => {
      const id = await queuedRequest(captador.id);
      for (const role of ['captador', 'seller', 'manager'] as const) {
        const actor = await actorFor(tenant, role);
        const calls = [
          api(actor, 'GET', '/'),
          api(actor, 'POST', '/', FORM),
          api(actor, 'GET', `/${id}`),
          api(actor, 'POST', `/${id}/cancel`),
          api(actor, 'POST', `/${id}/execute`, {}),
          api(actor, 'POST', `/${id}/reject`, { message: 'não' }),
        ];
        for (const res of await Promise.all(calls)) expect(res.status).toBe(403);
      }
      expect((await requestRow(id)).status).toBe('queued');
      expect(await db('lead_requests').count('id as n').first()).toMatchObject({ n: '1' });
      expect(await db('lh_campaigns').count('id as n').first()).toMatchObject({ n: '0' });
    });

    it('flag desligada: todas as rotas respondem 404 (antes da checagem de papel)', async () => {
      const off = await makeTenant({ leadhunterEnabled: false });
      const offAdmin = await actorFor(off, 'admin');
      const offSeller = await actorFor(off, 'seller');
      for (const actor of [offAdmin, offSeller]) {
        expect((await api(actor, 'GET', '/')).status).toBe(404);
        expect((await api(actor, 'POST', '/', FORM)).status).toBe(404);
        expect((await api(actor, 'POST', `/${randomUUID()}/execute`, {})).status).toBe(404);
      }
      expect(await db('lead_requests').where({ tenant_id: off }).count('id as n').first()).toMatchObject({ n: '0' });
    });

    it('sem token: 401', async () => {
      expect((await api(null, 'GET', '/')).status).toBe(401);
    });

    it('id que não é uuid: 422 sem tocar o banco; pedido de outro workspace: 404', async () => {
      expect((await api(admin, 'GET', '/abc')).status).toBe(422);
      expect((await api(admin, 'POST', '/abc/cancel')).status).toBe(422);
      expect((await api(admin, 'POST', '/abc/execute', {})).status).toBe(422);
      expect((await api(admin, 'POST', '/abc/reject', { message: 'x' })).status).toBe(422);
      const other = await makeTenant({ leadhunterEnabled: true });
      const otherAdmin = await actorFor(other, 'admin');
      const id = await queuedRequest(captador.id);
      expect((await api(otherAdmin, 'GET', `/${id}`)).status).toBe(404);
      expect((await api(otherAdmin, 'POST', `/${id}/execute`, {})).status).toBe(404);
      expect((await api(otherAdmin, 'POST', `/${id}/reject`, { message: 'x' })).status).toBe(404);
      expect((await api(otherAdmin, 'POST', `/${id}/cancel`)).status).toBe(404);
      expect((await requestRow(id)).status).toBe('queued');
    });
  });

  describe('admin cria pedido próprio', () => {
    it('campanha criada na hora, ligada ao pedido, e status running', async () => {
      const res = await api(admin, 'POST', '/', { ...FORM, keywords: 'moda feminina São Carlos', notes: 'urgente' });
      expect(res.status).toBe(201);
      const row = await requestRow(res.body.data.id);
      expect(row).toMatchObject({
        tenant_id: tenant,
        requested_by: admin.id,
        status: 'running',
        quantity: 3,
        service: 'google',
        enrich: false,
        use_jev: false,
        force_refresh: false,
        notes: 'urgente',
        keywords: ['moda feminina São Carlos'],
        coordinates: [],
      });
      const campaign = await campaignOf(row.id);
      expect(campaign).toMatchObject({ state: 'queued' });
      expect(campaign?.config).toMatchObject({ source: 'live', limit: 3, leadRequestId: row.id, niche: FORM.niche });
      expect(res.body.data).toMatchObject({ id: row.id, status: 'running', campaign_id: row.campaign_id });
    });

    it('termo padrão não é gravado (vazio = "nicho cidade") e a campanha busca um único termo', async () => {
      const id = await adminRequest();
      expect((await requestRow(id)).keywords).toEqual([]);
      expect((await campaignOf(id))?.config.keywords).toEqual([`${FORM.niche} ${FORM.city}`]);
    });

    it('aceita snake_case nos campos de duas palavras, como o formulário do LeadHunter', async () => {
      const id = await adminRequest({ useJev: undefined, use_jev: false, force_refresh: true });
      expect(await requestRow(id)).toMatchObject({ use_jev: false, force_refresh: true });
    });

    it('`quantity` (nome antigo de `limit`) continua valendo', async () => {
      const { limit, ...withoutLimit } = FORM;
      const id = await adminRequest({ ...withoutLimit, limit: undefined, quantity: 2 });
      expect(limit).toBe(3);
      expect((await requestRow(id)).quantity).toBe(2);
    });

    it('estimativa acima do limite: 400 e nenhum pedido (nem campanha) gravado', async () => {
      state.settings = { ...LIVE_SETTINGS, runLimit: 0 };
      const res = await api(admin, 'POST', '/', FORM);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('limite de chamadas');
      expect(await db('lead_requests').count('id as n').first()).toMatchObject({ n: '0' });
      expect(await db('lh_campaigns').count('id as n').first()).toMatchObject({ n: '0' });
    });

    it('sem credenciais do provedor: 400 e nada gravado', async () => {
      state.settings = BASE_SETTINGS;
      const res = await api(admin, 'POST', '/', FORM);
      expect(res.status).toBe(400);
      expect(await db('lead_requests').count('id as n').first()).toMatchObject({ n: '0' });
      expect(await db('lh_campaigns').count('id as n').first()).toMatchObject({ n: '0' });
    });

    it('falha depois de criar a campanha: nenhum pedido fica e a campanha órfã é cancelada', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await db.raw(`create or replace function lr_test_fail() returns trigger as $$ begin
        if new.campaign_id is not null then raise exception 'falha simulada'; end if; return new; end $$ language plpgsql`);
      await db.raw('create trigger lr_test_fail before update on lead_requests for each row execute function lr_test_fail()');
      try {
        const res = await api(admin, 'POST', '/', FORM);
        expect(res.status).toBe(500);
      } finally {
        await db.raw('drop trigger lr_test_fail on lead_requests');
        await db.raw('drop function lr_test_fail()');
      }
      expect(await db('lead_requests').count('id as n').first()).toMatchObject({ n: '0' });
      const [campaign] = await db('lh_campaigns').where({ tenant_id: tenant });
      expect(campaign.cancel_requested).toBe(true);
    });

    it('cancelamento da campanha órfã que falha é registrado com o id da campanha', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await db.raw(`create or replace function lr_test_fail() returns trigger as $$ begin
        if new.campaign_id is not null then raise exception 'falha simulada'; end if; return new; end $$ language plpgsql`);
      await db.raw('create trigger lr_test_fail before update on lead_requests for each row execute function lr_test_fail()');
      const cancel = vi.spyOn(store, 'updateCampaign').mockRejectedValue(new Error('cancelamento falhou'));
      try {
        expect((await api(admin, 'POST', '/', FORM)).status).toBe(500);
      } finally {
        cancel.mockRestore();
        await db.raw('drop trigger lr_test_fail on lead_requests');
        await db.raw('drop function lr_test_fail()');
      }
      const [campaign] = await db('lh_campaigns').where({ tenant_id: tenant });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('campanha órfã'), campaign.id, expect.any(Error));
    });

    it('quantidade acima do máximo do workspace: 422 e nada gravado; sem cota diária para o admin', async () => {
      await db('tenants').where({ id: tenant }).update({ lead_request_max_quantity: 5, lead_request_daily_per_user: 0 });
      const res = await api(admin, 'POST', '/', { ...FORM, limit: 6 });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('quota_quantity');
      expect(await db('lead_requests').count('id as n').first()).toMatchObject({ n: '0' });
      // pedidos por dia = 0 desativa o fluxo dos outros papéis, mas não o do admin
      await adminRequest({ limit: 5 });
      await adminRequest({ limit: 5 });
    });

    it('formulário inválido: 422 com a mensagem do domínio', async () => {
      const res = await api(admin, 'POST', '/', { ...FORM, limit: 51 });
      expect(res.status).toBe(422);
      const bad = await api(admin, 'POST', '/', { ...FORM, keywords: 'a,b,c,d' });
      expect(bad.status).toBe(422);
      expect(await db('lead_requests').count('id as n').first()).toMatchObject({ n: '0' });
    });
  });

  describe('admin executa pedido na fila', () => {
    it('contatos para o captador, lead_assignments e notificação', async () => {
      const id = await queuedRequest(captador.id, { notes: 'quero 3' });
      const res = await api(admin, 'POST', `/${id}/execute`, { enrich: false, useJev: false });
      expect(res.status).toBe(200);
      expect(await requestRow(id)).toMatchObject({ status: 'running', decided_by: admin.id, enrich: false, use_jev: false });
      expect((await campaignOf(id))?.config).toMatchObject({ source: 'live', leadRequestId: id });

      await runRequestCampaign(id, fakeProviders([lead(1), lead(2), lead(3)]));

      const row = await requestRow(id);
      expect(row).toMatchObject({ status: 'done', delivered_count: 3 });
      expect(row.finished_at).not.toBeNull();
      const contacts = await contactsOf(id);
      expect(contacts).toHaveLength(3);
      expect(contacts.every((c) => c.owner_id === captador.id && c.source === 'leadhunter')).toBe(true);
      const assignments = await db('lead_assignments').where({ tenant_id: tenant, captador_id: captador.id });
      expect(assignments.map((a) => a.contact_id).sort()).toEqual(contacts.map((c) => c.id).sort());
      const [note] = await notificationsOf(captador.id);
      expect(note).toMatchObject({ type: 'lead_request.finished', title: 'Seu pedido de leads foi atendido', resource_id: id });
      expect(note.body).toContain('3 empresa(s) nova(s)');
      // marca de CRM em cada empresa
      const companies = await store.companies(tenant, row.campaign_id);
      expect(companies.every((c) => c.crm?.status === 'imported' && c.crm.ownerId === captador.id)).toBe(true);
    });

    it('edições do admin valem para o pedido e para a campanha', async () => {
      const id = await queuedRequest(captador.id);
      await api(admin, 'POST', `/${id}/execute`, { limit: 2, city: 'São Carlos,São Paulo,Brazil', keywords: ['moda'], enrich: false, useJev: false });
      expect(await requestRow(id)).toMatchObject({ quantity: 2, keywords: ['moda'] });
      expect((await campaignOf(id))?.config).toMatchObject({ limit: 2, keywords: ['moda'] });
    });

    it('pedido de seller (sem lead_assignments): contatos com o dono certo', async () => {
      const seller = await actorFor(tenant, 'seller');
      const id = await queuedRequest(seller.id);
      await api(admin, 'POST', `/${id}/execute`, { enrich: false, useJev: false });
      await runRequestCampaign(id, fakeProviders([lead(1)]));
      expect((await contactsOf(id)).map((c) => c.owner_id)).toEqual([seller.id]);
      expect(await db('lead_assignments').where({ tenant_id: tenant }).count('contact_id as n').first()).toMatchObject({ n: '0' });
      expect(await notificationsOf(seller.id)).toHaveLength(1);
    });

    it('dois admins executam o mesmo pedido: o segundo recebe 409 not_queued e só há uma campanha', async () => {
      const second = await actorFor(tenant, 'admin');
      const id = await queuedRequest(captador.id);
      const results = await Promise.all([
        api(admin, 'POST', `/${id}/execute`, { enrich: false, useJev: false }),
        api(second, 'POST', `/${id}/execute`, { enrich: false, useJev: false }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(results.find((r) => r.status === 409)?.body.code).toBe('not_queued');
      expect(await db('lh_campaigns').count('id as n').first()).toMatchObject({ n: '1' });
    });

    it('falha ao criar a campanha: pedido volta intacto para a fila, sem campanha', async () => {
      const id = await queuedRequest(captador.id);
      state.settings = { ...LIVE_SETTINGS, runLimit: 0 };
      const res = await api(admin, 'POST', `/${id}/execute`, { limit: 4, enrich: false, useJev: false });
      expect(res.status).toBe(400);
      expect(await requestRow(id)).toMatchObject({ status: 'queued', quantity: 3, decided_by: null, campaign_id: null });
      expect(await db('lh_campaigns').count('id as n').first()).toMatchObject({ n: '0' });
      // e pode ser executado depois
      state.settings = LIVE_SETTINGS;
      expect((await api(admin, 'POST', `/${id}/execute`, { enrich: false, useJev: false })).status).toBe(200);
    });

    it('edição inválida: 422 e o pedido continua na fila', async () => {
      const id = await queuedRequest(captador.id);
      expect((await api(admin, 'POST', `/${id}/execute`, { limit: 99 })).status).toBe(422);
      expect(await requestRow(id)).toMatchObject({ status: 'queued' });
    });

    it('pedido que não está na fila não executa: 409', async () => {
      const id = await queuedRequest(captador.id, { status: 'cancelled' });
      const res = await api(admin, 'POST', `/${id}/execute`, {});
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('not_queued');
    });
  });

  describe('recusa e cancelamento', () => {
    it('recusa notifica e vira cancelled com a mensagem', async () => {
      const id = await queuedRequest(captador.id);
      const res = await api(admin, 'POST', `/${id}/reject`, { message: 'Nicho fora do escopo' });
      expect(res.status).toBe(200);
      expect(await requestRow(id)).toMatchObject({ status: 'cancelled', message: 'Nicho fora do escopo', decided_by: admin.id });
      const [note] = await notificationsOf(captador.id);
      expect(note).toMatchObject({ type: 'lead_request.rejected', title: 'Seu pedido de leads foi recusado', resource_id: id });
      expect(note.body).toContain('Nicho fora do escopo');
      expect(await db('lh_campaigns').count('id as n').first()).toMatchObject({ n: '0' });
    });

    it('recusa exige mensagem de 1 a 500 caracteres e só vale na fila', async () => {
      const id = await queuedRequest(captador.id);
      expect((await api(admin, 'POST', `/${id}/reject`, {})).status).toBe(422);
      expect((await api(admin, 'POST', `/${id}/reject`, { message: '' })).status).toBe(422);
      expect((await api(admin, 'POST', `/${id}/reject`, { message: 'x'.repeat(501) })).status).toBe(422);
      expect((await requestRow(id)).status).toBe('queued');
      await api(admin, 'POST', `/${id}/reject`, { message: 'ok' });
      expect((await api(admin, 'POST', `/${id}/reject`, { message: 'ok' })).status).toBe(409);
    });

    it('recusa de quem saiu do workspace: sem notificação', async () => {
      const gone = await actorFor(tenant, 'captador');
      const id = await queuedRequest(gone.id);
      await db('user_tenants').where({ user_id: gone.id }).update({ is_active: false });
      expect((await api(admin, 'POST', `/${id}/reject`, { message: 'não' })).status).toBe(200);
      expect(await notificationsOf(gone.id)).toHaveLength(0);
    });

    it('cancelar só vale para pedido na fila', async () => {
      const queued = await queuedRequest(captador.id);
      expect((await api(admin, 'POST', `/${queued}/cancel`)).status).toBe(200);
      expect((await requestRow(queued)).status).toBe('cancelled');
      const running = await adminRequest();
      expect((await api(admin, 'POST', `/${running}/cancel`)).status).toBe(409);
    });
  });

  describe('entrega ao fim da campanha', () => {
    it('requester saiu do workspace: contatos sem dono e sem notificação', async () => {
      const gone = await actorFor(tenant, 'captador');
      const id = await queuedRequest(gone.id);
      await api(admin, 'POST', `/${id}/execute`, { enrich: false, useJev: false });
      await db('user_tenants').where({ user_id: gone.id }).update({ is_active: false });
      await runRequestCampaign(id, fakeProviders([lead(1), lead(2)]));
      expect(await requestRow(id)).toMatchObject({ status: 'done', delivered_count: 2 });
      const contacts = await contactsOf(id);
      expect(contacts).toHaveLength(2);
      expect(contacts.every((c) => c.owner_id === null)).toBe(true);
      expect(await notificationsOf(gone.id)).toHaveLength(0);
      expect(await db('lead_assignments').where({ tenant_id: tenant }).count('contact_id as n').first()).toMatchObject({ n: '0' });
    });

    it('campanha failed por 40501: pedido failed com a mensagem do provedor e 0 contatos', async () => {
      const id = await queuedRequest(captador.id);
      await api(admin, 'POST', `/${id}/execute`, { enrich: false, useJev: false });
      const bad: Transport = async () => ({ status_code: 20000, tasks: [{ status_code: 40501, status_message: 'Invalid Field: location_name.' }] });
      await runRequestCampaign(id, createProviders(state.settings, bad));
      const row = await requestRow(id);
      expect(row).toMatchObject({ status: 'failed', delivered_count: 0 });
      expect(row.message).toContain('Provedor: 40501 - Invalid Field');
      expect(row.finished_at).not.toBeNull();
      expect(await contactsOf(id)).toHaveLength(0);
      const [note] = await notificationsOf(captador.id);
      expect(note).toMatchObject({ type: 'lead_request.finished', title: 'Não foi possível atender seu pedido de leads' });
    });

    it('empresas discarded/do_not_contact nunca viram contato do pedido', async () => {
      const id = await adminRequest();
      const campaignId = (await requestRow(id)).campaign_id as string;
      // a campanha roda, as empresas ficam marcadas e só então a entrega acontece
      onCampaignFinished.handler = null;
      await runCampaign(tenant, campaignId, fakeProviders([lead(1), lead(2), lead(3)]), state.settings);
      const companies = await store.companies(tenant, campaignId);
      const byName = (name: string) => companies.find((c) => c.name === name)!;
      await store.updateCompany(tenant, byName('Loja 2').id, { stage: 'discarded' });
      await store.updateCompany(tenant, byName('Loja 3').id, { stage: 'do_not_contact' });
      await deliverForCampaign(tenant, campaignId);
      expect((await contactsOf(id)).map((c) => c.full_name)).toEqual(['Loja 1']);
      expect(await requestRow(id)).toMatchObject({ status: 'done', delivered_count: 1 });
    });

    it('já existiam no CRM entram na mensagem e não duplicam', async () => {
      await db('contacts').insert({ tenant_id: tenant, full_name: 'Antiga', phone: '16999000001', owner_id: admin.id });
      const id = await adminRequest();
      await runRequestCampaign(id, fakeProviders([lead(1), lead(2)]));
      const row = await requestRow(id);
      expect(row).toMatchObject({ status: 'done', delivered_count: 1 });
      expect(row.message).toContain('1 já existiam no CRM');
      const [note] = await notificationsOf(admin.id);
      expect(note.body).toContain('1 já existiam no CRM');
      expect(await db('contacts').where({ tenant_id: tenant }).count('id as n').first()).toMatchObject({ n: '2' });
    });

    it('campanha cancelada com empresas coletadas: partial entregue; sem empresas: failed', async () => {
      const withCompanies = await adminRequest({ keywords: ['a', 'b'] });
      const campaignId = (await requestRow(withCompanies)).campaign_id as string;
      await runCampaign(
        tenant,
        campaignId,
        fakeProviders([lead(1)], () => store.updateCampaign(tenant, campaignId, { cancelRequested: true })),
        state.settings,
      );
      expect((await store.getCampaign(tenant, campaignId))?.state).toBe('cancelled');
      expect(await requestRow(withCompanies)).toMatchObject({ status: 'partial', delivered_count: 1 });
      expect(await contactsOf(withCompanies)).toHaveLength(1);

      const empty = await adminRequest();
      const emptyCampaign = (await requestRow(empty)).campaign_id as string;
      await store.updateCampaign(tenant, emptyCampaign, { cancelRequested: true });
      await runRequestCampaign(empty, fakeProviders([]));
      expect(await requestRow(empty)).toMatchObject({ status: 'failed', delivered_count: 0 });
    });

    it('campanha sem nenhuma empresa enviável não lança: vira done/failed pelo mapeamento e fecha o pedido', async () => {
      const id = await adminRequest();
      await runRequestCampaign(id, fakeProviders([]));
      const row = await requestRow(id);
      expect(row.status).toBe('done');
      expect(row).toMatchObject({ delivered_count: 0 });
      expect(row.finished_at).not.toBeNull();
    });

    it('é idempotente e não faz chamada paga: segunda entrega e campanha sem pedido são no-op', async () => {
      const id = await adminRequest();
      const providers = fakeProviders([lead(1)]);
      await runRequestCampaign(id, providers);
      const campaignId = (await requestRow(id)).campaign_id as string;
      await deliverForCampaign(tenant, campaignId);
      await deliverForCampaign(tenant, campaignId);
      expect(await contactsOf(id)).toHaveLength(1);
      expect(await notificationsOf(admin.id)).toHaveLength(1);
      expect(providers.maps).toHaveBeenCalledTimes(1);

      const plain = await store.createCampaign(tenant, { ...(await store.getCampaign(tenant, campaignId))!.config, leadRequestId: undefined });
      await expect(deliverForCampaign(tenant, plain)).resolves.toBeUndefined();
      await expect(deliverForCampaign(tenant, randomUUID())).resolves.toBeUndefined();
    });

    it('falha no meio da entrega desfaz tudo e o pedido fecha como failed', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const id = await queuedRequest(captador.id);
      await api(admin, 'POST', `/${id}/execute`, { enrich: false, useJev: false });
      state.failAfterSend = true;
      await runRequestCampaign(id, fakeProviders([lead(1), lead(2)]));
      const row = await requestRow(id);
      expect(row).toMatchObject({ status: 'failed', delivered_count: 0 });
      expect(row.message).toContain('Falha simulada na entrega.');
      expect(await contactsOf(id)).toHaveLength(0);
      expect(await db('lead_assignments').where({ tenant_id: tenant }).count('contact_id as n').first()).toMatchObject({ n: '0' });
      const companies = await store.companies(tenant, row.campaign_id);
      expect(companies.every((c) => !c.crm)).toBe(true);
    });

    it('queda entre o estado final da campanha e a entrega: o varrimento do boot fecha o pedido uma única vez', async () => {
      const id = await adminRequest();
      onCampaignFinished.handler = null; // o processo morreu antes de a entrega rodar
      await runRequestCampaign(id, fakeProviders([lead(1), lead(2)]));
      const row = await requestRow(id);
      expect(row.status).toBe('running');
      expect((await store.getCampaign(tenant, row.campaign_id))?.state).toBe('completed');

      await deliverFinishedCampaigns();
      await deliverFinishedCampaigns();

      expect(await requestRow(id)).toMatchObject({ status: 'done', delivered_count: 2 });
      expect(await contactsOf(id)).toHaveLength(2);
      expect(await notificationsOf(admin.id)).toHaveLength(1);
    });

    it('empresas já enviadas por campanha anterior contam em "já existiam no CRM" e sustentam o partial', async () => {
      const first = await adminRequest();
      await runRequestCampaign(first, fakeProviders([lead(1), lead(2)]));
      expect(await requestRow(first)).toMatchObject({ status: 'done', delivered_count: 2 });

      const second = await adminRequest();
      await runRequestCampaign(second, fakeProviders([lead(1), lead(2)]));
      const row = await requestRow(second);
      expect(row).toMatchObject({ status: 'done', delivered_count: 0 });
      expect(row.message).toContain('2 já existiam no CRM');
      expect(await db('contacts').where({ tenant_id: tenant }).count('id as n').first()).toMatchObject({ n: '2' });

      const third = await adminRequest({ keywords: ['a', 'b'] });
      const thirdCampaign = (await requestRow(third)).campaign_id as string;
      await runCampaign(
        tenant,
        thirdCampaign,
        fakeProviders([lead(1), lead(2)], () => store.updateCampaign(tenant, thirdCampaign, { cancelRequested: true })),
        state.settings,
      );
      expect((await store.getCampaign(tenant, thirdCampaign))?.state).toBe('cancelled');
      expect(await requestRow(third)).toMatchObject({ status: 'partial', delivered_count: 0 });
    });

    it('campanha órfã com o mesmo leadRequestId não fecha nem entrega o pedido de outra campanha', async () => {
      const id = await adminRequest();
      const real = (await requestRow(id)).campaign_id as string;
      const orphan = await store.createCampaign(tenant, { ...(await store.getCampaign(tenant, real))!.config, leadRequestId: id });
      await store.updateCampaign(tenant, orphan, { state: 'cancelled' });

      await deliverForCampaign(tenant, orphan);
      expect(await requestRow(id)).toMatchObject({ status: 'running', delivered_count: 0, finished_at: null });
      expect(await contactsOf(id)).toHaveLength(0);

      // a falha de entrega da órfã também não fecha o pedido
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await store.updateCampaign(tenant, orphan, { state: 'completed' });
      state.failAfterSend = true;
      await deliverForCampaign(tenant, orphan);
      expect((await requestRow(id)).status).toBe('running');
      state.failAfterSend = false;

      await runRequestCampaign(id, fakeProviders([lead(1)]));
      expect(await requestRow(id)).toMatchObject({ status: 'done', delivered_count: 1 });
      expect(await contactsOf(id)).toHaveLength(1);
    });

    it('campanha interrompida por reinício: deliverFinishedCampaigns fecha o pedido (partial com empresas, failed sem)', async () => {
      const withCompanies = await adminRequest();
      const first = (await requestRow(withCompanies)).campaign_id as string;
      onCampaignFinished.handler = null;
      await runCampaign(tenant, first, fakeProviders([lead(1)]), state.settings);
      await store.updateCampaign(tenant, first, { state: 'running' }); // simula o processo morto no meio
      const empty = await adminRequest();
      const second = (await requestRow(empty)).campaign_id as string;
      await store.updateCampaign(tenant, second, { state: 'running' });
      onCampaignFinished.handler = deliverForCampaign;

      await recover();
      await deliverFinishedCampaigns();

      expect(await requestRow(withCompanies)).toMatchObject({ status: 'partial', delivered_count: 1 });
      expect(await requestRow(empty)).toMatchObject({ status: 'failed', delivered_count: 0 });
      await deliverFinishedCampaigns(); // nada novo a fazer
      expect(await contactsOf(withCompanies)).toHaveLength(1);
    });
  });

  describe('migração 20240038', () => {
    it('devolve claimed/running para queued e limpa a reserva', async () => {
      const [{ name }] = (await db.raw('select current_database() as name')).rows;
      expect(String(name).endsWith('_test')).toBe(true);
      const migration = await import('../../db/migrations/20240038_lead_requests_leadhunter');
      await migration.down(db);
      const reserved = { claimed_at: new Date(), claim_expires_at: new Date(Date.now() + 60_000) };
      const claimed = await queuedRequest(captador.id, { status: 'claimed', ...reserved });
      const running = await queuedRequest(captador.id, { status: 'running', ...reserved });
      const done = await queuedRequest(captador.id, { status: 'done' });
      try {
        await migration.up(db);
        expect(await requestRow(claimed)).toMatchObject({ status: 'queued', claimed_at: null, claim_expires_at: null });
        expect(await requestRow(running)).toMatchObject({ status: 'queued', claimed_at: null, claim_expires_at: null });
        expect((await requestRow(done)).status).toBe('done');
        expect(await requestRow(claimed)).toMatchObject({ service: 'google', keywords: [], coordinates: [], enrich: true, use_jev: true, force_refresh: false, campaign_id: null, decided_by: null });
      } finally {
        const cols = await db.raw("select column_name from information_schema.columns where table_name = 'lead_requests' and column_name = 'service'");
        if (!cols.rows.length) await migration.up(db);
      }
    });
  });
});
