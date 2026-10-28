import { db } from '../../db';
import {
  identity,
  isFresh,
  localFit,
  mapsSearchKey,
  median,
  normalized,
  scoreLead,
  shortDate,
  type CampaignConfig,
  type CompanyData,
  type Fit,
  type Observation,
} from './domain';
import { ProviderError, createProviders, loadSettings, type Providers, type Settings } from './providers';
import * as store from './store';

// Executor durável de campanhas (port de radar/engine.py do LeadHunter): demonstração offline,
// busca ao vivo com cache, enquadramento (Jev/regras), Instagram e pontuação. Nenhuma repetição
// automática; todo gasto passa pelo recorder do store, que impõe os limites por campanha e por dia.

const ERROR_RETRY_DAYS = 1;
const RESTART_MESSAGE = 'Execução interrompida pelo reinício. Resultados preservados.';
const INTERNAL_FAILURE = 'Falha interna no processamento. Consulte o terminal; dados anteriores preservados.';
const CANCELLED_MESSAGE = 'Campanha cancelada. Resultados já coletados foram preservados.';
const DEMO_DEPTH = 50;
const MIN_DEPTH = 30;
const COMPARABLE_CONFIDENCE = 0.8;
const MIN_PEERS = 5;

const DEMO_NAMES = [
  'Ateliê Aurora', 'Casa Violeta', 'Flor de Rua', 'Linha Clara', 'Estação Amora',
  'Essência Boutique', 'Vista Bela', 'Modo Íris', 'Alameda Rosa', 'Studio Cora',
];
const DEMO_BOROUGHS = ['Centro', 'Vila Prado', 'Santa Felícia'];
const DEMO_RATINGS = [4.8, 4.6, 4.2, 4.9, 3.8, 4.7, 4.5, 4.1, 4.9, 4.3];
const DEMO_REVIEWS = [12, 8, 6, 112, 4, 19, 43, 9, 85, 7];
const DEMO_RANKS = [18, 23, 14, 2, 32, 12, 7, 27, 3, 16];

/** O usuário pediu o cancelamento (`cancel_requested`). */
class Cancelled extends Error {}

/** O processo está encerrando (`stop()` do worker): a campanha termina como no reinício, não como cancelada. */
class Interrupted extends Error {}

/** Falhas com mensagem própria (ValueError/ProviderError do Python); o resto é falha interna. */
const hasOwnMessage = (error: unknown): error is Error =>
  error instanceof ProviderError || (error instanceof Error && error.constructor === Error);

const searchDepth = (config: CampaignConfig): number => Math.max(MIN_DEPTH, config.limit);
const searchPoints = (config: CampaignConfig): (string | null)[] => (config.coordinates.length ? config.coordinates : [null]);

function demoLeads(config: CampaignConfig): (Partial<CompanyData> & { rank: number })[] {
  return DEMO_NAMES.slice(0, config.limit).map((name, i) => ({
    name: `${name} · Exemplo`,
    category: config.niche,
    city: config.city,
    address: `Endereço fictício ${i + 1} — apenas demonstração`,
    borough: DEMO_BOROUGHS[i % 3],
    placeId: `demo-${normalized(config.niche)}-${normalized(config.city)}-${i}`,
    phone: null,
    website: i % 3 === 0 ? 'https://example.com' : null,
    websiteChecked: true,
    rating: DEMO_RATINGS[i],
    reviews: DEMO_REVIEWS[i],
    instagram: null,
    instagramStatus: 'not_searched',
    rank: DEMO_RANKS[i],
    sourceUrl: null,
    mapsUrl: null,
    collectedAt: new Date().toISOString(),
  }));
}

