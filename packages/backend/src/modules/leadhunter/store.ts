import type { Knex } from 'knex';
import { db } from '../../db';
import {
  identity,
  isFresh,
  type Analysis,
  type CallRecorder,
  type CampaignConfig,
  type CompanyData,
  type ExportRow,
  type Fit,
  type Observation,
  type SearchDone,
  type Source,
  type Stage,
} from './domain';

// Armazenamento do LeadHunter em Postgres (port de radar/storage.py do LeadHunter).
// Regra de ouro: todo `tenantId` vem primeiro e toda consulta filtra `tenant_id`. As tabelas filhas
// (observações, chamadas, buscas...) só são alcançadas por uma campanha/empresa já filtrada por tenant.
// Única função global: callsToday() (o limite diário de chamadas é compartilhado entre workspaces).

export type CampaignState =
  | 'importing'
  | 'queued'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

export interface Campaign {
  id: string;
  createdAt: string;
  updatedAt: string;
  config: CampaignConfig & { leadRequestId?: string };
  state: CampaignState;
  message: string;
  progress: number;
  cancelRequested: boolean;
  warnings: string[];
  createdBy: string | null;
}

export interface CrmResult {
  contactId: string | null;
  status: 'imported' | 'duplicate' | 'error';
  sentAt: string;
  ownerId: string | null;
  error?: string;
}

export interface Company extends CompanyData {
  id: string;
  identity: string;
  source: Source;
  stage: Stage;
  notes: string;
  crm: CrmResult | null;
  analysis?: Analysis;
  observations?: Observation[];
}

export interface FoundCompany {
  id: string;
  name: string | null;
  category: string | null;
  city: string | null;
  phone: string | null;
  rating: number | null;
  reviews: number | null;
  campaigns: number;
  firstSeen: string;
  crmStatus: CrmResult['status'] | null;
  demo: boolean;
}

export interface SearchRow {
  id: string;
  provider: string;
  operation: string;
  cacheKey: string;
  keyword: string;
  location: string;
  depth: number;
  campaignId: string | null;
  executedAt: string;
  resultCount: number;
  cost: number | null;
  reuseCount: number;
  lastReusedAt: string | null;
}

export interface SearchCoverage extends SearchDone {
  observedAt: string;
}

type Executor = Knex | Knex.Transaction;
type Json = Record<string, unknown>;

export const LIMIT_MESSAGE = 'Limite de chamadas atingido. Resultados anteriores foram preservados.';
const COMPANY_NOT_FOUND = 'Empresa não encontrada.';
const CAMPAIGN_NOT_FOUND = 'Campanha não encontrada.';
const CALLS_LOCK = "pg_advisory_xact_lock(hashtext('leadhunter_api_calls'))";
// Início do dia UTC, calculado pelo relógio do banco (o mesmo que carimba created_at)
const UTC_DAY_START = "date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'";
const DAY_MS = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVENANCE_FIELDS = ['name', 'category', 'address', 'city', 'phone', 'website', 'rating', 'reviews', 'instagram'] as const;
const INSTAGRAM_FIELDS = ['instagram', 'instagramStatus', 'instagramSource', 'instagramVerifiedAt'] as const;

const iso = (value: Date | string): string => (value instanceof Date ? value.toISOString() : value);
const isoOrNull = (value: Date | string | null): string | null => (value === null ? null : iso(value));
// Sempre texto: o driver enviaria um array JS como array do Postgres, não como jsonb
const json = (value: unknown): string => JSON.stringify(value);
const numberOrNull = (value: string | number | null): number | null => (value === null ? null : Number(value));

async function requireCampaign(tenantId: string, campaignId: string, trx: Executor = db): Promise<void> {
  const row = UUID.test(campaignId)
    ? await trx('lh_campaigns').where({ tenant_id: tenantId, id: campaignId }).first('id')
    : undefined;
  if (!row) throw new Error(CAMPAIGN_NOT_FOUND);
}

function toCampaign(row: Json): Campaign {
  return {
    id: row.id as string,
    createdAt: iso(row.created_at as Date),
    updatedAt: iso(row.updated_at as Date),
    config: row.config as Campaign['config'],
    state: row.state as CampaignState,
    message: row.message as string,
    progress: row.progress as number,
    cancelRequested: row.cancel_requested as boolean,
    warnings: row.warnings as string[],
    createdBy: (row.created_by as string | null) ?? null,
  };
}

