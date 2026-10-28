import { findActiveMemberById } from '../users/users.service';
import { sendCompaniesToContacts, type SendSummary } from './contacts';
import { exportCsv, validateImport } from './csv';
import {
  instagramUrl,
  isFresh,
  text,
  validateCampaign,
  type CampaignConfig,
  type Observation,
} from './domain';
import { estimateCalls, recalculate } from './engine';
import { loadSettings } from './providers';
import type { CompanyFilters, PatchCompanyBody, SendContactsBody } from './leadhunter.schema';
import * as store from './store';

// Regras de aplicação das rotas do LeadHunter (port dos handlers de app.py do LeadHunter). Todo acesso a
// dados passa pelo store com `tenantId` primeiro; a existência é conferida aqui, porque o store ignora
// em silêncio atualizações de ids que não existem (ou que são de outro workspace).

const FOUND_LIMIT = 2000;
const NOTES_MAX = 5000;
const CAMPAIGN_NOT_FOUND = 'Campanha não encontrada.';
const COMPANY_NOT_FOUND = 'Empresa não encontrada.';

export const httpError = (status: number, message: string, code?: string) =>
  Object.assign(new Error(message), { status, ...(code ? { code } : {}) });

/**
 * As regras do domínio lançam `Error` com texto em pt-BR para o operador (o ValueError do Python): viram 400.
 * Qualquer outro erro (TypeError por formato estranho) vira "Campos inválidos.", sem vazar detalhe.
 */
function validated<T>(check: () => T): T {
  try {
    return check();
  } catch (error) {
    throw httpError(400, error instanceof Error && error.constructor === Error ? error.message : 'Campos inválidos.');
  }
}

async function requireCampaign(tenantId: string, id: string): Promise<store.Campaign> {
  const campaign = await store.getCampaign(tenantId, id);
  if (!campaign) throw httpError(404, CAMPAIGN_NOT_FOUND);
  return campaign;
}

async function requireCompany(tenantId: string, id: string): Promise<store.Company> {
  const company = await store.getCompany(tenantId, id);
  if (!company) throw httpError(404, COMPANY_NOT_FOUND);
  return company;
}

// ---------------------------------------------------------------- status e buscas

export async function status() {
  const settings = loadSettings();
  return {
    dataforseo: !!settings.dataforseo,
    jev: !!settings.jevKey,
    jevModel: settings.jevModel,
    runLimit: settings.runLimit,
    dailyLimit: settings.dailyLimit,
    callsToday: await store.callsToday(),
    searchCacheDays: settings.cacheDays,
  };
}

export async function listSearches(tenantId: string) {
  const { cacheDays } = loadSettings();
  const rows = await store.listSearches(tenantId);
  return rows.map((row) => ({ ...row, expired: !isFresh(row.executedAt, cacheDays) }));
}

export async function foundCompanies(tenantId: string, includeDemo: boolean) {
  const { rows, truncated } = await store.foundCompanies(tenantId, { includeDemo, limit: FOUND_LIMIT });
  return { companies: rows, truncated, limit: FOUND_LIMIT };
}

export async function exportCompaniesCsv(tenantId: string, ids: string[] | undefined) {
  const csv = exportCsv(await store.exportRows(tenantId, ids));
  return { csv, filename: `radar-empresas-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv` };
}

// ---------------------------------------------------------------- campanhas

export const listCampaigns = (tenantId: string) => store.listCampaigns(tenantId);

export function estimate(tenantId: string, body: unknown) {
  return estimateCalls(tenantId, validated(() => validateCampaign(body)), loadSettings());
}

/**
 * Cria uma campanha de demonstração ou ao vivo: recusa `import` (tem rota própria), `live` sem credenciais e
 * `live` acima do limite de chamadas por campanha. `leadRequestId` liga a campanha ao pedido que a originou.
 */
export async function createCampaignChecked(
  tenantId: string,
  userId: string,
  data: unknown,
  opts: { leadRequestId?: string } = {},
): Promise<{ id: string; estimate: { searches: number; reused: number; calls: number } }> {
  const config = validated(() => validateCampaign(data));
  if (config.source === 'import') throw httpError(400, 'Use a importação de arquivo para esta origem.');
  const settings = loadSettings();
  let counted = { searches: 0, reused: 0, calls: 0 }; // demonstração não faz chamadas pagas
  if (config.source === 'live') {
    if (!settings.dataforseo) {
      throw httpError(400, 'Configure as credenciais DataForSEO no .env e reinicie. Nenhuma busca foi iniciada.');
    }
    counted = await estimateCalls(tenantId, config, settings);
    if (counted.calls > settings.runLimit) {
      throw httpError(400, 'A campanha pode exceder o limite de chamadas. Reduza termos, pontos ou empresas.');
    }
  }
  const campaign: CampaignConfig & { leadRequestId?: string } = opts.leadRequestId
    ? { ...config, leadRequestId: opts.leadRequestId }
    : config;
  return { id: await store.createCampaign(tenantId, campaign, { createdBy: userId }), estimate: counted };
}

