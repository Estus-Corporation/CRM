import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { db } from '../../db';
import { validateCampaign, type CampaignConfig } from '../leadhunter/domain';
import { createCampaignChecked } from '../leadhunter/leadhunter.service';
import * as store from '../leadhunter/store';
import { createNotification } from '../notifications/notifications.service';
import { findActiveMemberById } from '../users/users.service';
import type { CreateLeadRequestInput, ExecuteLeadRequestInput, ListLeadRequestsQuery } from './lead-requests.schema';

const LIST_LIMIT = 100;

type Viewer = { id: string; role: string };

function httpError(message: string, status: number, code?: string) {
  return Object.assign(new Error(message), { status, code });
}

const isPrivileged = (viewer: Viewer) => viewer.role === 'admin' || viewer.role === 'manager';

function baseQuery(tenantId: string) {
  return db('lead_requests as lr')
    .leftJoin('users as u', 'u.id', 'lr.requested_by')
    .where('lr.tenant_id', tenantId);
}

const PUBLIC_FIELDS = [
  'lr.id', 'lr.niche', 'lr.city', 'lr.quantity', 'lr.notes', 'lr.status', 'lr.message',
  'lr.service', 'lr.keywords', 'lr.coordinates', 'lr.enrich', 'lr.use_jev', 'lr.force_refresh',
  'lr.campaign_id', 'lr.decided_by', 'lr.delivered_count', 'lr.requested_by', 'u.full_name as requester_name',
  'lr.finished_at', 'lr.created_at', 'lr.updated_at',
];

async function findLeadRequest(tenantId: string, id: string) {
  return baseQuery(tenantId).where('lr.id', id).first(PUBLIC_FIELDS);
}

/** Zero linhas atualizadas: 404 se o pedido não existe neste workspace, senão o estado não permite */
async function failTransition(tenantId: string, id: string, message: string, code: string): Promise<never> {
  const exists = await db('lead_requests').where({ id, tenant_id: tenantId }).first('id');
  if (!exists) throw httpError('Pedido não encontrado', 404);
  throw httpError(message, 409, code);
}

// ── Formulário da campanha ───────────────────────────────────────────────────

/**
 * Campos do formulário a partir do corpo ou da linha do pedido (quantity = limit; snake_case ou camelCase),
 * só os presentes: a mescla "pedido + edição do admin" não pode ser sobrescrita por `undefined`.
 */
function formOf(v: Record<string, unknown>): Record<string, unknown> {
  const form = {
    niche: v.niche,
    city: v.city,
    service: v.service,
    limit: v.limit ?? v.quantity,
    keywords: v.keywords,
    coordinates: v.coordinates,
    enrich: v.enrich,
    useJev: v.useJev ?? v.use_jev,
    forceRefresh: v.forceRefresh ?? v.force_refresh,
  };
  return Object.fromEntries(Object.entries(form).filter(([, value]) => value !== undefined));
}

/** Pedido é sempre coleta real (`live`). */
const liveForm = (...parts: Record<string, unknown>[]) => ({ ...Object.assign({}, ...parts.map(formOf)), source: 'live' });

/** Regras e mensagens em pt-BR do domínio do LeadHunter. */
function toConfig(form: Record<string, unknown>): CampaignConfig {
  try {
    return validateCampaign(form);
  } catch (error) {
    throw httpError(error instanceof Error && error.constructor === Error ? error.message : 'Campos inválidos.', 422, 'invalid_form');
  }
}

/**
 * Colunas do pedido a partir da configuração já validada (jsonb recebe texto JSON). O termo padrão
 * ("nicho cidade", com vírgulas na cidade) não é gravado: vazio = padrão, regerado a cada validação.
 */
const columnsOf = (config: CampaignConfig) => ({
  niche: config.niche,
  city: config.city,
  quantity: config.limit,
  service: config.service,
  keywords: JSON.stringify(config.keywords.length === 1 && config.keywords[0] === `${config.niche} ${config.city}` ? [] : config.keywords),
  coordinates: JSON.stringify(config.coordinates),
  enrich: config.enrich,
  use_jev: config.useJev,
  force_refresh: config.forceRefresh,
});

async function assertQuantityAllowed(tenantId: string, quantity: number) {
  const tenant = await db('tenants').where({ id: tenantId }).first('lead_request_max_quantity');
  const maxQuantity = Number(tenant?.lead_request_max_quantity ?? 0);
  if (quantity > maxQuantity) {
    throw httpError(`Máximo de ${maxQuantity} empresas por pedido neste workspace.`, 422, 'quota_quantity');
  }
}

/**
 * Roda `work` numa transação que grava o pedido e cria a campanha dele (a campanha usa outra conexão: o
 * LeadHunter grava pelo `db`). Qualquer falha desfaz o pedido; se a campanha chegou a ser criada antes da
 * falha (ex.: o commit), ela é cancelada para não gastar chamada paga sem pedido.
 */
async function withCampaign(
  tenantId: string,
  work: (trx: Knex.Transaction, attach: (campaignId: string) => void) => Promise<void>,
): Promise<void> {
  const created: { campaignId?: string } = {};
  try {
    await db.transaction((trx) => work(trx, (id) => (created.campaignId = id)));
  } catch (error) {
    if (created.campaignId) {
      const orphan = created.campaignId;
      await store.updateCampaign(tenantId, orphan, { cancelRequested: true }).catch((err) => {
        console.error('[leadhunter] não foi possível cancelar a campanha órfã', orphan, err);
      });
    }
    throw error;
  }
}

// ── Admin ────────────────────────────────────────────────────────────────────