export async function estimateCalls(
  tenantId: string,
  config: CampaignConfig,
  settings: Settings,
): Promise<{ searches: number; reused: number; calls: number }> {
  const depth = searchDepth(config);
  const pairs = config.keywords.flatMap((keyword) => searchPoints(config).map((point) => ({ keyword, point })));
  let reused = 0;
  if (!config.forceRefresh) {
    for (const { keyword, point } of pairs) {
      if (await store.reusableSearch(tenantId, mapsSearchKey(keyword, config.city, point), depth, settings.cacheDays)) reused += 1;
    }
  }
  const enrichment = config.limit * (Number(config.enrich) + Number(config.useJev && !!settings.jevKey));
  return { searches: pairs.length, reused, calls: pairs.length - reused + enrichment };
}

async function check(tenantId: string, campaignId: string, signal?: AbortSignal): Promise<void> {
  const campaign = await store.getCampaign(tenantId, campaignId);
  if (!campaign || campaign.cancelRequested) throw new Cancelled();
  if (signal?.aborted) throw new Interrupted();
}

/** Reavalia as empresas da campanha: a mediana de avaliações dos pares só vale com cinco comparáveis. */
export async function recalculate(tenantId: string, campaignId: string, fits?: Map<string, Fit>): Promise<void> {
  const campaign = await store.getCampaign(tenantId, campaignId);
  if (!campaign) return;
  const leads = await store.companies(tenantId, campaignId);
  const fitOf = (lead: (typeof leads)[number]): Fit => fits?.get(lead.id) ?? lead.analysis?.fit ?? localFit(lead, campaign.config.niche);
  const comparable = leads
    .filter((lead) => {
      const fit = fitOf(lead);
      return (
        fit.choice === 'match' &&
        (fit.method === 'rules' || (fit.confidence ?? 0) >= COMPARABLE_CONFIDENCE) &&
        lead.reviews !== null &&
        lead.reviews !== undefined
      );
    })
    .map((lead) => lead.reviews as number);
  const peerMedian = comparable.length >= MIN_PEERS ? median(comparable) : null;
  const searches = await store.searchCoverage(tenantId, campaignId);
  for (const lead of leads) {
    const analysis = scoreLead(lead, lead.observations ?? [], fitOf(lead), campaign.config.service, peerMedian, searches);
    await store.setAnalysis(tenantId, campaignId, lead.id, analysis);
  }
}

export const onCampaignFinished: { handler: ((tenantId: string, campaignId: string) => Promise<void>) | null } = {
  handler: null,
};

async function notifyFinished(tenantId: string, campaignId: string): Promise<void> {
  try {
    await onCampaignFinished.handler?.(tenantId, campaignId);
  } catch (error) {
    console.error('[leadhunter] onCampaignFinished falhou', error);
  }
}

