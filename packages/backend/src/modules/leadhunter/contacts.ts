import type { Knex } from 'knex';
import { importContactsBulk, type BulkContactInput, type BulkItemResult } from '../contacts/contacts.service';
import { PRIORITY_LABELS, type Analysis, type Stage } from './domain';
import * as store from './store';

// "Criar contatos": empresas do LeadHunter viram contatos do CRM (port de lead_payload e Crm._send de
// radar/crm.py do LeadHunter, agora sem HTTP: o envio é uma chamada interna a importContactsBulk).

const MAX_BATCH = 500;
const NEVER_SENT: readonly Stage[] = ['do_not_contact', 'discarded'];
const ALREADY_SENT: readonly store.CrmResult['status'][] = ['imported', 'duplicate'];
const MAX_ERROR_LENGTH = 300;
const NOTHING_NEW = 'Nenhuma empresa nova para enviar ao CRM.';
const DEMO_NOT_SENT = 'Empresas de demonstração não são enviadas ao CRM.';

const badRequest = (message: string) => Object.assign(new Error(message), { status: 400 });

/** Corta por unidades UTF-16 (o CRM valida assim), sem partir um par substituto. */
export function cutUtf16(s: string | null | undefined, n: number): string | null {
  if (s === null || s === undefined) return null;
  if (s.length <= n) return s;
  const head = s.slice(0, n);
  const last = head.charCodeAt(head.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? head.slice(0, -1) : head;
}

/** URLs não são cortadas (ficariam inválidas): acima do limite do CRM, são omitidas. */
const urlWithin = (value: string | null, max: number): string | undefined =>
  value && value.length <= max ? value : undefined;

const clampScore = (score: number): number => Math.min(100, Math.max(0, Math.round(score)));

/** Empresa no formato do CRM; textos acima dos limites do CRM são cortados, URLs são omitidas. */
export function toContactInput(company: store.Company, analysis: Analysis | null): BulkContactInput {
  const score = analysis?.score;
  const context = [
    `Prioridade ${PRIORITY_LABELS[analysis?.priority ?? 'review']}${score === undefined ? '' : ` (${score}/100)`}`,
    ...(analysis?.reasons ?? []).map((reason) => `- ${reason.text}`),
  ];
  if (company.notes) context.push(`\nObservações: ${company.notes}`);

  const input: Record<string, unknown> = {
    fullName: cutUtf16(company.name, 255) ?? '',
    company: cutUtf16(company.name, 255),
    niche: cutUtf16(company.category, 255),
    address: cutUtf16(company.address, 500),
    city: cutUtf16(company.city, 100),
    phone: cutUtf16(company.phone, 50),
    website: urlWithin(company.website, 500),
    mapsUrl: urlWithin(company.mapsUrl, 1000),
    instagram: company.instagramStatus === 'confirmed' ? company.instagram : undefined,
    googleRating: company.rating,
    googleReviews: company.reviews,
    leadScore: score === undefined ? undefined : clampScore(score),
    leadContext: cutUtf16(context.join('\n'), 5000),
    externalId: company.identity,
  };
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== null && value !== undefined && value !== ''),
  ) as unknown as BulkContactInput;
}

/** Separa o que vai ao CRM do que fica de fora: demonstração e etapas barradas (excluídas) e envios já feitos (puladas). */
export function splitSendable(companies: store.Company[]): { pending: store.Company[]; skipped: number; excluded: number } {
  const pending: store.Company[] = [];
  let skipped = 0;
  let excluded = 0;
  for (const company of companies) {
    if (company.source === 'demo' || NEVER_SENT.includes(company.stage)) excluded += 1;
    else if (company.crm && ALREADY_SENT.includes(company.crm.status)) skipped += 1;
    else pending.push(company);
  }
  return { pending, skipped, excluded };
}

export interface SendSummary {
  imported: number;
  duplicate: number;
  error: number;
  excluded: number;
  skipped: number;
  items: BulkItemResult[];
}

/**
 * Envia as empresas da campanha como contatos (`companyIds` ausente = todas) e grava o resultado em cada
 * uma. Reenvio não duplica: o contato é identificado por `external_id` = identidade da empresa.
 */
export async function sendCompaniesToContacts(
  tenantId: string,
  companyIds: string[] | undefined,
  opts: { campaignId: string; ownerId: string | null; leadRequestId?: string | null; trx?: Knex.Transaction },
): Promise<SendSummary> {
  const wanted = companyIds && new Set(companyIds);
  const inCampaign = await store.companies(tenantId, opts.campaignId, opts.trx);
  const chosen = wanted ? inCampaign.filter((company) => wanted.has(company.id)) : inCampaign;
  const { pending, skipped, excluded } = splitSendable(chosen);

  if (!pending.length) {
    throw badRequest(chosen.length && chosen.every((c) => c.source === 'demo') ? DEMO_NOT_SENT : NOTHING_NEW);
  }
  if (pending.length > MAX_BATCH) {
    throw badRequest(`O CRM aceita até ${MAX_BATCH} empresas por envio. Selecione menos empresas.`);
  }

  const { items } = await importContactsBulk(
    tenantId,
    pending.map((company) => toContactInput(company, company.analysis ?? null)),
    { ownerId: opts.ownerId, source: 'leadhunter', leadRequestId: opts.leadRequestId, trx: opts.trx },
  );

  const count = { imported: 0, duplicate: 0, error: 0 };
  for (const [index, company] of pending.entries()) {
    const item = items[index];
    count[item.status] += 1;
    const crm: store.CrmResult = {
      contactId: item.contactId,
      status: item.status,
      sentAt: new Date().toISOString(),
      ownerId: opts.ownerId,
      ...(item.status === 'error' ? { error: (item.error ?? 'O CRM recusou esta empresa.').slice(0, MAX_ERROR_LENGTH) } : {}),
    };
    await store.setCrm(tenantId, company.id, crm, opts.trx);
  }
  return { ...count, excluded, skipped, items };
}