function toObservation(row: Json): Observation {
  return {
    query: row.query as string,
    location: row.location as string,
    rank: (row.rank as number | null) ?? null,
    depth: row.depth as number,
    observedAt: iso(row.observed_at as Date),
    sourceUrl: (row.source_url as string | null) ?? null,
  };
}

function toCompany(row: Json): Company {
  return {
    ...(row.data as CompanyData),
    id: row.id as string,
    identity: row.identity as string,
    source: row.source as Source,
    stage: row.stage as Stage,
    notes: row.notes as string,
    crm: (row.crm as CrmResult | null) ?? null,
  };
}

const hasAnalysis = (analysis: unknown): analysis is Analysis =>
  typeof analysis === 'object' && analysis !== null && Object.keys(analysis).length > 0;

// ---------------------------------------------------------------- campanhas

export async function createCampaign(
  tenantId: string,
  config: Campaign['config'],
  opts: { state?: 'queued' | 'importing'; createdBy?: string | null } = {},
): Promise<string> {
  const [row] = await db('lh_campaigns')
    .insert({ tenant_id: tenantId, config: json(config), state: opts.state ?? 'queued', created_by: opts.createdBy ?? null })
    .returning('id');
  return row.id as string;
}

export async function getCampaign(tenantId: string, id: string): Promise<Campaign | null> {
  if (!UUID.test(id)) return null;
  const row = await db('lh_campaigns').where({ tenant_id: tenantId, id }).first();
  return row ? toCampaign(row) : null;
}

export async function listCampaigns(tenantId: string, limit = 200): Promise<Campaign[]> {
  const rows = await db('lh_campaigns').where({ tenant_id: tenantId }).orderBy('created_at', 'desc').orderBy('id', 'desc').limit(limit);
  return rows.map(toCampaign);
}

export async function updateCampaign(
  tenantId: string,
  id: string,
  fields: Partial<Pick<Campaign, 'state' | 'message' | 'progress' | 'cancelRequested' | 'warnings'>>,
): Promise<void> {
  const patch: Json = { updated_at: db.fn.now() };
  if (fields.state !== undefined) patch.state = fields.state;
  if (fields.message !== undefined) patch.message = fields.message;
  if (fields.progress !== undefined) patch.progress = fields.progress;
  if (fields.cancelRequested !== undefined) patch.cancel_requested = fields.cancelRequested;
  if (fields.warnings !== undefined) patch.warnings = json(fields.warnings);
  await db('lh_campaigns').where({ tenant_id: tenantId, id }).update(patch);
}

// ---------------------------------------------------------------- empresas

/** Procedência por campo: de onde veio cada informação preenchida pelo lead recebido. */
function incomingProvenance(lead: Partial<CompanyData>, source: Source, now: string): CompanyData['fieldSources'] {
  const sources: CompanyData['fieldSources'] = {};
  for (const field of PROVENANCE_FIELDS) {
    const value = lead[field];
    if (value !== null && value !== undefined && value !== '') {
      sources[field] = { source, url: lead.sourceUrl || lead.mapsUrl || null, observedAt: lead.collectedAt || now };
    }
  }
  return sources;
}

/** Regras de mescla do upsert_lead: o dado novo (não nulo) vence, exceto o Instagram revisado à mão. */
function mergeCompany(old: Json, lead: Json, incoming: CompanyData['fieldSources'], now: string): Json {
  const incomingSources = { ...incoming };
  const incomingLead = { ...lead };
  if (
    ['candidate', 'not_found', 'error'].includes(old.instagramStatus as string) &&
    incomingLead.instagramStatus === 'not_searched'
  ) {
    delete incomingLead.instagramStatus;
  }
  const manual: Json = {};
  if (['confirmed', 'rejected'].includes(old.instagramStatus as string)) {
    for (const field of INSTAGRAM_FIELDS) manual[field] = old[field] ?? null;
    delete incomingSources.instagram;
  }
  const provenance = { ...((old.fieldSources as CompanyData['fieldSources']) ?? {}), ...incomingSources };
  const present = Object.fromEntries(Object.entries(incomingLead).filter(([, v]) => v !== null && v !== undefined));
  return { ...old, ...present, ...manual, fieldSources: provenance, updatedAt: now };
}