export async function runCampaign(
  tenantId: string,
  campaignId: string,
  providers: Providers,
  settings: Settings,
  signal?: AbortSignal,
): Promise<void> {
  const campaign = await store.getCampaign(tenantId, campaignId);
  if (!campaign) return;
  const config = campaign.config;
  const recorder = store.callRecorder(tenantId, campaignId, settings.runLimit, settings.dailyLimit);
  const warnings: string[] = [];
  const reused: string[] = [];
  const fits = new Map<string, Fit>();
  const days = settings.cacheDays;
  const progress = (message: string, percent?: number) =>
    store.updateCampaign(tenantId, campaignId, { message, ...(percent === undefined ? {} : { progress: percent }) });
  const stillRunning = () => check(tenantId, campaignId, signal);
  const notices = (): string[] => {
    const oldest = reused.length ? shortDate(new Date(Math.min(...reused.map((d) => new Date(d).getTime()))).toISOString()) : null;
    const note = oldest
      ? [`${reused.length} consulta${reused.length > 1 ? 's' : ''} reaproveitada${reused.length > 1 ? 's' : ''} de ${oldest}.`]
      : [];
    return [...new Set([...warnings, ...note])];
  };

  try {
    await stillRunning();
    await store.updateCampaign(tenantId, campaignId, { state: 'running', message: 'Buscando empresas…', progress: 5 });

    if (config.source === 'demo') {
      warnings.push('Demonstração: todas as empresas, posições e avaliações são fictícias. Nenhuma API foi consultada.');
      await collectDemo(tenantId, campaignId, config, stillRunning);
    } else if (config.source === 'live') {
      if (!settings.dataforseo) {
        throw new ProviderError('Configure DATAFORSEO_LOGIN e DATAFORSEO_PASSWORD no .env e reinicie o aplicativo.');
      }
      await collectLive();
    }
    // Empresas importadas já foram validadas e gravadas pela API antes de entrar na fila.
    await analyze();

    await recalculate(tenantId, campaignId, fits);
    await stillRunning();
    const final = notices();
    const total = (await store.companies(tenantId, campaignId)).length;
    await store.updateCampaign(tenantId, campaignId, {
      state: final.some((w) => w.startsWith('Jev:') || w.startsWith('Instagram:')) ? 'partial' : 'completed',
      progress: 100,
      message: total ? `${total} empresas organizadas.` : 'Nenhuma empresa retornada para os filtros consultados.',
      warnings: final,
    });
  } catch (error) {
    if (error instanceof Interrupted) {
      // Igual ao recover() de um reinício forçado: sem hook de campanha finalizada.
      await recalculate(tenantId, campaignId);
      await store.updateCampaign(tenantId, campaignId, { state: 'interrupted', message: RESTART_MESSAGE, warnings: notices() });
      return;
    }
    if (error instanceof Cancelled) {
      await recalculate(tenantId, campaignId);
      await store.updateCampaign(tenantId, campaignId, { state: 'cancelled', message: CANCELLED_MESSAGE, warnings: notices() });
    } else if (hasOwnMessage(error)) {
      await recalculate(tenantId, campaignId);
      const partial = (await store.companies(tenantId, campaignId)).length > 0;
      await store.updateCampaign(tenantId, campaignId, {
        state: partial ? 'partial' : 'failed',
        message: error.message,
        warnings: notices(),
      });
    } else {
      console.error('[leadhunter] falha interna na campanha', campaignId, error);
      await store.updateCampaign(tenantId, campaignId, { state: 'failed', message: INTERNAL_FAILURE });
    }
  }
  await notifyFinished(tenantId, campaignId);

  /** Busca no Maps (ou no cache), mantendo a lista das melhores a cada consulta para não perder resultado parcial. */
  async function collectLive(): Promise<void> {
    const candidates = new Map<string, { lead: Partial<CompanyData>; observations: Observation[] }>();
    const targetCity = normalized(config.city.split(',')[0].split('–')[0].split(' - ')[0]);
    const depth = searchDepth(config);
    let outside = 0;
    let missingCity = 0;
    for (const query of config.keywords) {
      for (const point of searchPoints(config)) {
        await stillRunning();
        const saved = config.forceRefresh
          ? null
          : await store.reusableSearch(tenantId, mapsSearchKey(query, config.city, point), depth, days);
        let batch: Partial<CompanyData>[];
        if (saved) {
          await store.markSearchReused(tenantId, saved.id);
          reused.push(saved.executedAt);
          await progress(`Reaproveitando busca de ${shortDate(saved.executedAt)}: ${query}`, 15);
          batch = saved.results;
        } else {
          await progress(`Consultando: ${query}`, 15);
          const found = await providers.maps(recorder, query, config.city, point, depth);
          await store.saveSearch(tenantId, {
            campaignId,
            provider: 'dataforseo',
            operation: 'maps',
            cacheKey: mapsSearchKey(query, config.city, point),
            keyword: query,
            location: point ?? config.city,
            depth,
            results: found.leads,
            cost: found.cost,
          });
          batch = found.leads;
        }
        const observedAt = saved ? saved.executedAt : new Date().toISOString();
        await store.recordSearch(tenantId, campaignId, query, point ?? config.city, depth, observedAt);
        for (const raw of batch) {
          if (raw.city && normalized(raw.city) !== targetCity) {
            outside += 1;
            continue;
          }
          const lead = raw.city ? raw : { ...raw, regionReview: true };
          if (!raw.city) missingCity += 1;
          const key = identity(
            { placeId: lead.placeId ?? null, name: lead.name ?? '', address: lead.address ?? null, city: lead.city ?? null },
            'live',
          );
          const entry = candidates.get(key) ?? { lead, observations: [] };
          entry.observations.push({
            query,
            location: point ?? config.city,
            rank: lead.rank ?? null,
            depth,
            observedAt,
            sourceUrl: lead.sourceUrl ?? null,
          });
          candidates.set(key, entry);
        }
        await keepBest(candidates);
      }
    }
    if (outside) warnings.push(`${outside} resultados fora da cidade informada foram excluídos.`);
    if (missingCity) warnings.push('Há resultados sem cidade estruturada; confira a região na ficha.');
  }

  async function keepBest(candidates: Map<string, { lead: Partial<CompanyData>; observations: Observation[] }>): Promise<void> {
    const ranked = [...candidates.values()]
      .map((c) => ({
        c,
        score: scoreLead(c.lead as CompanyData, c.observations, localFit(c.lead as CompanyData, config.niche), config.service).score,
      }))
      .sort((a, b) => b.score - a.score);
    const chosenIds: string[] = [];
    for (const { c } of ranked.slice(0, config.limit)) {
      for (const observation of c.observations) {
        chosenIds.push(await store.upsertCompany(tenantId, campaignId, c.lead, 'live', observation));
      }
    }
    await store.keepCampaignCompanies(tenantId, campaignId, [...new Set(chosenIds)]);
  }

  async function analyze(): Promise<void> {
    const leads = await store.companies(tenantId, campaignId);
    const searches = await store.searchCoverage(tenantId, campaignId);
    for (const [index, lead] of leads.entries()) {
      await stillRunning();
      await progress(
        `Analisando ${index + 1} de ${leads.length}: ${lead.name}`,
        40 + Math.floor((50 * (index + 1)) / Math.max(1, leads.length)),
      );
      let fit: Fit = localFit(lead, config.niche);
      if (config.source !== 'demo' && config.useJev && settings.jevKey) {
        const saved = await store.reusableFit(tenantId, lead.id, normalized(config.niche), days);
        if (saved) {
          if (saved.evaluatedAt) reused.push(saved.evaluatedAt);
          fit = saved;
        } else {
          try {
            fit = await providers.classify(recorder, lead, config.niche);
          } catch (error) {
            if (!hasOwnMessage(error)) throw error;
            warnings.push(`Jev: ${error.message}`);
            fit = { choice: 'unknown', confidence: null, method: 'error', model: null };
          }
        }
      } else if (config.source !== 'demo' && config.useJev) {
        warnings.push('Jev não configurado: classificação por regras locais, sujeita a revisão.');
      }
      if (lead.regionReview) fit = { ...fit, choice: 'unknown', regionReview: true };
      fits.set(lead.id, fit);
      await store.setAnalysis(tenantId, campaignId, lead.id, scoreLead(lead, lead.observations ?? [], fit, config.service, null, searches));
      await stillRunning();
      if (config.source === 'live' && config.enrich && !['confirmed', 'rejected'].includes(lead.instagramStatus)) {
        await enrichInstagram(lead);
      }
    }
  }

  async function enrichInstagram(lead: store.Company): Promise<void> {
    // Erro do provedor também custa uma chamada: espera 1 dia antes de pagar de novo.
    const retryDays = lead.instagramStatus === 'error' ? ERROR_RETRY_DAYS : days;
    if (['candidate', 'not_found', 'error'].includes(lead.instagramStatus) && isFresh(lead.instagramSearchedAt, retryDays)) {
      reused.push(lead.instagramSearchedAt as string);
      return;
    }
    try {
      const found = await providers.instagram(recorder, lead, config.city, config.coordinates[0] ?? null);
      await store.patchCompanyData(tenantId, lead.id, found);
    } catch (error) {
      if (!hasOwnMessage(error)) throw error;
      warnings.push(`Instagram: ${error.message}`);
      await store.patchCompanyData(tenantId, lead.id, { instagramStatus: 'error', instagramSearchedAt: new Date().toISOString() });
    }
  }
}

