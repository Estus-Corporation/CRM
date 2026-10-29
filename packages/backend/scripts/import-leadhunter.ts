/**
 * Importa o histórico do Radar Local (JSON gerado por LeadHunter/scripts/export_for_crm.py) para as
 * tabelas `lh_*` de UM workspace.
 *
 * Uso (de packages/backend):
 *   tsx scripts/import-leadhunter.ts --tenant <uuid> --file <json> [--confirm]
 *
 * Só insere, nunca atualiza; rodar de novo não duplica nada. Tudo roda numa transação só.
 * Sem `--confirm` o script apenas mostra o banco de destino e sai sem gravar. O banco vem do
 * DATABASE_URL (o `.env` local do backend pode apontar para produção: passe a variável só no processo
 * e confira o destino impresso antes de confirmar).
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import type { Knex } from 'knex';
import { env } from '../src/config/env';
import { db } from '../src/db';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface RadarExport {
  format: number;
  campaigns: Row[];
  leads: Row[];
  campaign_leads: Row[];
  observations: Row[];
  search_coverage: Row[];
  searches: Row[];
  api_calls: Row[];
}

export interface TableCount {
  inserted: number;
  skipped: number;
}

export interface ImportReport {
  campaigns: TableCount;
  companies: TableCount;
  campaignCompanies: TableCount;
  observations: TableCount;
  searchCoverage: TableCount;
  searches: TableCount;
  apiCalls: TableCount;
  /** Campanhas do Radar que estavam na fila/rodando e entraram como `interrupted` (nenhuma roda sozinha) */
  neutralized: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;
const CHUNK = 200;
// Mesmo texto do recover() do Radar para o que estava em andamento
const INTERRUPTED_MESSAGE = 'Execução interrompida pelo reinício. Resultados preservados.';
const NEVER_RAN_MESSAGE = 'Campanha estava na fila do Radar Local e não foi executada. Crie de novo se ainda quiser.';

const json = (value: unknown): string => JSON.stringify(value);
const camel = (key: string): string => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** snake_case -> camelCase em todas as chaves (objetos aninhados e listas); valores ficam como estão. */
function camelKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [camel(k), camelKeys(v)]));
  }
  return value;
}

/** Datas do Radar são ISO em UTC; sem fuso, o Postgres leria no fuso da sessão. */
const ts = (value: string | null | undefined): string | null => {
  if (!value) return null;
  return HAS_ZONE.test(value) ? value : `${value}Z`;
};

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Resultado do envio ao CRM no formato do CRM (CrmResult); o e-mail do dono não vira ownerId. */
function toCrm(crm: Row | null): Row | null {
  if (!crm) return null;
  return {
    contactId: crm.contact_id ?? null,
    status: crm.status,
    sentAt: crm.sent_at ?? null,
    ownerId: null,
    ...(crm.message ? { error: crm.message } : {}),
  };
}

function assertExport(data: RadarExport): void {
  if (data?.format !== 1) throw new Error('Arquivo não é uma exportação do Radar Local (format 1).');
  for (const key of ['campaigns', 'leads', 'campaign_leads', 'observations', 'search_coverage', 'searches', 'api_calls'] as const) {
    if (!Array.isArray(data[key])) throw new Error(`Exportação inválida: falta a lista "${key}".`);
  }
}

