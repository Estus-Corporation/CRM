import { db } from '../../db';
import { getPaginationParams, paginatedResponse } from '../../shared/utils/paginate';
import type { CreateDealInput, UpdateDealInput, ListDealsQuery } from './deals.schema';
import { fireWebhook } from '../integrations/integrations.service';
import { notifyTenantUsers } from '../notifications/notifications.service';

async function logAudit(
  tenantId: string,
  userId: string,
  action: string,
  resourceId: string,
  payload?: Record<string, unknown>,
) {
  await db('audit_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action,
    resource_type: 'deal',
    resource_id: resourceId,
    payload: payload ? JSON.stringify(payload) : null,
  });
}

export async function getKanban(tenantId: string, pipelineId: string) {
  const stages = await db('pipeline_stages')
    .where({ pipeline_id: pipelineId, tenant_id: tenantId })
    .orderBy('position', 'asc');

  const aggRows = await db('deals')
    .where({ pipeline_id: pipelineId, tenant_id: tenantId, status: 'open' })
    .groupBy('stage_id')
    .select('stage_id')
    .count('id as deal_count')
    .sum('value as total_value');

  const aggMap = new Map(aggRows.map((r) => [r.stage_id as string, r]));

  return stages.map((s) => {
    const agg = aggMap.get(s.id);
    return {
      ...s,
      dealCount: Number(agg?.deal_count ?? 0),
      totalValue: Number(agg?.total_value ?? 0),
    };
  });
}

const KANBAN_STAGE_LIMIT = 20;

export async function getStageDeals(tenantId: string, stageId: string, page: number) {
  const limit = KANBAN_STAGE_LIMIT;
  const offset = (page - 1) * limit;

  const [countRow] = await db('deals')
    .where({ stage_id: stageId, tenant_id: tenantId, status: 'open' })
    .count('id as count');
  const total = Number(countRow.count);

  const deals = await db('deals as d')
    .leftJoin('contacts as c', 'd.contact_id', 'c.id')
    .leftJoin('users as u', 'd.owner_id', 'u.id')
    .where({ 'd.stage_id': stageId, 'd.tenant_id': tenantId, 'd.status': 'open' })
    .orderBy('d.position', 'asc')
    .limit(limit)
    .offset(offset)
    .select(
      'd.id', 'd.title', 'd.value', 'd.currency', 'd.status',
      'd.stage_id', 'd.owner_id', 'd.expected_close', 'd.position',
      'd.created_at',
      db.raw("c.full_name as contact_name"),
      db.raw("u.full_name as owner_name"),
    );

  return {
    deals,
    page,
    limit,
    total,
    hasMore: offset + deals.length < total,
  };
}

export async function listDeals(tenantId: string, query: ListDealsQuery) {
  const { page, limit, offset } = getPaginationParams(query);

  let base = db('deals as d')
    .leftJoin('contacts as c', 'd.contact_id', 'c.id')
    .leftJoin('users as u', 'd.owner_id', 'u.id')
    .where('d.tenant_id', tenantId)
    .select(
      'd.*',
      db.raw("c.full_name as contact_name"),
      db.raw("u.full_name as owner_name"),
    );

  if (query.pipeline) base = base.where('d.pipeline_id', query.pipeline);
  if (query.stage) base = base.where('d.stage_id', query.stage);
  if (query.status) base = base.where('d.status', query.status);
  if (query.owner) base = base.where('d.owner_id', query.owner);
  if (query.contact) base = base.where('d.contact_id', query.contact);
  if (query.q) {
    const term = `%${query.q}%`;
    base = base.where((b) =>
      b.whereILike('d.title', term).orWhereILike('c.full_name', term),
    );
  }

  const countQ = db('deals as d')
    .leftJoin('contacts as c', 'd.contact_id', 'c.id')
    .where('d.tenant_id', tenantId);
  if (query.pipeline) countQ.where('d.pipeline_id', query.pipeline);
  if (query.stage) countQ.where('d.stage_id', query.stage);
  if (query.status) countQ.where('d.status', query.status);
  if (query.owner) countQ.where('d.owner_id', query.owner);
  if (query.contact) countQ.where('d.contact_id', query.contact);
  if (query.q) {
    const term = `%${query.q}%`;
    countQ.where((b) =>
      b.whereILike('d.title', term).orWhereILike('c.full_name', term),
    );
  }
  const [{ count }] = await countQ.count('d.id as count');

  const deals = await base.orderBy('d.created_at', 'desc').limit(limit).offset(offset);
  return paginatedResponse(deals, Number(count), page, limit);
}

