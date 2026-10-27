import { db } from '../../db';
import { importContactsBulk } from '../contacts/contacts.service';
import { createNotification } from '../notifications/notifications.service';
import type { CreateLeadRequestInput, ListLeadRequestsQuery, ResultInput } from './lead-requests.schema';

// Reserva do Radar Local: vencida, o pedido volta para a fila; `progress` renova
const CLAIM_TTL_MINUTES = 30;
const LIST_LIMIT = 100;
const QUEUE_LIMIT = 20;

// "Hoje" no fuso do Brasil — o servidor e o banco rodam em UTC
const TODAY = "(now() AT TIME ZONE 'America/Sao_Paulo')::date";

type Viewer = { id: string; role: string };

function httpError(message: string, status: number, code?: string) {
  return Object.assign(new Error(message), { status, code });
}

const isPrivileged = (viewer: Viewer) => viewer.role === 'admin' || viewer.role === 'manager';
const claimExpiry = () => db.raw('now() + make_interval(mins => ?)', [CLAIM_TTL_MINUTES]);

function baseQuery(tenantId: string) {
  return db('lead_requests as lr')
    .leftJoin('users as u', 'u.id', 'lr.requested_by')
    .where('lr.tenant_id', tenantId);
}

const PUBLIC_FIELDS = [
  'lr.id', 'lr.niche', 'lr.city', 'lr.quantity', 'lr.notes', 'lr.status', 'lr.message',
  'lr.delivered_count', 'lr.requested_by', 'u.full_name as requester_name',
  'lr.claimed_at', 'lr.finished_at', 'lr.created_at', 'lr.updated_at',
];

async function findLeadRequest(tenantId: string, id: string) {
  return baseQuery(tenantId).where('lr.id', id).first(PUBLIC_FIELDS);
}

/** Devolve para a fila os pedidos cuja reserva venceu */
export async function requeueExpired(tenantId: string) {
  await db('lead_requests')
    .where({ tenant_id: tenantId })
    .whereIn('status', ['claimed', 'running'])
    .where('claim_expires_at', '<', db.fn.now())
    .update({
      status: 'queued',
      message: 'Reserva expirada; voltou para a fila.',
      claimed_at: null,
      claim_expires_at: null,
      updated_at: new Date(),
    });
}

export async function createLeadRequest(tenantId: string, userId: string, input: CreateLeadRequestInput) {
  const id = await db.transaction(async (trx) => {
    await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`lead-requests:${tenantId}:${userId}`]);

    const tenant = await trx('tenants')
      .where({ id: tenantId })
      .first('lead_request_max_quantity', 'lead_request_daily_per_user');
    const maxQuantity = Number(tenant?.lead_request_max_quantity ?? 0);
    const dailyLimit = Number(tenant?.lead_request_daily_per_user ?? 0);

    if (dailyLimit <= 0) {
      throw httpError('Pedidos de leads estão desativados neste workspace.', 422, 'requests_disabled');
    }
    if (input.quantity > maxQuantity) {
      throw httpError(`Máximo de ${maxQuantity} empresas por pedido neste workspace.`, 422, 'quota_quantity');
    }

    const [{ count }] = await trx('lead_requests')
      .where({ tenant_id: tenantId, requested_by: userId })
      .whereNot({ status: 'cancelled' })
      .whereRaw(`(created_at AT TIME ZONE 'America/Sao_Paulo')::date = ${TODAY}`)
      .count('id as count');
    if (Number(count) >= dailyLimit) {
      throw httpError(`Limite de ${dailyLimit} pedidos por dia atingido. Tente amanhã.`, 422, 'quota_daily');
    }

    const [row] = await trx('lead_requests')
      .insert({
        tenant_id: tenantId,
        requested_by: userId,
        niche: input.niche,
        city: input.city,
        quantity: input.quantity,
        notes: input.notes || null,
      })
      .returning('id');
    return (row as { id: string }).id;
  });
  return findLeadRequest(tenantId, id);
}

