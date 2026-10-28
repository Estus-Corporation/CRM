import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db';
import { hasTestDb, makeTenant, migrateTestDb, resetLeadHunter } from '../../test/db';
import { mapsSearchKey, validateCampaign, type CampaignConfig, type CompanyData, type Fit } from './domain';
import {
  estimateCalls,
  onCampaignFinished,
  recalculate,
  recover,
  runCampaign,
  runNext,
  startWorker,
} from './engine';
import { ProviderError, createProviders, type Providers, type Settings, type Transport } from './providers';
import * as store from './store';

// Port dos testes do motor de test_radar.py (Engine). Nenhuma rede: o transporte dos provedores é falso.

const SETTINGS: Settings = {
  dataforseo: { login: 'test', password: 'test' },
  jevKey: 'test',
  jevModel: 'jev-1.13.0',
  runLimit: 30,
  dailyLimit: 100,
  cacheDays: 30,
};

const DAY_MS = 24 * 60 * 60 * 1000;

const campaignConfig = (extra: Record<string, unknown> = {}): CampaignConfig =>
  validateCampaign({
    niche: 'Loja de moda feminina',
    city: 'São Carlos,São Paulo,Brazil',
    service: 'google',
    source: 'demo',
    limit: 10,
    ...extra,
  });

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

const mapsResponse = (items: unknown[]) => ({
  status_code: 20000,
  cost: 0.002,
  tasks: [{ status_code: 20000, result: [{ check_url: 'https://www.google.com/maps/search/moda', items }] }],
});

/** Transporte simulado: registra o tipo de chamada em `calls`. */
function transportFor(calls: string[], items = 5): Transport {
  return async (url) => {
    if (url.includes('/maps/')) {
      calls.push('maps');
      return mapsResponse(
        Array.from({ length: items }, (_, k) => ({
          type: 'maps_search',
          title: `Loja ${k + 1}`,
          place_id: `p${k + 1}`,
          rank_group: k + 1,
          address_info: { city: 'São Carlos' },
          rating: { value: 4.5, votes_count: 10, rating_type: 'Max5' },
        })),
      );
    }
    if (url.includes('/organic/')) {
      calls.push('organic');
      return {
        status_code: 20000,
        cost: 0.003,
        tasks: [{ status_code: 20000, result: [{ items: [{ type: 'organic', url: 'https://instagram.com/loja/', title: 'Loja' }] }] }],
      };
    }
    calls.push('jev');
    return {
      model: 'jev-1.13.0',
      usage: { input_tokens: 50 },
      answers: { niche_fit: { type: 'choice', choice: 'match', confidence: 0.9 } },
    };
  };
}

interface FakeProviders extends Providers {
  calls: { maps: number; instagram: number; classify: number };
}

/** Provedores falsos que contam chamadas; `maps` devolve as respostas em sequência (ou lança). */
function fakeProviders(mapsReplies: (Partial<CompanyData>[] | Error)[] = []): FakeProviders {
  const calls = { maps: 0, instagram: 0, classify: 0 };
  const replies = [...mapsReplies];
  return {
    calls,
    async maps() {
      calls.maps += 1;
      const reply = replies.shift() ?? [];
      if (reply instanceof Error) throw reply;
      return { leads: reply, cost: 0.002 };
    },
    async instagram() {
      calls.instagram += 1;
      throw new Error('inesperado');
    },
    async classify() {
      calls.classify += 1;
      throw new Error('inesperado');
    },
  };
}

/** Espera (até 10 s) a condição ficar verdadeira. */
async function waitFor(condition: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!(await condition()) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
}

const noCalls = (p: FakeProviders) => expect(p.calls).toEqual({ maps: 0, instagram: 0, classify: 0 });