export async function getDeal(tenantId: string, id: string) {
  const deal = await db('deals as d')
    .leftJoin('contacts as c', 'd.contact_id', 'c.id')
    .leftJoin('users as u', 'd.owner_id', 'u.id')
    .where({ 'd.id': id, 'd.tenant_id': tenantId })
    .select('d.*', db.raw("c.full_name as contact_name"), db.raw("u.full_name as owner_name"))
    .first();

  if (!deal) throw Object.assign(new Error('Deal not found'), { status: 404 });
  return deal;
}

export async function createDeal(tenantId: string, userId: string, input: CreateDealInput) {
  const [{ maxPos }] = await db('deals')
    .where({ stage_id: input.stageId, tenant_id: tenantId })
    .max('position as maxPos');

  const [deal] = await db('deals')
    .insert({
      tenant_id: tenantId,
      pipeline_id: input.pipelineId,
      stage_id: input.stageId,
      contact_id: input.contactId || null,
      owner_id: input.ownerId || null,
      title: input.title,
      value: input.value ?? 0,
      currency: input.currency ?? 'BRL',
      expected_close: input.expectedClose || null,
      custom_fields: input.customFields ? JSON.stringify(input.customFields) : '{}',
      position: Number(maxPos ?? -1) + 1,
    })
    .returning('*');

  await logAudit(tenantId, userId, 'deal.created', deal.id);
  fireWebhook(tenantId, 'deal.created', deal).catch(() => {});
  return deal;
}

export async function updateDeal(
  tenantId: string,
  id: string,
  input: UpdateDealInput,
) {
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.title !== undefined) updates.title = input.title;
  if (input.value !== undefined) updates.value = input.value;
  if (input.currency !== undefined) updates.currency = input.currency;
  if (input.contactId !== undefined) updates.contact_id = input.contactId || null;
  if (input.ownerId !== undefined) updates.owner_id = input.ownerId || null;
  if (input.expectedClose !== undefined) updates.expected_close = input.expectedClose || null;
  if (input.customFields !== undefined) updates.custom_fields = JSON.stringify(input.customFields);

  const [deal] = await db('deals')
    .where({ id, tenant_id: tenantId })
    .update(updates)
    .returning('*');

  if (!deal) throw Object.assign(new Error('Deal not found'), { status: 404 });
  return deal;
}

export async function moveDeal(
  tenantId: string,
  userId: string,
  id: string,
  stageId: string,
  position?: number,
) {
  const current = await db('deals').where({ id, tenant_id: tenantId }).first();
  if (!current) throw Object.assign(new Error('Deal not found'), { status: 404 });

  const [{ maxPos }] = await db('deals')
    .where({ stage_id: stageId, tenant_id: tenantId })
    .max('position as maxPos');

  const [deal] = await db('deals')
    .where({ id, tenant_id: tenantId })
    .update({
      stage_id: stageId,
      position: position ?? Number(maxPos ?? -1) + 1,
      updated_at: new Date(),
    })
    .returning('*');

  await logAudit(tenantId, userId, 'deal.stage_changed', id, {
    from: current.stage_id,
    to: stageId,
  });
  fireWebhook(tenantId, 'deal.stage_changed', { ...deal, previous_stage_id: current.stage_id }).catch(() => {});
  notifyTenantUsers(tenantId, userId, 'deal.stage_changed', `Deal movido: ${deal.title}`, undefined, 'deal', id).catch(() => {});

  return deal;
}

