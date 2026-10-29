import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env';
import type { CallRecorder, CompanyData } from './domain';
import {
  ProviderError,
  createProviders,
  httpTransport,
  loadSettings,
  parseMaps,
  type Settings,
  type Transport,
} from './providers';

const SETTINGS: Settings = {
  dataforseo: { login: 'test', password: 'test' },
  jevKey: 'test',
  jevModel: 'jev-1.13.0',
  runLimit: 30,
  dailyLimit: 100,
  cacheDays: 30,
};

function company(overrides: Partial<CompanyData> = {}): CompanyData {
  return {
    name: 'Loja A',
    category: 'Moda feminina',
    city: 'São Carlos',
    borough: null,
    address: 'Rua Teste 1',
    placeId: null,
    phone: null,
    website: null,
    websiteChecked: false,
    rating: null,
    reviews: null,
    mapsUrl: null,
    sourceUrl: null,
    collectedAt: '2026-01-01T00:00:00+00:00',
    updatedAt: '2026-01-01T00:00:00+00:00',
    instagram: null,
    instagramStatus: 'not_searched',
    instagramSource: null,
    instagramCandidates: [],
    instagramSearchedAt: null,
    instagramVerifiedAt: null,
    fieldSources: {},
    ...overrides,
  };
}

function mapsResponse(items: unknown[]) {
  return {
    status_code: 20000,
    cost: 0.002,
    tasks: [{ status_code: 20000, result: [{ check_url: 'https://www.google.com/maps/search/moda', items }] }],
  };
}

/** Gravador em memória: guarda a ordem dos eventos e o que foi fechado. */
function recorder(events: string[] = []) {
  const finished: { state: string; cost?: number | null; tokens?: number | null; model?: string | null }[] = [];
  const reserved: { provider: string; operation: string }[] = [];
  const rec: CallRecorder = {
    async reserve(op) {
      events.push('reserve');
      reserved.push(op);
      return `call-${reserved.length}`;
    },
    async finish(_id, result) {
      events.push(`finish:${result.state}`);
      finished.push(result);
    },
  };
  return { rec, events, finished, reserved };
}

function providersWith(transport: Transport, settings: Settings = SETTINGS) {
  return createProviders(settings, transport);
}

describe('parseMaps', () => {
  it('anúncios não são importados e a posição orgânica é usada', () => {
    const rows = parseMaps(
      mapsResponse([
        { type: 'maps_paid_item', title: 'Anúncio', rank_group: 1 },
        { type: 'maps_search', title: 'Loja', rank_group: 3, rank_absolute: 4, rating: null },
      ]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].rank).toBe(3);
    expect(rows[0].reviews).toBeNull();
    expect(rows[0].websiteChecked).toBe(true);
    expect(rows[0].instagramStatus).toBe('not_searched');
    expect(rows[0].sourceUrl).toBe('https://www.google.com/maps/search/moda');
  });

  it('monta a URL do mapa como o urlencode do Python e ignora nota que não é Max5', () => {
    const [row] = parseMaps(
      mapsResponse([
        {
          type: 'maps_search',
          title: 'Café & Cia ~*',
          place_id: 'ChIJ1',
          rating: { value: 4.5, votes_count: 10, rating_type: 'Max5' },
        },
        { type: 'maps_search', title: 'Outra', rating: { value: 9, votes_count: 1, rating_type: 'Percents' } },
      ]),
    );
    expect(row.mapsUrl).toBe('https://www.google.com/maps/search/?api=1&query=Caf%C3%A9+%26+Cia+~%2A&query_place_id=ChIJ1');
    expect(row.rating).toBe(4.5);
    expect(row.reviews).toBe(10);
    expect(parseMaps(mapsResponse([{ type: 'maps_search', title: 'Outra', rating: { value: 9, rating_type: 'Percents' } }]))[0].rating).toBeNull();
  });

  it('o erro do provedor traz o código e o texto', () => {
    const response = { status_code: 20000, tasks: [{ status_code: 40501, status_message: 'Invalid Field: location_name.' }] };
    expect(() => parseMaps(response)).toThrow(ProviderError);
    expect(() => parseMaps(response)).toThrow('40501 - Invalid Field: location_name');
    expect(() => parseMaps({ status_code: 50000, tasks: [] })).toThrow('50000');
  });

  it('resposta sem objeto de resultado é rejeitada', () => {
    expect(() => parseMaps({ status_code: 20000, tasks: [{ status_code: 20000, result: [] }] })).toThrow(
      'O provedor não devolveu o objeto de resultado.',
    );
  });
});

