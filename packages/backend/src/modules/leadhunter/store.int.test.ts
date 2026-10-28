import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db';
import { hasTestDb, makeTenant, migrateTestDb, resetLeadHunter } from '../../test/db';
import type { Analysis, CampaignConfig, CompanyData, Fit, Observation } from './domain';
import * as store from './store';

const config: CampaignConfig = {
  niche: 'Loja de moda feminina',
  city: 'São Carlos,São Paulo,Brazil',
  source: 'demo',
  service: 'google',
  limit: 10,
  keywords: ['loja de moda feminina São Carlos'],
  coordinates: [],
  enrich: true,
  useJev: true,
  forceRefresh: false,
};

const company = (extra: Partial<CompanyData> = {}): Partial<CompanyData> => ({
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

const observation = (query: string, rank: number | null = 5): Observation => ({
  query,
  location: 'SC',
  rank,
  depth: 30,
  observedAt: '2026-01-01T00:00:00.000Z',
  sourceUrl: null,
});

const recorder = (tenantId: string, campaignId: string, run = 80, day = 1_000_000) =>
  store.callRecorder(tenantId, campaignId, run, day);

describe.skipIf(!hasTestDb)('store do LeadHunter', () => {
  let tenant: string;
  let campaign: string;

  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await resetLeadHunter();
    tenant = await makeTenant({ leadhunterEnabled: true });
    campaign = await store.createCampaign(tenant, config);
  });
  afterAll(async () => {
    await db.destroy();
  });

  describe('campanhas', () => {
    it('cria, lê, atualiza e lista em camelCase', async () => {
      const id = await store.createCampaign(tenant, { ...config, leadRequestId: 'r1' }, { state: 'importing' });
      await store.updateCampaign(tenant, id, { state: 'running', progress: 40, warnings: ['a'], cancelRequested: true });
      const found = await store.getCampaign(tenant, id);
      expect(found).toMatchObject({
        id,
        state: 'running',
        progress: 40,
        message: '',
        warnings: ['a'],
        cancelRequested: true,
        createdBy: null,
        config: { niche: config.niche, leadRequestId: 'r1' },
      });
      expect((await store.listCampaigns(tenant)).map((c) => c.id)).toEqual([id, campaign]);
      expect(await store.getCampaign(tenant, 'nao-e-uuid')).toBeNull();
    });
  });

  describe('empresas', () => {
    it('o mesmo lugar em três buscas vira uma empresa com três observações', async () => {
      for (const q of ['a', 'b', 'c']) await store.upsertCompany(tenant, campaign, company({ placeId: 'p1' }), 'live', observation(q));
      const found = await store.companies(tenant, campaign);
      expect(found).toHaveLength(1);
      expect(found[0].observations).toHaveLength(3);
    });

    it('Instagram revisado à mão e "não abordar" sobrevivem a nova coleta em outra campanha', async () => {
      const id = await store.upsertCompany(tenant, campaign, company({ placeId: 'p1' }), 'live');
      await store.patchCompanyData(tenant, id, { instagram: 'https://www.instagram.com/correto/', instagramStatus: 'confirmed' });
      await store.updateCompany(tenant, id, { stage: 'do_not_contact', notes: 'Não abordar' });
      const other = await store.createCampaign(tenant, config);
      await store.upsertCompany(
        tenant,
        other,
        company({ placeId: 'p1', instagram: 'https://www.instagram.com/errado/', instagramStatus: 'candidate' }),
        'live',
      );
      const [lead] = await store.companies(tenant, other);
      expect(lead.instagram).toBe('https://www.instagram.com/correto/');
      expect(lead.stage).toBe('do_not_contact');
      expect(lead.fieldSources.instagram).toBeUndefined();
    });

    it('Instagram candidato sobrevive à mesma empresa chegando como "not_searched"', async () => {
      const id = await store.upsertCompany(tenant, campaign, company({ placeId: 'p1', instagramStatus: 'not_searched' }), 'live');
      await store.patchCompanyData(tenant, id, {
        instagram: 'https://www.instagram.com/loja/',
        instagramStatus: 'candidate',
        instagramSearchedAt: '2026-01-01T00:00:00.000Z',
      });
      const other = await store.createCampaign(tenant, config);
      await store.upsertCompany(tenant, other, company({ placeId: 'p1', instagramStatus: 'not_searched' }), 'live');
      const [lead] = await store.companies(tenant, other);
      expect(lead.instagramStatus).toBe('candidate');
      expect(lead.instagramSearchedAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('dado novo não nulo vence, nulo não apaga, e a procedência é registrada por campo', async () => {
      const id = await store.upsertCompany(tenant, campaign, company({ placeId: 'p1', phone: '+5516' }), 'live');
      await store.upsertCompany(tenant, campaign, company({ placeId: 'p1', phone: null, rating: 4.5 }), 'import');
      const found = await store.getCompany(tenant, id);
      expect(found).toMatchObject({ phone: '+5516', rating: 4.5, source: 'import', stage: 'new', notes: '', crm: null });
      expect(found?.fieldSources.phone.source).toBe('live');
      expect(found?.fieldSources.rating.source).toBe('import');
    });

    it('upserts simultâneos da mesma empresa não duplicam', async () => {
      const ids = await Promise.all(
        [1, 2, 3, 4].map((n) => store.upsertCompany(tenant, campaign, company({ placeId: 'p1', reviews: n }), 'live', observation(`q${n}`))),
      );
      expect(new Set(ids).size).toBe(1);
      expect(await store.companies(tenant, campaign)).toHaveLength(1);
    });

    it('rejeita campanha de outro workspace', async () => {
      const other = await makeTenant({ leadhunterEnabled: true });
      await expect(store.upsertCompany(other, campaign, company(), 'live')).rejects.toThrow('Campanha não encontrada.');
    });

    it('setCrm em empresa inexistente falha; em existente guarda o resultado', async () => {
      await expect(
        store.setCrm(tenant, '00000000-0000-4000-8000-000000000000', { contactId: null, status: 'error', sentAt: 'x', ownerId: null }),
      ).rejects.toThrow('Empresa não encontrada.');
      const id = await store.upsertCompany(tenant, campaign, company(), 'live');
      await store.setCrm(tenant, id, { contactId: 'c1', status: 'imported', sentAt: '2026-01-01', ownerId: null });
      expect((await store.getCompany(tenant, id))?.crm).toMatchObject({ contactId: 'c1', status: 'imported' });
    });

    it('ordena por pontuação e devolve a análise gravada', async () => {
      const low = await store.upsertCompany(tenant, campaign, company({ placeId: 'p1' }), 'live');
      const high = await store.upsertCompany(tenant, campaign, company({ placeId: 'p2' }), 'live');
      await store.setAnalysis(tenant, campaign, low, { score: 10 } as Analysis);
      await store.setAnalysis(tenant, campaign, high, { score: 90 } as Analysis);
      const found = await store.companies(tenant, campaign);
      expect(found.map((c) => [c.id, c.analysis?.score])).toEqual([[high, 90], [low, 10]]);
    });

    it('keepCampaignCompanies tira a empresa solta da campanha e só apaga a que não foi tocada nem está em outra', async () => {
      const kept = await store.upsertCompany(tenant, campaign, company({ placeId: 'p1' }), 'live', observation('a'));
      const loose = await store.upsertCompany(tenant, campaign, company({ placeId: 'p2' }), 'live', observation('a'));
      const touched = await store.upsertCompany(tenant, campaign, company({ placeId: 'p3' }), 'live');
      await store.updateCompany(tenant, touched, { notes: 'ligar' });
      const other = await store.createCampaign(tenant, config);
      const shared = await store.upsertCompany(tenant, campaign, company({ placeId: 'p4' }), 'live');
      await store.upsertCompany(tenant, other, company({ placeId: 'p4' }), 'live');

      await store.keepCampaignCompanies(tenant, campaign, [kept]);

      expect((await store.companies(tenant, campaign)).map((c) => c.id)).toEqual([kept]);
      expect(await store.getCompany(tenant, loose)).toBeNull();
      expect(await store.getCompany(tenant, touched)).not.toBeNull();
      expect(await store.getCompany(tenant, shared)).not.toBeNull();
      expect(await store.campaignsForCompany(tenant, shared)).toEqual([{ id: other, state: 'queued' }]);
    });

    it('history junta as observações de todas as campanhas com o nicho', async () => {
      const id = await store.upsertCompany(tenant, campaign, company({ placeId: 'p1' }), 'live', observation('a', 3));
      const other = await store.createCampaign(tenant, { ...config, niche: 'Padaria' });
      await store.upsertCompany(tenant, other, company({ placeId: 'p1' }), 'live', { ...observation('b', 7), observedAt: '2026-02-01T00:00:00.000Z' });
      const h = await store.history(tenant, id);
      expect(h.map((o) => [o.campaignId, o.niche, o.rank])).toEqual([[campaign, config.niche, 3], [other, 'Padaria', 7]]);
    });

    it('deleteCompany apaga a empresa e o que depende dela', async () => {
      const id = await store.upsertCompany(tenant, campaign, company(), 'live', observation('a'));
      await store.deleteCompany(tenant, id);
      expect(await store.getCompany(tenant, id)).toBeNull();
      expect(await store.companies(tenant, campaign)).toEqual([]);
    });
  });

  describe('empresas já encontradas e exportação', () => {
    let shared: string;
    let only: string;
    let demo: string;

    beforeEach(async () => {
      const live = { ...config, source: 'live' as const };
      const first = await store.createCampaign(tenant, live);
      const second = await store.createCampaign(tenant, live);
      shared = await store.upsertCompany(
        tenant,
        first,
        company({ name: 'Loja Compartilhada', placeId: 'p1', phone: '+5516991234567', rating: 4.5, reviews: 10 }),
        'live',
        observation('moda', 3),
      );
      await store.upsertCompany(tenant, second, company({ name: 'Loja Compartilhada', placeId: 'p1' }), 'live');
      only = await store.upsertCompany(tenant, second, company({ name: '=cmd()|calc', placeId: 'p2' }), 'live');
      demo = await store.upsertCompany(tenant, await store.createCampaign(tenant, config), company({ name: 'Loja Fictícia' }), 'demo');
      await store.setCrm(tenant, shared, { contactId: 'c1', status: 'imported', sentAt: '2026-01-01', ownerId: null });
      // a exportação usa a análise da campanha mais recente em que a empresa aparece
      await store.setAnalysis(tenant, first, shared, { score: 10 } as Analysis);
      await store.setAnalysis(tenant, second, shared, { score: 55 } as Analysis);
    });

    it('lista uma linha por empresa, mais nova primeiro, com demonstração só quando pedida', async () => {
      const { rows, truncated } = await store.foundCompanies(tenant, { includeDemo: false });
      expect(rows.map((r) => r.name)).toEqual(['=cmd()|calc', 'Loja Compartilhada']);
      expect(truncated).toBe(false);
      expect(rows[1]).toMatchObject({ id: shared, campaigns: 2, crmStatus: 'imported', demo: false, phone: '+5516991234567' });
      expect(rows[0]).toMatchObject({ id: only, campaigns: 1, crmStatus: null });
      const withDemo = await store.foundCompanies(tenant, { includeDemo: true });
      expect(withDemo.rows).toHaveLength(3);
      expect(withDemo.rows.find((r) => r.id === demo)?.demo).toBe(true);
    });

    it('limite corta a lista e avisa que foi truncada', async () => {
      const { rows, truncated } = await store.foundCompanies(tenant, { includeDemo: true, limit: 1 });
      expect(rows).toHaveLength(1);
      expect(truncated).toBe(true);
    });

    it('exporta só os ids pedidos e ignora os desconhecidos', async () => {
      const rows = await store.exportRows(tenant, [shared, 'inexistente', '00000000-0000-4000-8000-000000000000']);
      expect(rows.map((r) => r.company.name)).toEqual(['Loja Compartilhada']);
      expect(rows[0].analysis?.score).toBe(55);
      expect(rows[0].observations).toHaveLength(1);
      expect(await store.exportRows(tenant, [])).toEqual([]);
    });

    it('sem ids exporta todas as reais (sem demonstração); com o id da demonstração, só ela', async () => {
      expect((await store.exportRows(tenant)).map((r) => r.company.name)).toEqual(['=cmd()|calc', 'Loja Compartilhada']);
      const [row] = await store.exportRows(tenant, [demo]);
      expect(row.company).toMatchObject({ name: 'Loja Fictícia', source: 'demo', stage: 'new', notes: '' });
      expect(row.analysis).toBeNull();
    });
  });

  describe('cache de buscas e cobertura', () => {
    const save = (extra: { depth?: number; n?: number; key?: string; cost?: number | null } = {}) =>
      store.saveSearch(tenant, {
        campaignId: campaign,
        provider: 'dataforseo',
        operation: 'maps',
        cacheKey: extra.key ?? 'k',
        keyword: 'moda',
        location: 'Sao Carlos',
        depth: extra.depth ?? 30,
        results: Array.from({ length: extra.n ?? 1 }, (_, i) => company({ name: `L${i}` })),
        cost: extra.cost === undefined ? 0.002 : extra.cost,
      });

    it('busca reaproveitada ainda conta na cobertura, com a data da busca original', async () => {
      await save();
      const [row] = await store.listSearches(tenant);
      await store.recordSearch(tenant, campaign, 'moda', 'Sao Carlos', 30, row.executedAt);
      await store.recordSearch(tenant, campaign, 'moda', 'Sao Carlos', 30);
      expect(await store.searchCoverage(tenant, campaign)).toEqual([
        { query: 'moda', location: 'Sao Carlos', depth: 30, observedAt: row.executedAt },
      ]);
    });

    it('apagar a campanha preserva o histórico de buscas, sem o conteúdo', async () => {
      await save();
      await db('lh_campaigns').where({ id: campaign }).delete();
      const [row] = await store.listSearches(tenant);
      expect(row.campaignId).toBeNull();
      expect(row.resultCount).toBe(1);
      expect(row).not.toHaveProperty('results');
    });

    it('busca paga é gravada com custo e cortada na profundidade', async () => {
      await save({ depth: 2, n: 5, cost: 0.002 });
      const [row] = await store.listSearches(tenant);
      expect(row).toMatchObject({ keyword: 'moda', location: 'Sao Carlos', depth: 2, resultCount: 2, cost: 0.002, campaignId: campaign, reuseCount: 0, lastReusedAt: null });
    });

    it('só reaproveita com profundidade suficiente e data recente', async () => {
      await save({ depth: 40, n: 40 });
      expect((await store.reusableSearch(tenant, 'k', 30, 30))?.results).toHaveLength(30);
      expect((await store.reusableSearch(tenant, 'k', 40, 30))?.results).toHaveLength(40);
      expect(await store.reusableSearch(tenant, 'k', 41, 30)).toBeNull();
      expect(await store.reusableSearch(tenant, 'outra', 30, 30)).toBeNull();
      await db('lh_searches').update({ executed_at: new Date(Date.now() - 31 * 86_400_000) });
      expect(await store.reusableSearch(tenant, 'k', 30, 30)).toBeNull();
    });

    it('marcar como reaproveitada soma o contador', async () => {
      await save();
      const hit = await store.reusableSearch(tenant, 'k', 30, 30);
      await store.markSearchReused(tenant, hit!.id);
      await store.markSearchReused(tenant, hit!.id);
      const [row] = await store.listSearches(tenant);
      expect(row.reuseCount).toBe(2);
      expect(row.lastReusedAt).not.toBeNull();
    });

    it('enquadramento do Jev só é reaproveitado se for do mesmo nicho, recente e sem revisão de região', async () => {
      const id = await store.upsertCompany(tenant, campaign, company({ placeId: 'p1' }), 'live');
      const fit: Fit = {
        choice: 'unknown',
        method: 'jev',
        confidence: null,
        model: null,
        niche: 'moda feminina',
        evaluatedAt: new Date().toISOString(),
        regionReview: true,
      };
      await store.setAnalysis(tenant, campaign, id, { fit } as Analysis);
      expect(await store.reusableFit(tenant, id, 'moda feminina', 30)).toBeNull();
      delete fit.regionReview;
      await store.setAnalysis(tenant, campaign, id, { fit } as Analysis);
      expect((await store.reusableFit(tenant, id, 'moda feminina', 30))?.method).toBe('jev');
      expect(await store.reusableFit(tenant, id, 'padaria', 30)).toBeNull();
      await store.setAnalysis(tenant, campaign, id, { fit: { ...fit, evaluatedAt: '2020-01-01T00:00:00.000Z' } } as Analysis);
      expect(await store.reusableFit(tenant, id, 'moda feminina', 30)).toBeNull();
    });
  });

  describe('chamadas de API', () => {
    it('reserva antes da chamada: o limite da campanha barra a segunda e a pendente conta como incompleta', async () => {
      const calls = recorder(tenant, campaign, 1);
      await calls.reserve({ provider: 'dataforseo', operation: 'maps' });
      await expect(calls.reserve({ provider: 'dataforseo', operation: 'maps' })).rejects.toThrow(store.LIMIT_MESSAGE);
      expect(await store.usage(tenant, campaign)).toEqual([{ provider: 'dataforseo', calls: 1, cost: 0, tokens: 0, incomplete: 1 }]);
    });

    it('finish grava estado, custo e tokens, e a chamada deixa de ser incompleta', async () => {
      const calls = recorder(tenant, campaign);
      const id = await calls.reserve({ provider: 'typesafe', operation: 'classification' });
      await calls.finish(id, { state: 'success', cost: 0.5, tokens: 120, model: 'jev-1' });
      expect(await store.usage(tenant, campaign)).toEqual([{ provider: 'typesafe', calls: 1, cost: 0.5, tokens: 120, incomplete: 0 }]);
    });

    it('o limite diário é global entre workspaces', async () => {
      const other = await makeTenant({ leadhunterEnabled: true });
      const otherCampaign = await store.createCampaign(other, config);
      await recorder(other, otherCampaign).reserve({ provider: 'dataforseo', operation: 'maps' });
      const dailyLimit = await store.callsToday();
      expect(dailyLimit).toBe(1);
      await expect(recorder(tenant, campaign, 80, dailyLimit).reserve({ provider: 'dataforseo', operation: 'maps' })).rejects.toThrow(
        store.LIMIT_MESSAGE,
      );
    });

    it('duas reservas simultâneas com uma vaga no dia: só uma passa', async () => {
      const other = await makeTenant({ leadhunterEnabled: true });
      const otherCampaign = await store.createCampaign(other, config);
      const dailyLimit = (await store.callsToday()) + 1;
      const results = await Promise.allSettled([
        recorder(tenant, campaign, 80, dailyLimit).reserve({ provider: 'dataforseo', operation: 'maps' }),
        recorder(other, otherCampaign, 80, dailyLimit).reserve({ provider: 'dataforseo', operation: 'maps' }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason.message).toBe(store.LIMIT_MESSAGE);
      expect(await store.callsToday()).toBe(dailyLimit);
    });

    it('não reserva em campanha de outro workspace', async () => {
      const other = await makeTenant({ leadhunterEnabled: true });
      await expect(recorder(other, campaign).reserve({ provider: 'dataforseo', operation: 'maps' })).rejects.toThrow(
        'Campanha não encontrada.',
      );
    });
  });

  describe('isolamento entre workspaces', () => {
    it('nenhuma função vê dados de outro tenant', async () => {
      const b = await makeTenant({ leadhunterEnabled: true });
      const id = await store.upsertCompany(tenant, campaign, company({ placeId: 'p1' }), 'live', observation('a'));
      await store.saveSearch(tenant, {
        campaignId: campaign, provider: 'dataforseo', operation: 'maps', cacheKey: 'k', keyword: 'm', location: 'l', depth: 30, results: [], cost: null,
      });
      await store.recordSearch(tenant, campaign, 'a', 'SC', 30);
      await recorder(tenant, campaign).reserve({ provider: 'dataforseo', operation: 'maps' });

      expect(await store.getCompany(b, id)).toBeNull();
      expect(await store.getCampaign(b, campaign)).toBeNull();
      expect(await store.listCampaigns(b)).toEqual([]);
      expect(await store.companies(b, campaign)).toEqual([]);
      expect(await store.foundCompanies(b, { includeDemo: true })).toEqual({ rows: [], truncated: false });
      expect(await store.exportRows(b)).toEqual([]);
      expect(await store.exportRows(b, [id])).toEqual([]);
      expect(await store.history(b, id)).toEqual([]);
      expect(await store.campaignsForCompany(b, id)).toEqual([]);
      expect(await store.searchCoverage(b, campaign)).toEqual([]);
      expect(await store.usage(b, campaign)).toEqual([]);
      expect(await store.listSearches(b)).toEqual([]);
      expect(await store.reusableSearch(b, 'k', 30, 30)).toBeNull();
      expect(await store.reusableFit(b, id, 'x', 30)).toBeNull();
    });

    it('escritas com id de outro tenant não alteram nada', async () => {
      const b = await makeTenant({ leadhunterEnabled: true });
      const id = await store.upsertCompany(tenant, campaign, company({ placeId: 'p1' }), 'live');
      await store.updateCompany(b, id, { stage: 'discarded', notes: 'x' });
      await store.updateCampaign(b, campaign, { state: 'failed' });
      await store.deleteCompany(b, id);
      await store.setAnalysis(b, campaign, id, { score: 99 } as Analysis);
      await expect(store.patchCompanyData(b, id, { name: 'X' })).rejects.toThrow('Empresa não encontrada.');
      await expect(
        store.setCrm(b, id, { contactId: null, status: 'error', sentAt: 'x', ownerId: null }),
      ).rejects.toThrow('Empresa não encontrada.');
      await store.keepCampaignCompanies(b, campaign, []);

      expect(await store.getCompany(tenant, id)).toMatchObject({ stage: 'new', notes: '', name: 'Loja A', crm: null });
      expect((await store.getCampaign(tenant, campaign))?.state).toBe('queued');
      expect((await store.companies(tenant, campaign))[0].analysis).toBeUndefined();
    });
  });
});