export async function markWon(tenantId: string, userId: string, id: string) {
  const [deal] = await db('deals')
    .where({ id, tenant_id: tenantId })
    .update({ status: 'won', closed_at: new Date(), updated_at: new Date() })
    .returning('*');

  if (!deal) throw Object.assign(new Error('Deal not found'), { status: 404 });
  await logAudit(tenantId, userId, 'deal.won', id);
  fireWebhook(tenantId, 'deal.won', deal).catch(() => {});
  notifyTenantUsers(tenantId, userId, 'deal.won', `Deal ganho: ${deal.title}`, undefined, 'deal', id).catch(() => {});
  return deal;
}

export async function markLost(tenantId: string, userId: string, id: string, lostReason?: string) {
  const [deal] = await db('deals')
    .where({ id, tenant_id: tenantId })
    .update({
      status: 'lost',
      lost_reason: lostReason || null,
      closed_at: new Date(),
      updated_at: new Date(),
    })
    .returning('*');

  if (!deal) throw Object.assign(new Error('Deal not found'), { status: 404 });
  await logAudit(tenantId, userId, 'deal.lost', id, { reason: lostReason });
  fireWebhook(tenantId, 'deal.lost', deal).catch(() => {});
  notifyTenantUsers(tenantId, userId, 'deal.lost', `Deal perdido: ${deal.title}`, lostReason, 'deal', id).catch(() => {});
  return deal;
}

export async function markOpen(tenantId: string, userId: string, id: string) {
  const [deal] = await db('deals')
    .where({ id, tenant_id: tenantId })
    .update({ status: 'open', closed_at: null, lost_reason: null, updated_at: new Date() })
    .returning('*');

  if (!deal) throw Object.assign(new Error('Deal not found'), { status: 404 });
  await logAudit(tenantId, userId, 'deal.reopened', id);
  fireWebhook(tenantId, 'deal.reopened', deal).catch(() => {});
  return deal;
}

export async function reorderDeals(tenantId: string, stageId: string, dealIds: string[]) {
  await db.transaction(async (trx) => {
    for (let i = 0; i < dealIds.length; i++) {
      await trx('deals')
        .where({ id: dealIds[i], stage_id: stageId, tenant_id: tenantId })
        .update({ position: i, updated_at: new Date() });
    }
  });
}

export async function exportDealsCsv(tenantId: string): Promise<string> {
  const deals = await db('deals as d')
    .leftJoin('contacts as c', 'd.contact_id', 'c.id')
    .leftJoin('users as u', 'd.owner_id', 'u.id')
    .leftJoin('pipeline_stages as ps', 'd.stage_id', 'ps.id')
    .leftJoin('pipelines as p', 'd.pipeline_id', 'p.id')
    .where('d.tenant_id', tenantId)
    .orderBy('d.created_at', 'desc')
    .select(
      'd.title', 'd.value', 'd.currency', 'd.status', 'd.expected_close',
      'd.closed_at', 'd.lost_reason', 'd.created_at',
      db.raw("c.full_name as contact_name"),
      db.raw("u.full_name as owner_name"),
      db.raw("ps.name as stage_name"),
      db.raw("p.name as pipeline_name"),
    );

  const { stringify } = await import('csv-stringify/sync');
  return stringify(deals, {
    header: true,
    columns: [
      { key: 'title', header: 'Title' },
      { key: 'value', header: 'Value' },
      { key: 'currency', header: 'Currency' },
      { key: 'status', header: 'Status' },
      { key: 'pipeline_name', header: 'Pipeline' },
      { key: 'stage_name', header: 'Stage' },
      { key: 'contact_name', header: 'Contact' },
      { key: 'owner_name', header: 'Owner' },
      { key: 'expected_close', header: 'Expected Close' },
      { key: 'closed_at', header: 'Closed At' },
      { key: 'lost_reason', header: 'Lost Reason' },
      { key: 'created_at', header: 'Created At' },
    ],
  });
}

export async function deleteDeal(tenantId: string, id: string) {
  await db.transaction(async (trx) => {
    const count = await trx('deals').where({ id, tenant_id: tenantId }).delete();
    if (!count) throw Object.assign(new Error('Deal not found'), { status: 404 });
    // Clean up orphaned records that have no FK cascade
    await trx('audit_logs').where({ tenant_id: tenantId, resource_type: 'deal', resource_id: id }).delete();
    await trx('notifications').where({ tenant_id: tenantId, resource_id: id }).delete();
  });
}