describe('call(): reserva, transporte e fechamento', () => {
  it('reserva acontece antes do transporte e exceção fecha como unknown', async () => {
    const events: string[] = [];
    const { rec } = recorder(events);
    const transport: Transport = async () => {
      events.push('transport');
      throw new Error('queda de rede');
    };
    await expect(providersWith(transport).maps(rec, 'moda', 'São Carlos', null, 30)).rejects.toThrow('queda de rede');
    expect(events).toEqual(['reserve', 'transport', 'finish:unknown']);
  });

  it('40501 vira ProviderError com o código e a mensagem do provedor e a chamada fecha como error', async () => {
    const { rec, finished } = recorder();
    const bad = { status_code: 20000, tasks: [{ status_code: 40501, status_message: 'Invalid Field: location_name' }] };
    const err = await providersWith(async () => bad).maps(rec, 'moda', 'São Carlos', null, 30).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.message).toContain('Provedor: 40501 - Invalid Field: location_name');
    expect(finished.map((f) => f.state)).toEqual(['error']);
  });

  it('resposta fora do contrato fecha como unknown', async () => {
    const { rec, events } = recorder();
    await expect(providersWith(async () => ['x']).maps(rec, 'moda', 'São Carlos', null, 30)).rejects.toThrow(
      'Resposta do serviço fora do contrato esperado.',
    );
    expect(events).toEqual(['reserve', 'finish:unknown']);
  });

  it('sem credenciais não reserva nem chama o transporte', async () => {
    const { rec, events } = recorder();
    const transport = vi.fn<Transport>();
    const noKeys: Settings = { ...SETTINGS, dataforseo: null, jevKey: null };
    await expect(providersWith(transport, noKeys).maps(rec, 'moda', 'x', null, 30)).rejects.toBeInstanceOf(ProviderError);
    await expect(providersWith(transport, noKeys).classify(rec, company(), 'moda')).rejects.toBeInstanceOf(ProviderError);
    expect(events).toEqual([]);
    expect(transport).not.toHaveBeenCalled();
  });
});

describe('maps', () => {
  it('envia a tarefa certa, com autenticação Basic, e devolve custo e leads', async () => {
    const { rec, finished, reserved } = recorder();
    const transport = vi.fn<Transport>(async () => mapsResponse([{ type: 'maps_search', title: 'Loja', rank_group: 1 }]));
    const out = await providersWith(transport).maps(rec, 'moda', 'São Carlos', null, 30);
    expect(out.cost).toBe(0.002);
    expect(out.leads).toHaveLength(1);
    expect(reserved).toEqual([{ provider: 'dataforseo', operation: 'maps' }]);
    expect(finished).toEqual([{ state: 'success', cost: 0.002, tokens: null, model: null }]);
    const [url, body, headers] = transport.mock.calls[0];
    expect(url).toBe('https://api.dataforseo.com/v3/serp/google/maps/live/advanced');
    expect(body).toEqual([{ keyword: 'moda', language_code: 'pt', depth: 30, location_name: 'São Carlos' }]);
    expect(headers.Authorization).toBe('Basic ' + Buffer.from('test:test').toString('base64'));
  });

  it('com coordenada usa location_coordinate no lugar da cidade', async () => {
    const { rec } = recorder();
    const transport = vi.fn<Transport>(async () => mapsResponse([]));
    await providersWith(transport).maps(rec, 'moda', 'São Carlos', '-22.0,-47.8,14z', 20);
    expect(transport.mock.calls[0][1]).toEqual([
      { keyword: 'moda', language_code: 'pt', depth: 20, location_coordinate: '-22.0,-47.8,14z' },
    ]);
  });
});