async function run(trx: Knex.Transaction, tenantId: string, data: RadarExport): Promise<ImportReport> {
  const tenant = await trx('tenants').where({ id: tenantId }).first('id');
  if (!tenant) throw new Error(`Workspace ${tenantId} não existe.`);

  const report: ImportReport = {
    campaigns: { inserted: 0, skipped: 0 },
    companies: { inserted: 0, skipped: 0 },
    campaignCompanies: { inserted: 0, skipped: 0 },
    observations: { inserted: 0, skipped: 0 },
    searchCoverage: { inserted: 0, skipped: 0 },
    searches: { inserted: 0, skipped: 0 },
    apiCalls: { inserted: 0, skipped: 0 },
    neutralized: 0,
  };

  // ---- campanhas: a origem (config.radarId) decide se já foi importada
  const radarIds = data.campaigns.map((c) => c.id as string);
  // `?` com array vira lista de parâmetros no knex: monta-se o IN à mão (e sem campanhas não há o que consultar)
  const existing = radarIds.length
    ? await trx('lh_campaigns')
        .where({ tenant_id: tenantId })
        .whereRaw(`config->>'radarId' in (${radarIds.map(() => '?').join(',')})`, radarIds)
        .select('id', trx.raw("config->>'radarId' as radar_id"))
    : [];
  const campaignOf = new Map<string, string>(existing.map((r: Row) => [r.radar_id as string, r.id as string]));
  const fresh = new Set<string>();

  const campaignRows: Row[] = [];
  for (const c of data.campaigns) {
    if (campaignOf.has(c.id)) {
      report.campaigns.skipped += 1;
      continue;
    }
    // Nada do Radar pode executar sozinho no CRM (e gastar crédito) depois que a flag ligar
    const neverRan = c.state === 'queued';
    const wasRunning = c.state === 'running' || c.state === 'importing';
    const neutral = neverRan || wasRunning;
    if (neutral) report.neutralized += 1;
    const id = randomUUID();
    campaignOf.set(c.id, id);
    fresh.add(c.id);
    campaignRows.push({
      id,
      tenant_id: tenantId,
      config: json({ ...(camelKeys(c.config) as Row), radarId: c.id }),
      state: neutral ? 'interrupted' : c.state,
      message: neverRan ? NEVER_RAN_MESSAGE : wasRunning ? INTERRUPTED_MESSAGE : c.message,
      progress: c.progress,
      cancel_requested: neutral ? false : !!c.cancel_requested,
      warnings: json(c.warnings ?? []),
      created_by: null,
      created_at: ts(c.created_at),
      updated_at: ts(c.updated_at),
    });
  }
  for (const part of chunks(campaignRows)) await trx('lh_campaigns').insert(part);
  report.campaigns.inserted = campaignRows.length;

  // ---- empresas: ON CONFLICT DO NOTHING em (tenant_id, identity); identity = id do lead no SQLite
  const companyRows = data.leads.map((lead) => {
    const { id: _id, source, ...rest } = lead.data as Row;
    if (!['demo', 'live', 'import'].includes(source)) throw new Error(`Empresa ${lead.id}: origem "${source}" inválida.`);
    return {
      tenant_id: tenantId,
      identity: lead.id as string,
      source,
      data: json(camelKeys(rest)),
      stage: lead.stage,
      notes: lead.notes ?? '',
      crm: lead.crm ? json(toCrm(lead.crm)) : null,
      created_at: ts(lead.created_at),
      updated_at: ts(lead.updated_at),
    };
  });
  for (const part of chunks(companyRows)) {
    const inserted = await trx('lh_companies').insert(part).onConflict(['tenant_id', 'identity']).ignore().returning('id');
    report.companies.inserted += inserted.length;
  }
  report.companies.skipped = companyRows.length - report.companies.inserted;
  const companyOf = new Map<string, string>();
  for (const part of chunks(companyRows.map((r) => r.identity))) {
    const found = await trx('lh_companies').where({ tenant_id: tenantId }).whereIn('identity', part).select('id', 'identity');
    for (const r of found) companyOf.set(r.identity as string, r.id as string);
  }

  // ---- filhas de campanha: só das campanhas criadas agora (as já importadas ficam como estão)
  const linked = <T extends Row>(rows: T[], count: TableCount): (T & { _campaign: string; _company?: string })[] => {
    const kept = rows.filter((r) => fresh.has(r.campaign_id) && (r.lead_id === undefined || companyOf.has(r.lead_id)));
    count.skipped += rows.length - kept.length;
    return kept.map((r) => ({ ...r, _campaign: campaignOf.get(r.campaign_id) as string, _company: companyOf.get(r.lead_id) }));
  };
  const insertAll = async (table: string, rows: Row[], conflict: string[] | null, count: TableCount) => {
    for (const part of chunks(rows)) {
      const q = trx(table).insert(part);
      const done = await (conflict ? q.onConflict(conflict).ignore() : q).returning('tenant_id');
      count.inserted += done.length;
    }
  };

  const links = linked(data.campaign_leads, report.campaignCompanies);
  // ponytail: `position` (serial) segue a ordem do SQLite porque a inserção respeita a ordem exportada (rowid)
  await insertAll(
    'lh_campaign_companies',
    links.map((r) => ({ tenant_id: tenantId, campaign_id: r._campaign, company_id: r._company, analysis: json(camelKeys(r.analysis ?? {})) })),
    ['campaign_id', 'company_id'],
    report.campaignCompanies,
  );

  const observations = linked(data.observations, report.observations);
  await insertAll(
    'lh_observations',
    observations.map((r) => ({
      tenant_id: tenantId,
      campaign_id: r._campaign,
      company_id: r._company,
      query: r.query,
      location: r.location,
      rank: r.rank ?? null,
      depth: r.depth,
      observed_at: ts(r.observed_at),
      source_url: r.source_url ?? null,
    })),
    ['campaign_id', 'company_id', 'query', 'location'],
    report.observations,
  );

  const coverage = linked(data.search_coverage, report.searchCoverage);
  await insertAll(
    'lh_search_coverage',
    coverage.map((r) => ({
      tenant_id: tenantId,
      campaign_id: r._campaign,
      query: r.query,
      location: r.location,
      depth: r.depth,
      observed_at: ts(r.observed_at),
    })),
    ['campaign_id', 'query', 'location'],
    report.searchCoverage,
  );

  // Chamada que ficou "pending" no Radar nunca se resolveu: vira "unknown", como o recover() faz
  const calls = linked(data.api_calls, report.apiCalls);
  await insertAll(
    'lh_api_calls',
    calls.map((r) => ({
      tenant_id: tenantId,
      campaign_id: r._campaign,
      provider: r.provider,
      operation: r.operation,
      state: r.state === 'pending' ? 'unknown' : r.state,
      cost: r.cost ?? null,
      tokens: r.tokens ?? null,
      model: r.model ?? null,
      created_at: ts(r.created_at),
    })),
    null,
    report.apiCalls,
  );

  // ---- buscas pagas (cache): sobrevivem à campanha de origem, então a chave natural evita duplicar
  for (const s of data.searches) {
    const executedAt = ts(s.executed_at);
    const dup = await trx('lh_searches')
      .where({ tenant_id: tenantId, cache_key: s.cache_key, depth: s.depth, keyword: s.keyword, location: s.location })
      .where('executed_at', executedAt)
      .first('id');
    if (dup) {
      report.searches.skipped += 1;
      continue;
    }
    await trx('lh_searches').insert({
      tenant_id: tenantId,
      provider: s.provider,
      operation: s.operation,
      cache_key: s.cache_key,
      keyword: s.keyword,
      location: s.location,
      depth: s.depth,
      campaign_id: (s.campaign_id && campaignOf.get(s.campaign_id)) || null,
      executed_at: executedAt,
      result_count: s.result_count,
      cost: s.cost ?? null,
      results: json(camelKeys(s.results ?? [])),
      reuse_count: s.reuse_count ?? 0,
      last_reused_at: ts(s.last_reused_at),
    });
    report.searches.inserted += 1;
  }

  return report;
}