/** Importação CSV/JSON: grava as empresas já validadas e só então libera a campanha para o worker. */
export async function importCampaign(tenantId: string, userId: string, body: unknown): Promise<string> {
  const { config, leads } = validated(() => validateImport(body));
  const id = await store.createCampaign(tenantId, config, { state: 'importing', createdBy: userId });
  try {
    for (const lead of leads) await store.upsertCompany(tenantId, id, lead, 'import');
    await store.updateCampaign(tenantId, id, { state: 'queued' });
  } catch (error) {
    await store.updateCampaign(tenantId, id, { state: 'failed', message: 'Importação interrompida.' });
    throw error;
  }
  return id;
}

const searchable = (company: store.Company) =>
  [company.name, company.address, company.category, company.city].map((v) => v ?? '').join(' ').toLowerCase();

function filterCompanies(companies: store.Company[], { q, priority, stage }: CompanyFilters): store.Company[] {
  const search = q?.toLowerCase();
  return companies.filter(
    (company) =>
      (!search || searchable(company).includes(search)) &&
      (!priority || company.analysis?.priority === priority) &&
      (!stage || company.stage === stage),
  );
}

export async function getCampaignDetail(tenantId: string, id: string, filters: CompanyFilters) {
  const campaign = await requireCampaign(tenantId, id);
  const [companies, usage, coverage] = await Promise.all([
    store.companies(tenantId, id),
    store.usage(tenantId, id),
    store.searchCoverage(tenantId, id),
  ]);
  return { campaign, companies: filterCompanies(companies, filters), usage, coverage };
}

export async function exportCampaignCsv(tenantId: string, id: string, filters: CompanyFilters) {
  const campaign = await requireCampaign(tenantId, id);
  const companies = filterCompanies(await store.companies(tenantId, id), filters);
  const csv = exportCsv(
    companies.map((company) => ({ company, analysis: company.analysis ?? null, observations: company.observations ?? [] })),
  );
  return { csv, filename: `radar-${campaign.config.source}-${id.slice(0, 8)}.csv` };
}

export async function cancelCampaign(tenantId: string, id: string): Promise<void> {
  const campaign = await requireCampaign(tenantId, id);
  if (campaign.state !== 'queued' && campaign.state !== 'running') throw httpError(400, 'Esta campanha já foi finalizada.');
  await store.updateCampaign(tenantId, id, { cancelRequested: true });
}

export async function sendContacts(tenantId: string, id: string, body: SendContactsBody): Promise<SendSummary> {
  await requireCampaign(tenantId, id);
  const ownerId = body.ownerId ?? null;
  if (ownerId && !(await findActiveMemberById(tenantId, ownerId))) {
    throw httpError(422, 'Responsável não é membro ativo deste workspace', 'invalid_owner');
  }
  return sendCompaniesToContacts(tenantId, body.companyIds, { campaignId: id, ownerId });
}

// ---------------------------------------------------------------- empresas

export async function companyHistory(tenantId: string, id: string): Promise<(Observation & { campaignId: string; niche: string })[]> {
  await requireCompany(tenantId, id);
  return store.history(tenantId, id);
}

/** Etapa, notas e revisão manual do Instagram; depois recalcula as campanhas da empresa (a pontuação muda). */
export async function patchCompany(tenantId: string, id: string, body: PatchCompanyBody): Promise<void> {
  const company = await requireCompany(tenantId, id);
  const notes = body.notes === undefined ? undefined : validated(() => text(body.notes, NOTES_MAX));
  if (body.instagramStatus) {
    const url = instagramUrl(body.instagram !== undefined ? body.instagram : company.instagram);
    if (body.instagramStatus !== 'rejected' && !url) throw httpError(400, 'Informe o link de um perfil válido do Instagram.');
    await store.patchCompanyData(tenantId, id, {
      instagram: url,
      instagramStatus: body.instagramStatus,
      instagramSource: 'Revisão manual do operador.',
      instagramVerifiedAt: new Date().toISOString(),
    });
  }
  await store.updateCompany(tenantId, id, { stage: body.stage as store.Company['stage'] | undefined, notes });
  await recalculateCampaigns(tenantId, id);
}

export async function removeCompany(tenantId: string, id: string): Promise<void> {
  await requireCompany(tenantId, id);
  const campaigns = await store.campaignsForCompany(tenantId, id);
  if (campaigns.some((c) => c.state === 'queued' || c.state === 'running')) {
    throw httpError(409, 'Aguarde ou cancele a campanha antes de excluir.');
  }
  await store.deleteCompany(tenantId, id);
  for (const campaign of campaigns) await recalculate(tenantId, campaign.id);
}

async function recalculateCampaigns(tenantId: string, companyId: string): Promise<void> {
  for (const campaign of await store.campaignsForCompany(tenantId, companyId)) await recalculate(tenantId, campaign.id);
}
