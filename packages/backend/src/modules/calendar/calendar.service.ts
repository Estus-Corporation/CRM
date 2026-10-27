import { db } from '../../db';
import type { CreateEventInput, UpdateEventInput, ListEventsQuery } from './calendar.schema';

/** Só participantes que são membros ativos deste espaço (ids de fora são ignorados) */
async function tenantMemberIds(tenantId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db('user_tenants').where({ tenant_id: tenantId, is_active: true }).whereIn('user_id', ids).select('user_id');
  return rows.map((r) => r.user_id as string);
}

async function getEventWithAttendees(tenantId: string, id: string) {
  const event = await db('calendar_events as e')
    .leftJoin('users as u', 'e.created_by', 'u.id')
    .leftJoin('contacts as c', 'e.contact_id', 'c.id')
    .leftJoin('deals as d', 'e.deal_id', 'd.id')
    .where({ 'e.id': id, 'e.tenant_id': tenantId })
    .select(
      'e.*',
      db.raw("u.full_name as creator_name"),
      db.raw("c.full_name as contact_name"),
      db.raw("d.title as deal_title"),
    )
    .first();

  if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });

  const attendees = await db('calendar_event_attendees as a')
    .join('users as u', 'a.user_id', 'u.id')
    .where('a.event_id', id)
    .select('a.event_id', 'a.user_id', 'a.status', db.raw("u.full_name as user_name"));

  return { ...event, attendees };
}

export async function listEvents(tenantId: string, query: ListEventsQuery) {
  let base = db('calendar_events as e')
    .where('e.tenant_id', tenantId);

  if (query.from) base = base.where('e.start_at', '>=', query.from);
  if (query.to) base = base.where('e.end_at', '<=', query.to);

  const events = await base
    .leftJoin('users as u', 'e.created_by', 'u.id')
    .orderBy('e.start_at', 'asc')
    .select('e.*', db.raw("u.full_name as creator_name"));

  const eventIds = events.map((e) => e.id);
  const attendees = eventIds.length
    ? await db('calendar_event_attendees as a')
        .join('users as u', 'a.user_id', 'u.id')
        .whereIn('a.event_id', eventIds)
        .select('a.event_id', 'a.user_id', 'a.status', db.raw("u.full_name as user_name"))
    : [];

  return events.map((e) => ({
    ...e,
    attendees: attendees.filter((a) => a.event_id === e.id),
  }));
}

export async function getEvent(tenantId: string, id: string) {
  return getEventWithAttendees(tenantId, id);
}

export async function createEvent(tenantId: string, userId: string, input: CreateEventInput) {
  const [event] = await db('calendar_events')
    .insert({
      tenant_id: tenantId,
      created_by: userId,
      deal_id: input.dealId ?? null,
      contact_id: input.contactId ?? null,
      title: input.title,
      description: input.description ?? null,
      start_at: input.startAt,
      end_at: input.endAt,
      all_day: input.allDay ?? false,
      external_attendees: JSON.stringify(input.externalAttendees ?? []),
    })
    .returning('*');

  const attendeeIds = await tenantMemberIds(tenantId, input.attendeeIds ?? []);
  if (attendeeIds.length > 0) {
    await db('calendar_event_attendees').insert(
      attendeeIds.map((uid) => ({ event_id: event.id, user_id: uid, status: 'pending' })),
    );
  }

  return getEventWithAttendees(tenantId, event.id);
}

export async function updateEvent(tenantId: string, id: string, input: UpdateEventInput) {
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description ?? null;
  if (input.startAt !== undefined) updates.start_at = input.startAt;
  if (input.endAt !== undefined) updates.end_at = input.endAt;
  if (input.allDay !== undefined) updates.all_day = input.allDay;
  if (input.dealId !== undefined) updates.deal_id = input.dealId ?? null;
  if (input.contactId !== undefined) updates.contact_id = input.contactId ?? null;
  if (input.externalAttendees !== undefined) updates.external_attendees = JSON.stringify(input.externalAttendees);

  const [event] = await db('calendar_events')
    .where({ id, tenant_id: tenantId })
    .update(updates)
    .returning('*');

  if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });

  if (input.attendeeIds !== undefined) {
    const attendeeIds = await tenantMemberIds(tenantId, input.attendeeIds);
    await db('calendar_event_attendees').where('event_id', id).delete();
    if (attendeeIds.length > 0) {
      await db('calendar_event_attendees').insert(
        attendeeIds.map((uid) => ({ event_id: id, user_id: uid, status: 'pending' })),
      );
    }
  }

  return getEventWithAttendees(tenantId, id);
}

export async function deleteEvent(tenantId: string, id: string) {
  const deleted = await db('calendar_events').where({ id, tenant_id: tenantId }).delete();
  if (!deleted) throw Object.assign(new Error('Event not found'), { status: 404 });
}

export async function addAttendee(tenantId: string, eventId: string, userId: string) {
  const event = await db('calendar_events').where({ id: eventId, tenant_id: tenantId }).first();
  if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });

  await db('calendar_event_attendees')
    .insert({ event_id: eventId, user_id: userId, status: 'pending' })
    .onConflict(['event_id', 'user_id'])
    .ignore();

  return getEventWithAttendees(tenantId, eventId);
}

export async function removeAttendee(tenantId: string, eventId: string, userId: string) {
  const event = await db('calendar_events').where({ id: eventId, tenant_id: tenantId }).first();
  if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });

  await db('calendar_event_attendees').where({ event_id: eventId, user_id: userId }).delete();
}