describe('jev', () => {
  const answer = (niche_fit: unknown) => ({ model: 'jev-1.13.0', usage: { input_tokens: 200 }, answers: { niche_fit } });

  it('respeita o contrato e registra tokens e modelo', async () => {
    const { rec, finished, reserved } = recorder();
    const transport = vi.fn<Transport>(async () => answer({ type: 'choice', choice: 'match', confidence: 0.92 }));
    const fit = await providersWith(transport).classify(rec, company(), 'Moda Feminina');
    expect(fit).toMatchObject({ choice: 'match', confidence: 0.92, method: 'jev', model: 'jev-1.13.0', niche: 'moda feminina' });
    expect(fit.evaluatedAt).toBeTruthy();
    const [url, body, headers] = transport.mock.calls[0];
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(headers.Authorization).toBe('Bearer test');
    expect((body as any).model).toBe('jev-1.13.0');
    expect((body as any).questions.niche_fit.type).toBe('choice');
    expect((body as any).state.business).toEqual({ name: 'Loja A', category: 'Moda feminina', city: 'São Carlos' });
    expect(reserved).toEqual([{ provider: 'typesafe', operation: 'classification' }]);
    expect(finished).toEqual([{ state: 'success', cost: null, tokens: 200, model: 'jev-1.13.0' }]);
  });

  it('classificação inventada ou sem confiança vira ProviderError', async () => {
    const { rec } = recorder();
    await expect(
      providersWith(async () => answer({ choice: 'invented' })).classify(rec, company(), 'moda'),
    ).rejects.toThrow('Jev retornou uma classificação inválida; revisão necessária.');
    await expect(
      providersWith(async () => answer({ type: 'choice', choice: 'match' })).classify(rec, company(), 'moda'),
    ).rejects.toThrow('Jev não informou confiança; revisão necessária.');
  });
});

describe('instagram', () => {
  const organic = (items: unknown[]) => ({ status_code: 20000, tasks: [{ status_code: 20000, result: [{ items }] }] });

  it('a busca devolve candidato, não confirmação', async () => {
    const { rec, reserved } = recorder();
    const transport = vi.fn<Transport>(async () =>
      organic([
        { type: 'organic', url: 'https://instagram.com/loja/', title: 'Loja' },
        { type: 'organic', url: 'https://www.instagram.com/loja', title: 'Repetida' },
        { type: 'organic', url: 'https://instagram.com/p/xyz', title: 'Post' },
      ]),
    );
    const found = await providersWith(transport).instagram(rec, company(), 'São Carlos', null);
    expect(found.instagramStatus).toBe('candidate');
    expect(found.instagram).toBe('https://www.instagram.com/loja/');
    expect(found.instagramCandidates).toHaveLength(1);
    expect(found.instagramSource).toBe('Busca pública indexada; identidade ainda não confirmada.');
    expect(reserved).toEqual([{ provider: 'dataforseo', operation: 'organic' }]);
    const body = transport.mock.calls[0][1] as any[];
    expect(body[0]).toMatchObject({ keyword: 'site:instagram.com "Loja A" São Carlos', depth: 10, location_name: 'São Carlos' });
  });

  it('com localidade no formato do DataForSEO a consulta usa só o nome da cidade, sem aspas', async () => {
    const { rec } = recorder();
    const none = { status_code: 20000, tasks: [{ status_code: 40102, status_message: 'No Search Results.' }] };
    const transport = vi.fn<Transport>(async () => none);
    await providersWith(transport).instagram(rec, company(), 'Sao Carlos,State of Sao Paulo,Brazil', null);
    const body = transport.mock.calls[0][1] as any[];
    expect(body[0]).toMatchObject({
      keyword: 'site:instagram.com "Loja A" Sao Carlos',
      location_name: 'Sao Carlos,State of Sao Paulo,Brazil',
    });
  });

  it('sem resultados (40102) é não encontrado, não erro', async () => {
    const { rec, finished } = recorder();
    const none = { status_code: 20000, tasks: [{ status_code: 40102, status_message: 'No Search Results.' }] };
    const found = await providersWith(async () => none).instagram(rec, company(), 'São Carlos', null);
    expect(found.instagramStatus).toBe('not_found');
    expect(found.instagram).toBeNull();
    expect(found.instagramCandidates).toEqual([]);
    expect(finished.map((f) => f.state)).toEqual(['error']);
  });

  it('erro do provedor traz código e mensagem', async () => {
    const { rec } = recorder();
    const bad = { status_code: 20000, tasks: [{ status_code: 40501, status_message: 'Invalid Field: location_coordinate.' }] };
    const err = await providersWith(async () => bad).instagram(rec, company(), 'São Carlos', null).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.message).toContain('40501');
    expect(err.message).toContain('Invalid Field');
  });
});