export async function importRadarExport(tenantId: string, data: RadarExport, trx?: Knex.Transaction): Promise<ImportReport> {
  if (!UUID.test(tenantId)) throw new Error('--tenant precisa ser um uuid.');
  assertExport(data);
  return trx ? run(trx, tenantId, data) : db.transaction((t) => run(t, tenantId, data));
}

// ---------------------------------------------------------------- linha de comando

function arg(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function describeTarget(): string {
  const url = new URL(env.DATABASE_URL);
  return `host=${url.hostname}:${url.port || '5432'} banco=${url.pathname.slice(1)}`;
}

async function main(argv: string[]): Promise<void> {
  const tenantId = arg(argv, '--tenant');
  const file = arg(argv, '--file');
  if (!tenantId || !file) {
    console.error('Uso: tsx scripts/import-leadhunter.ts --tenant <uuid> --file <json> [--confirm]');
    process.exitCode = 1;
    return;
  }
  console.log(`Destino: ${describeTarget()}\nWorkspace: ${tenantId}\nArquivo: ${file}`);
  if (!argv.includes('--confirm')) {
    console.log('Nada foi gravado. Confira o destino acima e rode de novo com --confirm.');
    process.exitCode = 1;
    return;
  }
  const report = await importRadarExport(tenantId, JSON.parse(fs.readFileSync(file, 'utf-8')) as RadarExport);
  const { neutralized, ...tables } = report;
  for (const [table, c] of Object.entries(tables)) console.log(`${table}: ${c.inserted} inseridos, ${c.skipped} pulados`);
  if (neutralized) console.log(`${neutralized} campanha(s) do Radar estavam na fila/rodando e entraram como "interrupted".`);
}

if (/import-leadhunter\.[tj]s$/.test(process.argv[1] ?? '')) {
  main(process.argv.slice(2))
    .catch((error: unknown) => {
      console.error(`Falhou (nada foi gravado): ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    })
    .finally(() => db.destroy());
}