export async function upsertCompany(
  tenantId: string,
  campaignId: string,
  lead: Partial<CompanyData>,
  source: Source,
  observation?: Observation,
): Promise<string> {
  const key = identity(
    { placeId: lead.placeId ?? null, name: lead.name ?? '', address: lead.address ?? null, city: lead.city ?? null },
    source,
  );
  const now = new Date().toISOString();
  const incoming = incomingProvenance(lead, source, now);

  return db.transaction(async (trx) => {
    await requireCampaign(tenantId, campaignId, trx);

    const lockExisting = () =>
      trx('lh_companies').where({ tenant_id: tenantId, identity: key }).forUpdate().first('id', 'data');
    const merge = async (existing: Json): Promise<string> => {
      const data = mergeCompany(existing.data as Json, lead as Json, incoming, now);
      await trx('lh_companies')
        .where({ tenant_id: tenantId, id: existing.id as string })
        .update({ data: json(data), source, updated_at: trx.fn.now() });
      return existing.id as string;
    };

    let companyId: string;
    const existing = await lockExisting();
    if (existing) {
      companyId = await merge(existing);
    } else {
      const created = await trx('lh_companies')
        .insert({
          tenant_id: tenantId,
          identity: key,
          source,
          data: json({ ...lead, fieldSources: incoming, updatedAt: now }),
        })
        .onConflict(['tenant_id', 'identity'])
        .ignore()
        .returning('id');
      // Outro upsert criou a mesma empresa entre o select e o insert: mescla em cima dela
      companyId = created.length ? (created[0].id as string) : await merge((await lockExisting()) as Json);
    }

    await trx('lh_campaign_companies')
      .insert({ tenant_id: tenantId, campaign_id: campaignId, company_id: companyId })
      .onConflict(['campaign_id', 'company_id'])
      .ignore();
    if (observation) {
      await trx('lh_observations')
        .insert({
          tenant_id: tenantId,
          campaign_id: campaignId,
          company_id: companyId,
          query: observation.query,
          location: observation.location,
          rank: observation.rank ?? null,
          depth: observation.depth,
          observed_at: observation.observedAt ?? now,
          source_url: observation.sourceUrl ?? null,
        })
        .onConflict(['campaign_id', 'company_id', 'query', 'location'])
        .ignore();
    }
    return companyId;
  });
}

/** Marca uma busca como concluída para que as ausências possam ser contadas. */
export async function recordSearch(
  tenantId: string,
  campaignId: string,
  query: string,
  location: string,
  depth: number,
  observedAt?: string,
): Promise<void> {
  await requireCampaign(tenantId, campaignId);
  await db('lh_search_coverage')
    .insert({
      tenant_id: tenantId,
      campaign_id: campaignId,
      query,
      location,
      depth,
      observed_at: observedAt ?? new Date().toISOString(),
    })
    .onConflict(['campaign_id', 'query', 'location'])
    .ignore();
}

export async function searchCoverage(tenantId: string, campaignId: string): Promise<SearchCoverage[]> {
  // ponytail: sem sequência na tabela, a ordem é por data (e termo); a cobertura só é lida como conjunto
  const rows = await db('lh_search_coverage')
    .where({ tenant_id: tenantId, campaign_id: campaignId })
    .orderBy('observed_at')
    .orderBy('query')
    .orderBy('location');
  return rows.map((r) => ({ query: r.query, location: r.location, depth: r.depth, observedAt: iso(r.observed_at) }));
}

/** Empresas da campanha com análise e observações, da maior pontuação para a menor. */
export async function companies(tenantId: string, campaignId: string, trx?: Knex.Transaction): Promise<Company[]> {
  const q: Executor = trx ?? db;
  const rows = await q('lh_campaign_companies as cc')
    .join('lh_companies as c', function join() {
      this.on('c.id', 'cc.company_id').andOn('c.tenant_id', 'cc.tenant_id');
    })
    .where({ 'cc.tenant_id': tenantId, 'cc.campaign_id': campaignId })
    .orderBy('cc.position')
    .select('c.*', 'cc.analysis');
  const observations = await q('lh_observations')
    .where({ tenant_id: tenantId, campaign_id: campaignId })
    .orderBy('observed_at')
    .orderBy('query')
    .orderBy('location');
  const byCompany = new Map<string, Observation[]>();
  for (const o of observations) {
    byCompany.set(o.company_id, [...(byCompany.get(o.company_id) ?? []), toObservation(o)]);
  }
  const score = (c: Company) => c.analysis?.score ?? 0;
  return rows
    .map((row) => ({
      ...toCompany(row),
      analysis: hasAnalysis(row.analysis) ? row.analysis : undefined,
      observations: byCompany.get(row.id) ?? [],
    }))
    .sort((a, b) => score(b) - score(a));
}