export async function listLeadRequests(tenantId: string, viewer: Viewer, query: ListLeadRequestsQuery) {
  await requeueExpired(tenantId);
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
  await requeueExpired(tenantId);
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

// ── Executor (Radar Local, chave de API) ─────────────────────────────────────

export async function listQueue(tenantId: string) {
  await requeueExpired(tenantId);
  const rows = await baseQuery(tenantId)
    .where('lr.status', 'queued')
    .orderBy('lr.created_at', 'asc')
    .limit(QUEUE_LIMIT)
    .select('lr.id', 'lr.niche', 'lr.city', 'lr.quantity', 'lr.notes', 'u.full_name as requester_name', 'lr.created_at');
  return rows.map((r) => ({
    id: r.id,
    niche: r.niche,
    city: r.city,
    quantity: r.quantity,
    notes: r.notes,
    requesterName: r.requester_name,
    createdAt: r.created_at,
  }));
}

/** Zero linhas atualizadas: 404 se o pedido não existe neste workspace, senão o estado não permite */
async function failTransition(tenantId: string, id: string, message: string, code: string): Promise<never> {
  const exists = await db('lead_requests').where({ id, tenant_id: tenantId }).first('id');
  if (!exists) throw httpError('Pedido não encontrado', 404);
  throw httpError(message, 409, code);
}

export async function claimLeadRequest(tenantId: string, id: string) {
  await requeueExpired(tenantId);
  const [claimed] = await db('lead_requests')
    .where({ id, tenant_id: tenantId, status: 'queued' })
    .update({
      status: 'claimed',
      message: null,
      claimed_at: db.fn.now(),
      claim_expires_at: claimExpiry(),
      updated_at: new Date(),
    })
    .returning(['id', 'claim_expires_at']);
  if (!claimed) return failTransition(tenantId, id, 'Pedido não está na fila', 'not_queued');

  const row = await findLeadRequest(tenantId, id);
  return {
    id: row.id,
    niche: row.niche,
    city: row.city,
    quantity: row.quantity,
    notes: row.notes,
    requesterName: row.requester_name,
    claimExpiresAt: claimed.claim_expires_at,
  };
}

export async function progressLeadRequest(tenantId: string, id: string, message?: string) {
  const updates: Record<string, unknown> = {
    status: 'running',
    claim_expires_at: claimExpiry(),
    updated_at: new Date(),
  };
  if (message !== undefined) updates.message = message;
  const [row] = await db('lead_requests')
    .where({ id, tenant_id: tenantId })
    .whereIn('status', ['claimed', 'running'])
    .update(updates)
    .returning(['id', 'status', 'claim_expires_at']);
  if (!row) return failTransition(tenantId, id, 'Pedido não está reservado', 'not_claimed');
  return { id: row.id, status: row.status, claimExpiresAt: row.claim_expires_at };
}

const FINISHED_TITLES = {
  done: 'Seu pedido de leads foi atendido',
  partial: 'Seu pedido de leads foi atendido em parte',
  failed: 'Não foi possível atender seu pedido de leads',
} as const;

export async function deliverLeadRequest(tenantId: string, id: string, input: ResultInput) {
  // Tudo numa transação: qualquer erro desfaz a entrega e o pedido volta ao estado anterior
  const out = await db.transaction(async (trx) => {
    // Portão atômico: só uma entrega passa
    const [request] = await trx('lead_requests')
      .where({ id, tenant_id: tenantId })
      .whereIn('status', ['claimed', 'running'])
      .update({ status: input.status, claim_expires_at: null, updated_at: new Date() })
      .returning(['id', 'niche', 'city', 'quantity', 'requested_by']);
    if (!request) return failTransition(tenantId, id, 'Pedido não está reservado', 'not_claimed');

    if (input.leads.length > request.quantity) {
      throw httpError('Mais empresas do que o pedido', 422, 'too_many_leads');
    }

    // Quem pediu ainda é membro ativo? Senão os leads entram sem dono e sem notificação
    const member = request.requested_by
      ? await trx('user_tenants')
          .where({ tenant_id: tenantId, user_id: request.requested_by, is_active: true })
          .first('role')
      : null;

    const result = await importContactsBulk(tenantId, input.leads, {
      ownerId: member ? request.requested_by : null,
      source: 'leadhunter',
      leadRequestId: id,
      trx,
    });

    const finalStatus =
      input.status === 'done' && result.items.some((item) => item.status === 'error') ? 'partial' : input.status;
    await trx('lead_requests')
      .where({ id, tenant_id: tenantId })
      .update({
        status: finalStatus,
        message: input.message ?? null,
        delivered_count: result.imported,
        finished_at: new Date(),
        updated_at: new Date(),
      });

    // Captador: os leads novos entram em "Meus leads" (e não sobram para a distribuição automática)
    if (member?.role === 'captador') {
      const assignments = result.items
        .filter((item) => item.status === 'imported' && item.contactId)
        .map((item) => ({ tenant_id: tenantId, contact_id: item.contactId, captador_id: request.requested_by }));
      if (assignments.length) {
        await trx('lead_assignments').insert(assignments).onConflict(['tenant_id', 'contact_id']).ignore();
      }
    }

    return { request, member, finalStatus, result };
  });

  const { request, member, finalStatus, result } = out;
  if (member) {
    const existing = result.items.filter((item) => item.status === 'duplicate' && item.contactId).length;
    // Depois do commit e sem derrubar a entrega: só registra a falha
    await createNotification({
      tenantId,
      userId: request.requested_by,
      type: 'lead_request.finished',
      title: FINISHED_TITLES[finalStatus],
      body:
        `${request.niche} · ${request.city} — ${result.imported} empresa(s) nova(s)` +
        (existing ? ` · ${existing} já existiam no CRM` : ''),
      resourceType: 'lead_request',
      resourceId: id,
    }).catch((err) => console.error('Falha ao notificar pedido de leads', err));
  }

  return { status: finalStatus, deliveredCount: result.imported, ...result };
}