async function collectDemo(
  tenantId: string,
  campaignId: string,
  config: CampaignConfig,
  stillRunning: () => Promise<void>,
): Promise<void> {
  for (const [i, lead] of demoLeads(config).entries()) {
    await stillRunning();
    for (const [offset, query] of config.keywords.entries()) {
      if (offset && i % 3 === 1) continue; // Ausência fictícia, para o painel mostrar buscas sem cobertura.
      await store.upsertCompany(tenantId, campaignId, lead, 'demo', {
        query,
        location: config.city,
        rank: lead.rank + offset,
        depth: DEMO_DEPTH,
        observedAt: new Date().toISOString(),
        sourceUrl: null,
      });
    }
  }
  for (const query of config.keywords) await store.recordSearch(tenantId, campaignId, query, config.city, DEMO_DEPTH);
}

// ---------------------------------------------------------------- fila e worker

/** Ao subir o processo: nada em andamento sobrevive ao reinício e nenhuma chamada pendente é refeita. */
export async function recover(): Promise<void> {
  await db('lh_campaigns')
    .whereIn('state', ['running', 'importing'])
    .update({ state: 'interrupted', message: RESTART_MESSAGE, updated_at: db.fn.now() });
  await db('lh_api_calls').where({ state: 'pending' }).update({ state: 'unknown' });
}