export async function getCompany(tenantId: string, id: string): Promise<Company | null> {
  if (!UUID.test(id)) return null;
  const row = await db('lh_companies').where({ tenant_id: tenantId, id }).first();
  return row ? toCompany(row) : null;
}

export async function patchCompanyData(tenantId: string, id: string, values: Partial<CompanyData>): Promise<void> {
  const updated = await db('lh_companies')
    .where({ tenant_id: tenantId, id })
    .update({ data: db.raw('data || ?::jsonb', [json(values)]), updated_at: db.fn.now() });
  if (!updated) throw new Error(COMPANY_NOT_FOUND);
}

export async function updateCompany(
  tenantId: string,
  id: string,
  fields: { stage?: Stage; notes?: string },
): Promise<void> {
  const patch: Json = { updated_at: db.fn.now() };
  if (fields.stage !== undefined) patch.stage = fields.stage;
  if (fields.notes !== undefined) patch.notes = fields.notes;
  await db('lh_companies').where({ tenant_id: tenantId, id }).update(patch);
}

export async function setAnalysis(tenantId: string, campaignId: string, companyId: string, analysis: Analysis): Promise<void> {
  await db('lh_campaign_companies')
    .where({ tenant_id: tenantId, campaign_id: campaignId, company_id: companyId })
    .update({ analysis: json(analysis) });
}

/** Mantém só `ids` na campanha; empresas soltas, sem estágio nem notas e sem outra campanha, saem do banco. */
export async function keepCampaignCompanies(tenantId: string, campaignId: string, ids: string[]): Promise<void> {
  await db.transaction(async (trx) => {
    const current = await trx('lh_campaign_companies').where({ tenant_id: tenantId, campaign_id: campaignId }).pluck('company_id');
    const removed = (current as string[]).filter((id) => !ids.includes(id));
    if (!removed.length) return;
    await trx('lh_observations').where({ tenant_id: tenantId, campaign_id: campaignId }).whereIn('company_id', removed).delete();
    await trx('lh_campaign_companies').where({ tenant_id: tenantId, campaign_id: campaignId }).whereIn('company_id', removed).delete();
    await trx('lh_companies')
      .where({ tenant_id: tenantId, stage: 'new', notes: '' })
      .whereIn('id', removed)
      .whereNotExists(function orphan() {
        this.select(trx.raw('1'))
          .from('lh_campaign_companies as cc')
          .whereRaw('cc.company_id = lh_companies.id')
          .andWhere('cc.tenant_id', tenantId);
      })
      .delete();
  });
}

export async function campaignsForCompany(tenantId: string, companyId: string): Promise<{ id: string; state: string }[]> {
  const rows = await db('lh_campaign_companies as cc')
    .join('lh_campaigns as c', function join() {
      this.on('c.id', 'cc.campaign_id').andOn('c.tenant_id', 'cc.tenant_id');
    })
    .where({ 'cc.tenant_id': tenantId, 'cc.company_id': companyId })
    .orderBy('c.created_at')
    .select('c.id', 'c.state');
  return rows.map((r) => ({ id: r.id, state: r.state }));
}

export async function deleteCompany(tenantId: string, id: string): Promise<void> {
  await db('lh_companies').where({ tenant_id: tenantId, id }).delete();
}

/** Posições observadas de uma empresa em todas as campanhas, da mais antiga para a mais nova. */
export async function history(
  tenantId: string,
  companyId: string,
): Promise<(Observation & { campaignId: string; niche: string })[]> {
  const rows = await db('lh_observations as o')
    .join('lh_campaigns as c', function join() {
      this.on('c.id', 'o.campaign_id').andOn('c.tenant_id', 'o.tenant_id');
    })
    .where({ 'o.tenant_id': tenantId, 'o.company_id': companyId })
    .orderBy('o.observed_at')
    .orderBy('o.query')
    .orderBy('o.location')
    .select('o.*', db.raw("c.config->>'niche' as niche"));
  return rows.map((r) => ({ ...toObservation(r), campaignId: r.campaign_id, niche: r.niche }));
}