describe.skipIf(!hasTestDb)('engine do LeadHunter', () => {
  let tenant: string;
  let calls: string[];
  let providers: Providers;

  const newCampaign = (extra: Record<string, unknown> = {}, forTenant = tenant) =>
    store.createCampaign(forTenant, campaignConfig(extra));
  const runLive = async (extra: Record<string, unknown> = {}) => {
    const id = await newCampaign({ source: 'live', limit: 3, useJev: false, enrich: false, ...extra });
    await runCampaign(tenant, id, providers, SETTINGS);
    return id;
  };
  const ageSearches = (days: number) =>
    db('lh_searches').update({ executed_at: new Date(Date.now() - days * DAY_MS) });

  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await resetLeadHunter();
    tenant = await makeTenant({ leadhunterEnabled: true });
    calls = [];
    providers = createProviders(SETTINGS, transportFor(calls));
  });
  afterEach(() => {
    onCampaignFinished.handler = null;
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await db.destroy();
  });

  describe('demonstração e cancelamento', () => {
    it('demonstração offline nunca chama provedor', async () => {
      const fake = fakeProviders();
      const id = await newCampaign();
      await runCampaign(tenant, id, fake, SETTINGS);
      expect((await store.getCampaign(tenant, id))?.state).toBe('completed');
      expect(await store.companies(tenant, id)).toHaveLength(10);
      expect(await store.usage(tenant, id)).toEqual([]);
      noCalls(fake);
    });

    it('cancelamento no meio da execução impede a próxima chamada paga e preserva o já coletado', async () => {
      const id = await newCampaign({ source: 'live', keywords: ['a', 'b'], enrich: false, useJev: false });
      const fake = fakeProviders([[company({ placeId: 'one', rank: 5 })]]);
      const maps = fake.maps.bind(fake);
      fake.maps = async (...args) => {
        const result = await maps(...args);
        await store.updateCampaign(tenant, id, { cancelRequested: true });
        return result;
      };
      const hook = vi.fn(async () => undefined);
      onCampaignFinished.handler = hook;
      await runCampaign(tenant, id, fake, SETTINGS);
      expect(fake.calls.maps).toBe(1);
      expect((await store.getCampaign(tenant, id))?.state).toBe('cancelled');
      expect(hook).toHaveBeenCalledTimes(1);
      expect(await store.companies(tenant, id)).toHaveLength(1);
    });

    it('cancelamento antes de começar não faz chamadas', async () => {
      const fake = fakeProviders();
      const id = await newCampaign();
      await store.updateCampaign(tenant, id, { cancelRequested: true });
      await runCampaign(tenant, id, fake, SETTINGS);
      expect((await store.getCampaign(tenant, id))?.state).toBe('cancelled');
      noCalls(fake);
    });
  });

  describe('busca ao vivo', () => {
    it('seleciona oportunidades além das dez primeiras posições', async () => {
      const fake = fakeProviders([
        Array.from({ length: 20 }, (_, k) =>
          company({ placeId: String(k + 1), name: `Loja ${k + 1}`, rank: k + 1, rating: 4.8, reviews: 10 }),
        ),
      ]);
      const id = await newCampaign({ source: 'live', limit: 2, useJev: false, enrich: false });
      await runCampaign(tenant, id, fake, SETTINGS);
      const found = await store.companies(tenant, id);
      expect(found).toHaveLength(2);
      expect(found.every((c) => (c.analysis?.rankMedian ?? 0) > 10)).toBe(true);
    });

    it('registra só buscas concluídas na cobertura', async () => {
      const fake = fakeProviders([
        [company({ placeId: 'one', rank: 5 })],
        [],
        [company({ placeId: 'one', rank: 8 })],
        new ProviderError('Falha esperada'),
      ]);
      const id = await newCampaign({
        source: 'live',
        keywords: ['a', 'b'],
        coordinates: ['-22,-47,14z', '-22.1,-47.1,14z'],
        enrich: false,
        useJev: false,
      });
      await runCampaign(tenant, id, fake, SETTINGS);
      expect(await store.searchCoverage(tenant, id)).toHaveLength(3);
      expect((await store.companies(tenant, id))[0].analysis?.coverage).toEqual({ appeared: 2, searched: 3, depth: 30 });
    });

    it('credenciais ausentes não simulam dados reais', async () => {
      const fake = fakeProviders();
      const id = await newCampaign({ source: 'live' });
      await runCampaign(tenant, id, fake, { ...SETTINGS, dataforseo: null });
      expect((await store.getCampaign(tenant, id))?.state).toBe('failed');
      expect(await store.companies(tenant, id)).toEqual([]);
      noCalls(fake);
    });

    it('resultados parciais sobrevivem a um erro em busca posterior', async () => {
      const fake = fakeProviders([[company({ placeId: 'one', rank: 18 })], new ProviderError('Falha esperada')]);
      const id = await newCampaign({ source: 'live', keywords: ['a', 'b'], enrich: false, useJev: false });
      await runCampaign(tenant, id, fake, SETTINGS);
      const row = await store.getCampaign(tenant, id);
      expect(row?.state).toBe('partial');
      expect(row?.message).toBe('Falha esperada');
      expect(await store.companies(tenant, id)).toHaveLength(1);
    });

    it('40501 no Maps: campanha failed com a mensagem do provedor e uma única chamada', async () => {
      let seen = 0;
      const bad: Transport = async () => {
        seen += 1;
        return { status_code: 20000, tasks: [{ status_code: 40501, status_message: 'Invalid Field: location_name.' }] };
      };
      const id = await newCampaign({ source: 'live' });
      await runCampaign(tenant, id, createProviders(SETTINGS, bad), SETTINGS);
      const row = await store.getCampaign(tenant, id);
      expect(row?.state).toBe('failed');
      expect(row?.message).toContain('Provedor: 40501 - Invalid Field');
      expect(seen).toBe(1);
      expect(await store.usage(tenant, id)).toMatchObject([{ calls: 1, incomplete: 1 }]);
      expect(await store.listSearches(tenant)).toEqual([]);
    });

    it('Error comum do provedor vira failed com a mensagem; erro inesperado vira falha interna', async () => {
      const plain = await newCampaign({ source: 'live' });
      await runCampaign(tenant, plain, fakeProviders([new Error('Valor inválido.')]), SETTINGS);
      expect(await store.getCampaign(tenant, plain)).toMatchObject({ state: 'failed', message: 'Valor inválido.' });

      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const bug = await newCampaign({ source: 'live' });
      await runCampaign(tenant, bug, fakeProviders([new TypeError('x is undefined')]), SETTINGS);
      expect(await store.getCampaign(tenant, bug)).toMatchObject({
        state: 'failed',
        message: 'Falha interna no processamento. Consulte o terminal; dados anteriores preservados.',
      });
    });

    it('limite de chamadas por campanha interrompe sem nova chamada paga', async () => {
      const id = await newCampaign({ source: 'live', limit: 3, useJev: false, enrich: true });
      await runCampaign(tenant, id, providers, { ...SETTINGS, runLimit: 1 });
      const row = await store.getCampaign(tenant, id);
      expect(row?.state).toBe('partial');
      expect(row?.warnings.join(' ')).toContain(store.LIMIT_MESSAGE);
      expect(calls).toEqual(['maps']);
    });
  });

  describe('reaproveitamento (cache de buscas)', () => {
    it('busca reaproveitada ainda conta para a cobertura', async () => {
      await runLive();
      const id = await runLive();
      const [saved] = await store.listSearches(tenant);
      expect((await store.searchCoverage(tenant, id)).map((s) => s.observedAt)).toEqual([saved.executedAt]);
      expect((await store.companies(tenant, id))[0].analysis?.coverage?.searched).toBe(1);
    });

    it('mesma busca no período reaproveita resultados sem chamada paga', async () => {
      const first = await runLive();
      const second = await runLive();
      expect(calls).toEqual(['maps']);
      expect(await store.usage(tenant, second)).toEqual([]);
      const [saved] = await store.listSearches(tenant);
      expect([saved.reuseCount, saved.campaignId]).toEqual([1, first]);
      const ranks = async (id: string) =>
        (await store.companies(tenant, id)).map((c) => [c.id, c.observations?.map((o) => o.rank)]).sort();
      expect(await ranks(second)).toEqual(await ranks(first));
      const observed = (await store.companies(tenant, second)).flatMap((c) => c.observations ?? []);
      expect(observed.every((o) => o.observedAt === saved.executedAt)).toBe(true);
    });

    it('busca vencida, mais funda ou forçada vai ao provedor', async () => {
      await runLive();
      await runLive({ forceRefresh: true });
      expect(calls).toEqual(['maps', 'maps']);
      await runLive({ limit: 40 });
      expect(calls).toEqual(['maps', 'maps', 'maps']);
      await ageSearches(31);
      await runLive();
      expect(calls).toEqual(['maps', 'maps', 'maps', 'maps']);
    });

    it('campanha só com buscas reaproveitadas termina sem chamadas pagas', async () => {
      await runLive();
      const id = await runLive();
      const row = await store.getCampaign(tenant, id);
      expect(row?.state).toBe('completed');
      expect(await store.usage(tenant, id)).toEqual([]);
      expect(row?.warnings.join(' ')).toMatch(/1 consulta reaproveitada de \d\d\/\d\d/);
    });

    it('Instagram pesquisado no período não é pesquisado de novo', async () => {
      await runLive({ enrich: true });
      expect(calls.filter((c) => c === 'organic')).toHaveLength(3);
      const id = await runLive({ enrich: true });
      expect(calls.filter((c) => c === 'organic')).toHaveLength(3);
      const found = await store.companies(tenant, id);
      expect(new Set(found.map((c) => c.instagramStatus))).toEqual(new Set(['candidate']));
      const old = new Date(Date.now() - 31 * DAY_MS).toISOString();
      for (const c of found) await store.patchCompanyData(tenant, c.id, { instagramSearchedAt: old });
      await runLive({ enrich: true });
      expect(calls.filter((c) => c === 'organic')).toHaveLength(6);
    });

    it('busca de Instagram que falhou espera um dia antes de pagar de novo', async () => {
      const base = transportFor(calls);
      providers = createProviders(SETTINGS, async (url, body, headers) => {
        if (url.includes('/organic/')) {
          calls.push('organic');
          return { status_code: 40101, status_message: 'Internal SE Server Error', tasks: [] };
        }
        return base(url, body, headers);
      });
      const first = await runLive({ enrich: true });
      expect((await store.getCampaign(tenant, first))?.state).toBe('partial');
      expect(calls.filter((c) => c === 'organic')).toHaveLength(3);
      const id = await runLive({ enrich: true });
      expect(calls.filter((c) => c === 'organic')).toHaveLength(3);
      const found = await store.companies(tenant, id);
      expect(new Set(found.map((c) => c.instagramStatus))).toEqual(new Set(['error']));
      const twoDays = new Date(Date.now() - 2 * DAY_MS).toISOString();
      for (const c of found) await store.patchCompanyData(tenant, c.id, { instagramSearchedAt: twoDays });
      await runLive({ enrich: true });
      expect(calls.filter((c) => c === 'organic')).toHaveLength(6);
    });

    it('classificação da Jev é reaproveitada para a mesma empresa e nicho', async () => {
      await runLive({ useJev: true });
      expect(calls.filter((c) => c === 'jev')).toHaveLength(3);
      await runLive({ useJev: true });
      expect(calls.filter((c) => c === 'jev')).toHaveLength(3);
      await runLive({ useJev: true, niche: 'Padaria' });
      expect(calls.filter((c) => c === 'jev')).toHaveLength(6);
    });

    it('empresas sem cidade voltam a ser perguntadas à Jev mesmo com o Maps reaproveitado', async () => {
      const base = transportFor(calls);
      providers = createProviders(SETTINGS, async (url, body, headers) => {
        const data = (await base(url, body, headers)) as ReturnType<typeof mapsResponse>;
        if (url.includes('/maps/')) {
          for (const item of data.tasks[0].result[0].items as { address_info: unknown }[]) item.address_info = {};
        }
        return data;
      });
      const id = await runLive({ limit: 3, useJev: true });
      const total = (await store.companies(tenant, id)).length;
      expect(total).toBeGreaterThan(0);
      expect(calls.filter((c) => c === 'maps')).toHaveLength(1);
      expect(calls.filter((c) => c === 'jev')).toHaveLength(total);
      await runLive({ limit: 3, useJev: true });
      expect(calls.filter((c) => c === 'maps')).toHaveLength(1);
      expect(calls.filter((c) => c === 'jev')).toHaveLength(2 * total);
    });
  });

  describe('estimativa', () => {
    it('desconta buscas reaproveitáveis e ignora o cache quando forçado', async () => {
      const config = campaignConfig({
        source: 'live',
        keywords: ['a', 'b', 'c'],
        coordinates: ['-22.0,-47.8,14z', '-22.1,-47.9,14z'],
        limit: 1,
        enrich: false,
        useJev: false,
      });
      const point = config.coordinates[0];
      const id = await store.createCampaign(tenant, config);
      for (const keyword of ['a', 'b']) {
        await store.saveSearch(tenant, {
          campaignId: id,
          provider: 'dataforseo',
          operation: 'maps',
          cacheKey: mapsSearchKey(keyword, config.city, point),
          keyword,
          location: point,
          depth: 30,
          results: [],
          cost: 0.002,
        });
      }
      expect(await estimateCalls(tenant, config, SETTINGS)).toEqual({ searches: 6, reused: 2, calls: 4 });
      expect((await estimateCalls(tenant, { ...config, forceRefresh: true }, SETTINGS)).reused).toBe(0);
    });

    it('soma as chamadas de Instagram e de Jev por empresa', async () => {
      const config = campaignConfig({ source: 'live', limit: 4, enrich: true, useJev: true });
      expect(await estimateCalls(tenant, config, SETTINGS)).toEqual({ searches: 1, reused: 0, calls: 1 + 4 * 2 });
      expect((await estimateCalls(tenant, config, { ...SETTINGS, jevKey: null })).calls).toBe(1 + 4);
    });
  });

  describe('worker', () => {
    it('recover: running vira interrupted e chamada pendente vira unknown', async () => {
      const id = await newCampaign();
      await store.updateCampaign(tenant, id, { state: 'running' });
      await store.callRecorder(tenant, id, 1, 1).reserve({ provider: 'dataforseo', operation: 'maps' });
      await recover();
      expect(await store.getCampaign(tenant, id)).toMatchObject({
        state: 'interrupted',
        message: 'Execução interrompida pelo reinício. Resultados preservados.',
      });
      expect(await store.usage(tenant, id)).toMatchObject([{ calls: 1, incomplete: 1 }]);
    });

    it('flag desligada: runNext não pega campanha queued', async () => {
      const off = await makeTenant({ leadhunterEnabled: false });
      const id = await newCampaign({ source: 'live' }, off);
      const fake = fakeProviders();
      expect(await runNext(fake, SETTINGS)).toBeNull();
      expect((await store.getCampaign(off, id))?.state).toBe('queued');
      noCalls(fake);
    });

    it('runNext pula tenant sem flag e roda a mais antiga de tenant habilitado', async () => {
      const off = await makeTenant({ leadhunterEnabled: false });
      const blocked = await newCampaign({}, off);
      const older = await newCampaign();
      const newer = await newCampaign();
      expect(await runNext(fakeProviders(), SETTINGS)).toBe(older);
      expect((await store.getCampaign(tenant, older))?.state).toBe('completed');
      expect((await store.getCampaign(tenant, newer))?.state).toBe('queued');
      expect((await store.getCampaign(off, blocked))?.state).toBe('queued');
    });

    it('dois runNext simultâneos não pegam a mesma campanha', async () => {
      const id = await newCampaign();
      const taken = await Promise.all([runNext(fakeProviders(), SETTINGS), runNext(fakeProviders(), SETTINGS)]);
      expect(taken.filter((x) => x === id)).toHaveLength(1);
      expect(taken.filter((x) => x === null)).toHaveLength(1);
    });

    it('reinício no meio: running vira interrupted e pending vira unknown, sem nova chamada', async () => {
      const id = await newCampaign({ source: 'live' });
      await store.updateCampaign(tenant, id, { state: 'running' });
      await store.callRecorder(tenant, id, 5, 5).reserve({ provider: 'dataforseo', operation: 'maps' });
      const fake = fakeProviders();
      await recover();
      expect(await runNext(fake, SETTINGS)).toBeNull();
      expect((await store.getCampaign(tenant, id))?.state).toBe('interrupted');
      expect((await db('lh_api_calls').where({ campaign_id: id }).first())?.state).toBe('unknown');
      noCalls(fake);
    });

    it('startWorker recupera no início, roda a fila e para', async () => {
      const stuck = await newCampaign();
      await store.updateCampaign(tenant, stuck, { state: 'running' });
      const queued = await newCampaign();
      const worker = startWorker({ providers: fakeProviders(), settings: SETTINGS, idleMs: 10 });
      try {
        await waitFor(async () => (await store.getCampaign(tenant, queued))?.state === 'completed');
      } finally {
        await worker.stop();
      }
      expect((await store.getCampaign(tenant, queued))?.state).toBe('completed');
      expect((await store.getCampaign(tenant, stuck))?.state).toBe('interrupted');
    });

    it('startWorker sobrevive a recover e a runNext que falham, e repete o recover antes de rodar a fila', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const stuck = await newCampaign();
      await store.updateCampaign(tenant, stuck, { state: 'running' });
      const queued = await newCampaign();
      vi.spyOn(Object.getPrototypeOf(db.fn), 'now').mockImplementationOnce(() => {
        throw new Error('recover falhou');
      });
      vi.spyOn(db, 'raw').mockRejectedValueOnce(new Error('runNext falhou'));
      const worker = startWorker({ providers: fakeProviders(), settings: SETTINGS, idleMs: 10 });
      try {
        await waitFor(async () => (await store.getCampaign(tenant, queued))?.state === 'completed');
      } finally {
        await worker.stop();
      }
      expect((await store.getCampaign(tenant, stuck))?.state).toBe('interrupted');
      expect(log.mock.calls.map(([message]) => message)).toEqual([
        '[leadhunter] recover falhou',
        '[leadhunter] worker falhou',
      ]);
    });

    it('stop() com campanha em andamento: interrupted com a mensagem de reinício, sem nova chamada e sem hook', async () => {
      const hook = vi.fn(async () => undefined);
      onCampaignFinished.handler = hook;
      const id = await newCampaign({ source: 'live', keywords: ['a', 'b'], enrich: true, useJev: false });
      const fake = fakeProviders([[company({ placeId: 'one', rank: 5 })]]);
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const maps = fake.maps.bind(fake);
      fake.maps = async (...args) => {
        const result = await maps(...args);
        await gate;
        return result;
      };
      const worker = startWorker({ providers: fake, settings: SETTINGS, idleMs: 10 });
      try {
        await waitFor(async () => fake.calls.maps === 1);
      } finally {
        const stopping = worker.stop();
        release();
        await stopping;
      }
      expect(await store.getCampaign(tenant, id)).toMatchObject({
        state: 'interrupted',
        message: 'Execução interrompida pelo reinício. Resultados preservados.',
      });
      expect(fake.calls).toEqual({ maps: 1, instagram: 0, classify: 0 });
      expect(await store.companies(tenant, id)).toHaveLength(1);
      expect(hook).not.toHaveBeenCalled();
    });
  });

  describe('onCampaignFinished', () => {
    it('onCampaignFinished é chamado uma vez com o estado final já gravado', async () => {
      const id = await newCampaign();
      const seen: { tenantId: string; campaignId: string; state?: string }[] = [];
      onCampaignFinished.handler = async (tenantId, campaignId) => {
        seen.push({ tenantId, campaignId, state: (await store.getCampaign(tenantId, campaignId))?.state });
      };
      await runCampaign(tenant, id, fakeProviders(), SETTINGS);
      expect(seen).toEqual([{ tenantId: tenant, campaignId: id, state: 'completed' }]);
    });

    it('erro no handler não derruba a execução', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const id = await newCampaign();
      onCampaignFinished.handler = async () => {
        throw new Error('falhou');
      };
      await expect(runCampaign(tenant, id, fakeProviders(), SETTINGS)).resolves.toBeUndefined();
      expect((await store.getCampaign(tenant, id))?.state).toBe('completed');
      expect(log).toHaveBeenCalled();
    });
  });

  it('mediana dos pares: com cinco comparáveis, avaliações abaixo da mediana pontuam', async () => {
    const reviews = [100, 100, 100, 100, 100, 10];
    const fake = fakeProviders([
      reviews.map((r, k) => company({ placeId: `m${k}`, name: `Loja ${k}`, rank: k + 1, reviews: r, rating: 3 })),
    ]);
    const id = await newCampaign({ source: 'live', limit: 6, useJev: false, enrich: false });
    await runCampaign(tenant, id, fake, SETTINGS);
    const found = await store.companies(tenant, id);
    expect(found.every((c) => c.analysis?.peerMedian === 100)).toBe(true);
    const low = found.find((c) => c.reviews === 10);
    expect(low?.analysis?.reasons.some((r) => r.text.includes('abaixo da mediana'))).toBe(true);
  });

  it('recalculate usa o enquadramento informado (no_match confiável vira fora do perfil)', async () => {
    const id = await newCampaign();
    await runCampaign(tenant, id, fakeProviders(), SETTINGS);
    const fit: Fit = { choice: 'no_match', method: 'jev', confidence: 0.95, model: null };
    const [first] = await store.companies(tenant, id);
    await recalculate(tenant, id, new Map([[first.id, fit]]));
    const again = (await store.companies(tenant, id)).find((c) => c.id === first.id);
    expect(again?.analysis?.priority).toBe('excluded');
  });
});