/** Reserva a campanha `queued` mais antiga de um workspace com a flag ligada, roda e devolve o id. */
export async function runNext(providers: Providers, settings: Settings, signal?: AbortSignal): Promise<string | null> {
  const { rows } = await db.raw(
    `UPDATE lh_campaigns SET state = 'running', updated_at = now()
     WHERE id = (
       SELECT c.id FROM lh_campaigns c JOIN tenants t ON t.id = c.tenant_id
       WHERE c.state = 'queued' AND t.leadhunter_enabled
       ORDER BY c.created_at, c.id
       LIMIT 1
       FOR UPDATE OF c SKIP LOCKED
     )
     RETURNING id, tenant_id`,
  );
  if (!rows.length) return null;
  const { id, tenant_id: tenantId } = rows[0] as { id: string; tenant_id: string };
  await runCampaign(tenantId, id, providers, settings, signal);
  return id;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
  });

// ponytail: recover() no boot supõe uma única instância no Railway; com réplicas, seria preciso um dono por instância (spec 7.2).
export function startWorker(opts: { providers?: Providers; settings?: Settings; idleMs?: number } = {}): { stop(): Promise<void> } {
  const settings = opts.settings ?? loadSettings();
  const providers = opts.providers ?? createProviders(settings);
  const idleMs = opts.idleMs ?? 1000;
  const stopping = new AbortController();

  const loop = (async () => {
    let recovered = false;
    while (!stopping.signal.aborted) {
      let ran: string | null = null;
      try {
        // Sem recover() bem-sucedido a fila não anda: campanhas presas em running seriam ignoradas.
        if (!recovered) {
          await recover();
          recovered = true;
        }
        ran = await runNext(providers, settings, stopping.signal);
      } catch (error) {
        console.error(recovered ? '[leadhunter] worker falhou' : '[leadhunter] recover falhou', error);
      }
      if (!ran) await sleep(idleMs, stopping.signal);
    }
  })();

  return {
    async stop() {
      stopping.abort();
      await loop;
    },
  };
}