/** Uma linha por empresa (sem repetir entre campanhas), da mais nova para a mais antiga. */
export async function foundCompanies(
  tenantId: string,
  opts: { includeDemo: boolean; limit?: number },
): Promise<{ rows: FoundCompany[]; truncated: boolean }> {
  const limit = opts.limit ?? 2000;
  const query = db('lh_companies as c')
    .where('c.tenant_id', tenantId)
    .orderBy('c.created_at', 'desc')
    .orderBy('c.id', 'desc')
    .limit(limit + 1)
    .select(
      'c.id',
      'c.data',
      'c.crm',
      'c.source',
      'c.created_at',
      db.raw(
        '(select count(*) from lh_campaign_companies cc where cc.company_id = c.id and cc.tenant_id = c.tenant_id)::int as campaigns',
      ),
    );
  if (!opts.includeDemo) query.andWhereNot('c.source', 'demo');
  const found = await query;
  return {
    rows: found.slice(0, limit).map((r) => ({
      id: r.id,
      name: r.data.name ?? null,
      category: r.data.category ?? null,
      city: r.data.city ?? null,
      phone: r.data.phone ?? null,
      rating: r.data.rating ?? null,
      reviews: r.data.reviews ?? null,
      campaigns: r.campaigns,
      firstSeen: iso(r.created_at),
      crmStatus: r.crm?.status ?? null,
      demo: r.source === 'demo',
    })),
    truncated: found.length > limit,
  };
}

/**
 * Empresas no formato da exportação, com a análise da campanha mais recente. `ids` ausente = todas
 * as reais; ids desconhecidos (ou que não sejam uuid) são ignorados.
 */
export async function exportRows(tenantId: string, ids?: string[]): Promise<ExportRow[]> {
  const query = db('lh_companies').where({ tenant_id: tenantId }).orderBy('created_at', 'desc').orderBy('id', 'desc');
  if (ids) query.whereIn('id', ids.filter((id) => UUID.test(id)));
  else query.andWhereNot('source', 'demo');
  const rows = await query;
  if (!rows.length) return [];
  const found = rows.map((r) => r.id as string);

  const links = await db('lh_campaign_companies').where({ tenant_id: tenantId }).whereIn('company_id', found).orderBy('position');
  const analysisOf = new Map<string, unknown>(links.map((l) => [l.company_id, l.analysis]));
  const observations = await db('lh_observations')
    .where({ tenant_id: tenantId })
    .whereIn('company_id', found)
    .orderBy('observed_at')
    .orderBy('query')
    .orderBy('location');
  const observationsOf = new Map<string, Observation[]>();
  for (const o of observations) {
    observationsOf.set(o.company_id, [...(observationsOf.get(o.company_id) ?? []), toObservation(o)]);
  }

  return rows.map((row) => {
    const analysis = analysisOf.get(row.id);
    return {
      company: { ...(row.data as CompanyData), source: row.source, stage: row.stage, notes: row.notes },
      analysis: hasAnalysis(analysis) ? analysis : null,
      observations: observationsOf.get(row.id) ?? [],
    };
  });
}

export async function setCrm(tenantId: string, companyId: string, crm: CrmResult, trx?: Knex.Transaction): Promise<void> {
  const updated = await (trx ?? db)('lh_companies')
    .where({ tenant_id: tenantId, id: companyId })
    .update({ crm: json(crm), updated_at: db.fn.now() });
  if (!updated) throw new Error(COMPANY_NOT_FOUND);
}

// ---------------------------------------------------------------- chamadas de API

/** Chamadas de todos os workspaces desde o início do dia UTC (limite diário global). */
export async function callsToday(): Promise<number> {
  const { rows } = await db.raw(`select count(*)::int as n from lh_api_calls where created_at >= ${UTC_DAY_START}`);
  return rows[0].n;
}

/**
 * Reserva e fecha chamadas pagas. A reserva é uma transação sob uma trava global: sem ela, duas
 * reservas simultâneas com uma vaga restante passariam as duas.
 */
export function callRecorder(tenantId: string, campaignId: string, runLimit: number, dailyLimit: number): CallRecorder {
  return {
    async reserve({ provider, operation }) {
      await requireCampaign(tenantId, campaignId);
      return db.transaction(async (trx) => {
        await trx.raw(`select ${CALLS_LOCK}`);
        const run = await trx('lh_api_calls').where({ tenant_id: tenantId, campaign_id: campaignId }).count({ n: '*' }).first();
        const day = await trx.raw(`select count(*)::int as n from lh_api_calls where created_at >= ${UTC_DAY_START}`);
        if (Number(run?.n) >= runLimit || day.rows[0].n >= dailyLimit) throw new Error(LIMIT_MESSAGE);
        const [row] = await trx('lh_api_calls')
          .insert({ tenant_id: tenantId, campaign_id: campaignId, provider, operation })
          .returning('id');
        return row.id as string;
      });
    },
    async finish(callId, r) {
      await db('lh_api_calls')
        .where({ tenant_id: tenantId, campaign_id: campaignId, id: callId })
        .update({ state: r.state, cost: r.cost ?? null, tokens: r.tokens ?? null, model: r.model ?? null });
    },
  };
}