describe('loadSettings', () => {
  const original = { ...env };
  afterEach(() => Object.assign(env, original));

  it('limita cacheDays a 0–3650', () => {
    env.LEADHUNTER_SEARCH_CACHE_DAYS = 99_999;
    expect(loadSettings().cacheDays).toBe(3650);
    env.LEADHUNTER_SEARCH_CACHE_DAYS = 0;
    expect(loadSettings().cacheDays).toBe(0);
    env.LEADHUNTER_SEARCH_CACHE_DAYS = 30;
    expect(loadSettings().cacheDays).toBe(30);
  });

  it('chaves vazias viram null e preenchidas viram credenciais', () => {
    env.DATAFORSEO_LOGIN = '';
    env.DATAFORSEO_PASSWORD = '';
    env.TYPESAFE_API_KEY = '';
    expect(loadSettings()).toMatchObject({ dataforseo: null, jevKey: null });
    env.DATAFORSEO_LOGIN = 'u';
    env.DATAFORSEO_PASSWORD = 'p';
    env.TYPESAFE_API_KEY = 'k';
    env.LEADHUNTER_MAX_CALLS_PER_CAMPAIGN = 7;
    env.LEADHUNTER_MAX_CALLS_PER_DAY = 9;
    expect(loadSettings()).toMatchObject({
      dataforseo: { login: 'u', password: 'p' },
      jevKey: 'k',
      jevModel: env.TYPESAFE_MODEL,
      runLimit: 7,
      dailyLimit: 9,
    });
  });

  it('login sem senha não conta como credencial', () => {
    env.DATAFORSEO_LOGIN = 'u';
    env.DATAFORSEO_PASSWORD = '';
    expect(loadSettings().dataforseo).toBeNull();
  });
});

describe('httpTransport (fetch simulado, sem rede)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (fn: (url: string, init: RequestInit) => Promise<Response>) => vi.stubGlobal('fetch', vi.fn(fn));
  const call = () => httpTransport('https://example.test/x', { a: 1 }, { Authorization: 'Bearer segredo' });

  it('envia JSON com timeout, sem seguir redirecionamento, e devolve o corpo', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(call()).resolves.toEqual({ ok: true });
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
    expect(init.redirect).toBe('error');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer segredo');
  });

  it('HTTP de erro traz o código e a mensagem do provedor, sem vazar credenciais', async () => {
    stub(async () => new Response('{"status_message":"Payment Required"}', { status: 402 }));
    const err = (await call().catch((e) => e)) as Error;
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.message).toBe('Serviço retornou HTTP 402. Confira credenciais, saldo e limites. Mensagem do provedor: Payment Required');
    expect(err.message).not.toContain('segredo');
  });

  it('HTTP de erro com corpo ilegível não traz detalhe', async () => {
    stub(async () => new Response('<html>', { status: 500 }));
    await expect(call()).rejects.toThrow('Serviço retornou HTTP 500. Confira credenciais, saldo e limites.');
  });

  it('resposta acima de 8 000 000 bytes é rejeitada', async () => {
    stub(async () => new Response('x'.repeat(8_000_001), { status: 200 }));
    await expect(call()).rejects.toThrow('Resposta acima do limite de tamanho.');
  });

  it('JSON inválido vira resposta inválida', async () => {
    stub(async () => new Response('não é json', { status: 200 }));
    await expect(call()).rejects.toThrow('O serviço retornou uma resposta inválida.');
  });

  it('falha de rede ou timeout vira indisponível, sem repetir', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('fetch failed: segredo');
    });
    vi.stubGlobal('fetch', fetchMock);
    const err = (await call().catch((e) => e)) as Error;
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.message).toBe('Serviço indisponível ou tempo de espera esgotado. Nenhuma repetição automática foi feita.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