/** Cria o pedido e já dispara a campanha (sem cota diária: a quantidade e os limites de chamada protegem). */
export async function createLeadRequest(tenantId: string, adminId: string, input: CreateLeadRequestInput) {
  const form = liveForm(input);
  const config = toConfig(form);
  await assertQuantityAllowed(tenantId, config.limit);
  const id = randomUUID();
  await withCampaign(tenantId, async (trx, attach) => {
    await trx('lead_requests').insert({
      id,
      tenant_id: tenantId,
      requested_by: adminId,
      decided_by: adminId,
      status: 'running',
      notes: input.notes || null,
      ...columnsOf(config),
    });
    const campaign = await createCampaignChecked(tenantId, adminId, form, { leadRequestId: id });
    attach(campaign.id);
    await trx('lead_requests').where({ id, tenant_id: tenantId }).update({ campaign_id: campaign.id });
  });
  return findLeadRequest(tenantId, id);
}

/**
 * Executa um pedido na fila, com edições opcionais. Portão atômico `queued → running`; se a campanha for
 * recusada (credenciais, estimativa acima do limite) a transação desfaz tudo e o pedido segue na fila.
 */
export async function executeLeadRequest(tenantId: string, adminId: string, id: string, edits: ExecuteLeadRequestInput) {
  const current = await db('lead_requests').where({ id, tenant_id: tenantId }).first();
  if (!current) throw httpError('Pedido não encontrado', 404);
  if (current.status !== 'queued') throw httpError('Pedido não está na fila', 409, 'not_queued');

  const form = liveForm(current, edits);
  const config = toConfig(form);
  await assertQuantityAllowed(tenantId, config.limit);
  await withCampaign(tenantId, async (trx, attach) => {
    const [claimed] = await trx('lead_requests')
      .where({ id, tenant_id: tenantId, status: 'queued' })
      .update({
        status: 'running',
        decided_by: adminId,
        message: null,
        ...(edits.notes === undefined ? {} : { notes: edits.notes || null }),
        ...columnsOf(config),
        updated_at: new Date(),
      })
      .returning('id');
    if (!claimed) throw httpError('Pedido não está na fila', 409, 'not_queued');
    const campaign = await createCampaignChecked(tenantId, adminId, form, { leadRequestId: id });
    attach(campaign.id);
    await trx('lead_requests').where({ id, tenant_id: tenantId }).update({ campaign_id: campaign.id });
  });
  return findLeadRequest(tenantId, id);
}

/** Recusa um pedido na fila: vira `cancelled` com o motivo e avisa quem pediu (se ainda for membro ativo). */
export async function rejectLeadRequest(tenantId: string, adminId: string, id: string, message: string) {
  const [request] = await db('lead_requests')
    .where({ id, tenant_id: tenantId, status: 'queued' })
    .update({ status: 'cancelled', message, decided_by: adminId, finished_at: new Date(), updated_at: new Date() })
    .returning(['requested_by', 'niche', 'city']);
  if (!request) return failTransition(tenantId, id, 'Só pedidos na fila podem ser recusados', 'not_queued');

  // A recusa já está gravada: nenhuma falha do aviso pode virar erro na resposta
  try {
    if (request.requested_by && (await findActiveMemberById(tenantId, request.requested_by))) {
      await createNotification({
        tenantId,
        userId: request.requested_by,
        type: 'lead_request.rejected',
        title: 'Seu pedido de leads foi recusado',
        body: `${request.niche} · ${request.city} — ${message}`,
        resourceType: 'lead_request',
        resourceId: id,
      });
    }
  } catch (err) {
    console.error('Falha ao notificar recusa de pedido de leads', err);
  }
  return findLeadRequest(tenantId, id);
}

// ── Consulta e cancelamento ──────────────────────────────────────────────────

export async function listLeadRequests(tenantId: string, viewer: Viewer, query: ListLeadRequestsQuery) {
  const q = baseQuery(tenantId);
  if (isPrivileged(viewer)) {
    if (query.userId) q.where('lr.requested_by', query.userId);
  } else {
    q.where('lr.requested_by', viewer.id);
  }
  if (query.status) q.where('lr.status', query.status);
  return q.orderBy('lr.created_at', 'desc').limit(LIST_LIMIT).select(PUBLIC_FIELDS);
}

/** Pedido visível para quem consulta: dono, admin ou manager — fora disso é 404 */
async function findVisible(tenantId: string, viewer: Viewer, id: string) {
  const row = await findLeadRequest(tenantId, id);
  if (!row || (!isPrivileged(viewer) && row.requested_by !== viewer.id)) {
    throw httpError('Pedido não encontrado', 404);
  }
  return row;
}

export async function getLeadRequest(tenantId: string, viewer: Viewer, id: string) {
  const row = await findVisible(tenantId, viewer, id);
  const contactsQuery = db('contacts').where({ tenant_id: tenantId, lead_request_id: id });
  // Captador só vê os contatos que são dele (lead_assignments)
  if (viewer.role === 'captador') {
    contactsQuery.whereExists(
      db('lead_assignments as la')
        .whereRaw('la.contact_id = contacts.id')
        .where({ 'la.tenant_id': tenantId, 'la.captador_id': viewer.id }),
    );
  }
  const contacts = await contactsQuery
    .orderBy('created_at', 'asc')
    .select('id', 'full_name', 'company_name', 'phone', 'niche');
  return { ...row, contacts };
}

export async function cancelLeadRequest(tenantId: string, viewer: Viewer, id: string) {
  await findVisible(tenantId, viewer, id);
  const updated = await db('lead_requests')
    .where({ id, tenant_id: tenantId, status: 'queued' })
    .update({ status: 'cancelled', finished_at: new Date(), updated_at: new Date() });
  if (!updated) throw httpError('Só pedidos na fila podem ser cancelados', 409, 'not_queued');
  return findLeadRequest(tenantId, id);
}