export async function usage(
  tenantId: string,
  campaignId: string,
): Promise<{ provider: string; calls: number; cost: number; tokens: number; incomplete: number }[]> {
  const rows = await db('lh_api_calls')
    .where({ tenant_id: tenantId, campaign_id: campaignId })
    .groupBy('provider')
    .orderBy('provider')
    .select(
      'provider',
      db.raw('count(*)::int as calls'),
      db.raw('coalesce(sum(cost), 0) as cost'),
      db.raw('coalesce(sum(tokens), 0) as tokens'),
      db.raw("(count(*) filter (where state <> 'success'))::int as incomplete"),
    );
  return rows.map((r) => ({
    provider: r.provider,
    calls: r.calls,
    cost: Number(r.cost),
    tokens: Number(r.tokens),
    incomplete: r.incomplete,
  }));
}

// ---------------------------------------------------------------- cache de buscas

export async function saveSearch(
  tenantId: string,
  s: {
    campaignId: string;
    provider: string;
    operation: string;
    cacheKey: string;
    keyword: string;
    location: string;
    depth: number;
    results: Partial<CompanyData>[];
    cost: number | null;
  },
): Promise<void> {
  await requireCampaign(tenantId, s.campaignId);
  const results = s.results.slice(0, s.depth);
  await db('lh_searches').insert({
    tenant_id: tenantId,
    campaign_id: s.campaignId,
    provider: s.provider,
    operation: s.operation,
    cache_key: s.cacheKey,
    keyword: s.keyword,
    location: s.location,
    depth: s.depth,
    result_count: results.length,
    cost: s.cost,
    results: json(results),
  });
}

export async function reusableSearch(
  tenantId: string,
  cacheKey: string,
  depth: number,
  days: number,
): Promise<{ id: string; executedAt: string; results: Partial<CompanyData>[] } | null> {
  const row = await db('lh_searches')
    .where({ tenant_id: tenantId, cache_key: cacheKey })
    .andWhere('depth', '>=', depth)
    .andWhere('executed_at', '>=', new Date(Date.now() - days * DAY_MS))
    .orderBy('executed_at', 'desc')
    .orderBy('id', 'desc')
    .first();
  if (!row) return null;
  return { id: row.id, executedAt: iso(row.executed_at), results: (row.results as Partial<CompanyData>[]).slice(0, depth) };
}

export async function markSearchReused(tenantId: string, id: string): Promise<void> {
  await db('lh_searches')
    .where({ tenant_id: tenantId, id })
    .update({ reuse_count: db.raw('reuse_count + 1'), last_reused_at: db.fn.now() });
}

/** Histórico de buscas pagas, sem o conteúdo (`results`). */
export async function listSearches(tenantId: string, limit = 500): Promise<SearchRow[]> {
  const rows = await db('lh_searches')
    .where({ tenant_id: tenantId })
    .orderBy('executed_at', 'desc')
    .orderBy('id', 'desc')
    .limit(limit)
    .select(
      'id',
      'provider',
      'operation',
      'cache_key',
      'keyword',
      'location',
      'depth',
      'campaign_id',
      'executed_at',
      'result_count',
      'cost',
      'reuse_count',
      'last_reused_at',
    );
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    operation: r.operation,
    cacheKey: r.cache_key,
    keyword: r.keyword,
    location: r.location,
    depth: r.depth,
    campaignId: r.campaign_id,
    executedAt: iso(r.executed_at),
    resultCount: r.result_count,
    cost: numberOrNull(r.cost),
    reuseCount: r.reuse_count,
    lastReusedAt: isoOrNull(r.last_reused_at),
  }));
}

/** Resposta de enquadramento do Jev ainda válida para o nicho, da campanha mais recente para a mais antiga. */
export async function reusableFit(tenantId: string, companyId: string, nicheKey: string, days: number): Promise<Fit | null> {
  const rows = await db('lh_campaign_companies')
    .where({ tenant_id: tenantId, company_id: companyId })
    .orderBy('position', 'desc')
    .pluck('analysis');
  for (const analysis of rows as Partial<Analysis>[]) {
    const fit = analysis.fit;
    if (fit?.method === 'jev' && fit.niche === nicheKey && !fit.regionReview && isFresh(fit.evaluatedAt, days)) return fit;
  }
  return null;
}
