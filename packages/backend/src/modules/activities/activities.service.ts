import { db } from '../../db';
import { getPaginationParams, paginatedResponse } from '../../shared/utils/paginate';
import { createNotification } from '../notifications/notifications.service';
import type { CreateActivityInput, UpdateActivityInput, ListActivitiesQuery } from './activities.schema';

export async function listActivities(tenantId: string, query: ListActivitiesQuery) {
  const { page, limit, offset } = getPaginationParams(query);

  let base = db('activities as a')
    .leftJoin('users as u', 'a.user_id', 'u.id')
    .leftJoin('users as assignee', 'a.assignee_id', 'assignee.id')
    .leftJoin('contacts as c', 'a.contact_id', 'c.id')
    .leftJoin('deals as d', 'a.deal_id', 'd.id')
    .where('a.tenant_id', tenantId)
    .select(
      'a.*',
      db.raw("u.full_name as user_name"),
      db.raw("assignee.full_name as assignee_name"),
      db.raw("c.full_name as contact_name"),
      db.raw("d.title as deal_title"),
    );

  if (query.dealId) base = base.where('a.deal_id', query.dealId);
  if (query.contactId) base = base.where('a.contact_id', query.contactId);
  if (query.type) base = base.where('a.type', query.type);
  if (query.isDone !== undefined) base = base.where('a.is_done', query.isDone);

  const countQ = db('activities').where('tenant_id', tenantId);
  if (query.dealId) countQ.where('deal_id', query.dealId);
  if (query.contactId) countQ.where('contact_id', query.contactId);
  if (query.type) countQ.where('type', query.type);
  if (query.isDone !== undefined) countQ.where('is_done', query.isDone);
  const [{ count }] = await countQ.count('id as count');

  const activities = await base.orderBy('a.created_at', 'desc').limit(limit).offset(offset);
  return paginatedResponse(activities, Number(count), page, limit);
}

export async function getActivity(tenantId: string, id: string) {
  const activity = await db('activities as a')
    .leftJoin('users as u', 'a.user_id', 'u.id')
    .leftJoin('users as assignee', 'a.assignee_id', 'assignee.id')
    .where({ 'a.id': id, 'a.tenant_id': tenantId })
    .select('a.*', db.raw("u.full_name as user_name"), db.raw("assignee.full_name as assignee_name"))
    .first();

  if (!activity) throw Object.assign(new Error('Activity not found'), { status: 404 });
  return activity;
}

/** Para onde a notificação leva: o negócio da atividade, senão o contato, senão a própria atividade */
function activityTarget(a: { id: string; deal_id?: string | null; contact_id?: string | null }) {
  if (a.deal_id) return { resourceType: 'deal', resourceId: a.deal_id };
  if (a.contact_id) return { resourceType: 'contact', resourceId: a.contact_id };
  return { resourceType: 'activity', resourceId: a.id };
}

export async function createActivity(tenantId: string, userId: string, input: CreateActivityInput) {
  const [activity] = await db('activities')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      deal_id: input.dealId ?? null,
      contact_id: input.contactId ?? null,
      assignee_id: input.assigneeId ?? null,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      due_at: input.dueAt ?? null,
    })
    .returning('*');

  // Notify the assignee if different from the creator
  if (input.assigneeId && input.assigneeId !== userId) {
    createNotification({
      tenantId,
      userId: input.assigneeId,
      type: 'activity.assigned',
      title: `Nova atividade atribuída a você: ${input.title}`,
      body: input.body,
      ...activityTarget(activity),
    }).catch(() => {});
  }

  return activity;
}

export async function updateActivity(tenantId: string, userId: string, id: string, input: UpdateActivityInput) {
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.type !== undefined) updates.type = input.type;
  if (input.title !== undefined) updates.title = input.title;
  if (input.body !== undefined) updates.body = input.body ?? null;
  if (input.dueAt !== undefined) updates.due_at = input.dueAt ?? null;
  if (input.dealId !== undefined) updates.deal_id = input.dealId ?? null;
  if (input.contactId !== undefined) updates.contact_id = input.contactId ?? null;
  if (input.assigneeId !== undefined) updates.assignee_id = input.assigneeId ?? null;

  const [activity] = await db('activities')
    .where({ id, tenant_id: tenantId })
    .update(updates)
    .returning('*');

  if (!activity) throw Object.assign(new Error('Activity not found'), { status: 404 });

  if (input.assigneeId && input.assigneeId !== userId) {
    createNotification({
      tenantId,
      userId: input.assigneeId,
      type: 'activity.assigned',
      title: `Atividade atribuída a você: ${activity.title}`,
      ...activityTarget(activity),
    }).catch(() => {});
  }

  return activity;
}

export async function markDone(tenantId: string, id: string) {
  const [activity] = await db('activities')
    .where({ id, tenant_id: tenantId })
    .update({ is_done: true, updated_at: new Date() })
    .returning('*');

  if (!activity) throw Object.assign(new Error('Activity not found'), { status: 404 });
  return activity;
}

export async function deleteActivity(tenantId: string, id: string) {
  const deleted = await db('activities').where({ id, tenant_id: tenantId }).delete();
  if (!deleted) throw Object.assign(new Error('Activity not found'), { status: 404 });
}

export async function exportActivitiesCsv(tenantId: string): Promise<string> {
  const activities = await db('activities as a')
    .leftJoin('users as u', 'a.user_id', 'u.id')
    .leftJoin('users as assignee', 'a.assignee_id', 'assignee.id')
    .leftJoin('contacts as c', 'a.contact_id', 'c.id')
    .leftJoin('deals as d', 'a.deal_id', 'd.id')
    .where('a.tenant_id', tenantId)
    .orderBy('a.created_at', 'desc')
    .select(
      'a.type', 'a.title', 'a.body', 'a.is_done', 'a.due_at', 'a.created_at',
      db.raw("u.full_name as creator_name"),
      db.raw("assignee.full_name as assignee_name"),
      db.raw("c.full_name as contact_name"),
      db.raw("d.title as deal_title"),
    );

  const { stringify } = await import('csv-stringify/sync');
  return stringify(activities, {
    header: true,
    delimiter: ';',
    columns: [
      { key: 'type', header: 'Tipo' },
      { key: 'title', header: 'Titulo' },
      { key: 'body', header: 'Descricao' },
      { key: 'is_done', header: 'Concluida' },
      { key: 'due_at', header: 'Prazo' },
      { key: 'creator_name', header: 'Criado por' },
      { key: 'assignee_name', header: 'Responsavel' },
      { key: 'contact_name', header: 'Contato' },
      { key: 'deal_title', header: 'Negocio' },
      { key: 'created_at', header: 'Criado em' },
    ],
  });
}
