import type { Knex } from 'knex';
import { db } from '../../db';
import { getPaginationParams, paginatedResponse } from '../../shared/utils/paginate';
import { createNotification } from '../notifications/notifications.service';
import type {
  UpdateMyLeadInput,
  MyLeadsQuery,
  AssignLeadsInput,
  AvailableContactsQuery,
  AssignmentsQuery,
  CloseAssignmentInput,
  CreateLeadInput,
} from './captacao.schema';
import { createContact } from '../contacts/contacts.service';

// "Hoje" no fuso do Brasil — o servidor e o banco rodam em UTC
const TODAY = db.raw("(now() AT TIME ZONE 'America/Sao_Paulo')::date");

function httpError(message: string, status: number, code?: string) {
  return Object.assign(new Error(message), { status, code });
}

/** Contatos ainda sem captador (clientes ficam de fora: já fecharam) */
function availableContactsBase(tenantId: string) {
  return db('contacts as c')
    .where('c.tenant_id', tenantId)
    .whereNot('c.type', 'client')
    .whereNotExists(
      db('lead_assignments as a').whereRaw('a.contact_id = c.id').andWhere('a.tenant_id', tenantId),
    );
}

async function getActiveCaptador(tenantId: string, captadorId: string) {
  // Captador = vínculo ativo com papel captador neste workspace
  const captador = await db('user_tenants as ut')
    .join('users as u', 'ut.user_id', 'u.id')
    .where({ 'ut.user_id': captadorId, 'ut.tenant_id': tenantId, 'ut.role': 'captador', 'ut.is_active': true })
    .first('u.id', 'u.full_name');
  if (!captador) throw httpError('Captador not found', 404);
  return captador;
}

const assignedTitle = (count: number) => (count === 1 ? 'Você recebeu 1 lead novo' : `Você recebeu ${count} leads novos`);

/**
 * Avisa o captador dos leads recebidos. Leads que chegam em sequência (ex.: admin cadastrando um a um
 * já entregues) somam na notificação ainda não lida das últimas horas — uma só com o total, não uma por lead.
 */
async function notifyAssigned(tenantId: string, captadorId: string, count: number) {
  if (count === 0) return;
  const pending = await db('notifications')
    .where({ tenant_id: tenantId, user_id: captadorId, type: 'leads.assigned', read: false })
    .where('created_at', '>', db.raw("now() - interval '6 hours'"))
    .orderBy('created_at', 'desc')
    .first('id', 'title');
  if (pending) {
    const previous = Number(/(\d+) leads? nov/.exec(pending.title)?.[1] ?? 0);
    await db('notifications')
      .where({ id: pending.id })
      .update({ title: assignedTitle(previous + count), created_at: db.fn.now() });
    return;
  }
  await createNotification({
    tenantId,
    userId: captadorId,
    type: 'leads.assigned',
    title: assignedTitle(count),
    body: 'Confira em Meus leads e registre o resultado de cada ligação.',
  });
}

// ── Captador: só os próprios leads ──────────────────────────────────────────

const MY_LEAD_COLUMNS = [
  'a.id', 'a.call_status', 'a.call_notes', 'a.call_updated_at', 'a.assigned_for', 'a.outcome',
  'a.closed_at', 'a.commission_paid_at', 'a.concluded_at', 'a.on_hold_at',
  'a.meeting_at', 'a.meeting_mode', 'a.meeting_location',
  'a.meeting_duration', 'a.meeting_attendee_ids', 'a.meeting_guests',
  'a.whatsapp_at', 'a.whatsapp_count', 'a.whatsapp_status',
  db.raw('a.commission_value::float8 as commission_value'),
  'c.full_name', 'c.phone', 'c.email', 'c.company_name', 'c.job_title', 'c.niche', 'c.lead_context', 'c.lead_people',
  // Dados de prospecção (LeadHunter / planilha)
  'c.address', 'c.maps_url', 'c.instagram', 'c.website', 'c.google_reviews',
  db.raw('c.google_rating::float8 as google_rating'),
];

export async function listMyLeads(tenantId: string, userId: string, query: MyLeadsQuery) {
  const q = db('lead_assignments as a')
    .join('contacts as c', 'a.contact_id', 'c.id')
    .where({ 'a.tenant_id': tenantId, 'a.captador_id': userId })
    .select(MY_LEAD_COLUMNS);

  if (query.scope === 'today') q.where('a.assigned_for', TODAY);
  if (query.scope === 'open') q.whereNull('a.outcome');
  if (query.scope === 'won') q.where('a.outcome', 'won');
  if (query.status) q.where('a.call_status', query.status);

  // A fazer primeiro (não concluídos), depois os mais recentes
  return q
    .orderByRaw('CASE WHEN a.concluded_at IS NULL THEN 0 ELSE 1 END')
    .orderBy('a.assigned_for', 'desc')
    .orderBy('c.full_name', 'asc')
    .limit(500);
}

/** Um lead do captador (página do lead) — só os atribuídos a ele */
export async function getMyLead(tenantId: string, userId: string, id: string) {
  const lead = await db('lead_assignments as a')
    .join('contacts as c', 'a.contact_id', 'c.id')
    .where({ 'a.id': id, 'a.tenant_id': tenantId, 'a.captador_id': userId })
    .select(MY_LEAD_COLUMNS)
    .first();
  if (!lead) throw httpError('Lead not found', 404);
  return lead;
}

/**
 * Mantém o evento da reunião no calendário igual ao lead: reunião concluída → cria/atualiza o evento
 * (admins como participantes); outro resultado ou lead reaberto sem reunião → remove o evento.
 */
async function syncMeetingEvent(tenantId: string, userId: string, assignmentId: string) {
  const a = await db('lead_assignments as a')
    .join('contacts as c', 'a.contact_id', 'c.id')
    .where({ 'a.id': assignmentId, 'a.tenant_id': tenantId })
    .first(
      'a.call_status', 'a.concluded_at', 'a.meeting_at', 'a.meeting_mode', 'a.meeting_location', 'a.meeting_event_id',
      'a.meeting_duration', 'a.meeting_attendee_ids', 'a.meeting_guests', 'a.contact_id', 'c.full_name', 'c.company_name',
    );
  if (!a) return;

  const wantsEvent = a.concluded_at && a.call_status === 'meeting' && a.meeting_at;
  if (!wantsEvent) {
    if (a.meeting_event_id) {
      await db('calendar_events').where({ id: a.meeting_event_id, tenant_id: tenantId }).delete();
      await db('lead_assignments').where({ id: assignmentId }).update({ meeting_event_id: null });
    }
    return;
  }

  const start = new Date(a.meeting_at);
  const end = new Date(start.getTime() + (a.meeting_duration ?? 60) * 60_000);
  const mode = a.meeting_mode === 'online' ? 'Online' : 'Presencial';
  const fields = {
    title: `Reunião: ${a.company_name || a.full_name}`,
    description: [`${mode}${a.meeting_location ? ` · ${a.meeting_location}` : ''}`, 'Marcada pela captação'].join('\n'),
    start_at: start,
    end_at: end,
    contact_id: a.contact_id,
    external_attendees: JSON.stringify(a.meeting_guests ?? []),
    updated_at: new Date(),
  };

  // Participantes: os admins escolhidos (só admins ativos do espaço); sem escolha, todos os admins
  const admins: string[] = await db('user_tenants').where({ tenant_id: tenantId, role: 'admin', is_active: true }).pluck('user_id');
  const chosen = ((a.meeting_attendee_ids ?? []) as string[]).filter((id) => admins.includes(id));
  // Só os admins participam (quem captou fica registrado no próprio lead, não na reunião)
  const attendeeIds = chosen.length ? chosen : admins;

  let eventId = a.meeting_event_id as string | null;
  const updated = eventId ? await db('calendar_events').where({ id: eventId, tenant_id: tenantId }).update(fields) : 0;
  if (!updated) {
    const [event] = await db('calendar_events')
      .insert({ tenant_id: tenantId, created_by: userId, all_day: false, ...fields })
      .returning('id');
    eventId = event.id as string;
    await db('lead_assignments').where({ id: assignmentId }).update({ meeting_event_id: eventId });
  }
  await db('calendar_event_attendees').where({ event_id: eventId }).delete();
  if (attendeeIds.length) {
    await db('calendar_event_attendees').insert(attendeeIds.map((uid) => ({ event_id: eventId, user_id: uid, status: 'pending' })));
  }
}

/** Captador colocou um lead em aguardo: notificação pra cada admin ativo do espaço */
async function notifyOnHold(tenantId: string, captadorId: string, contactId: string) {
  const [captador, contact, admins] = await Promise.all([
    db('users').where({ id: captadorId }).first('full_name'),
    db('contacts').where({ id: contactId, tenant_id: tenantId }).first('full_name', 'company_name'),
    db('user_tenants as ut')
      .join('users as u', 'ut.user_id', 'u.id')
      .where({ 'ut.tenant_id': tenantId, 'ut.role': 'admin', 'ut.is_active': true, 'u.is_active': true })
      .pluck('u.id'),
  ]);
  const leadName = contact?.company_name || contact?.full_name || 'um lead';
  await Promise.all(
    (admins as string[]).map((adminId) =>
      createNotification({
        tenantId,
        userId: adminId,
        type: 'leads.on_hold',
        title: `${captador?.full_name ?? 'Captador'} colocou ${leadName} em aguardo`,
        body: 'Veja em Captação › Acompanhamento.',
        resourceType: 'contact',
        resourceId: contactId,
      }),
    ),
  );
}

export async function updateMyLead(tenantId: string, userId: string, id: string, input: UpdateMyLeadInput) {
  const lead = await db('lead_assignments')
    .where({ id, tenant_id: tenantId, captador_id: userId })
    .first('id', 'outcome', 'call_status', 'contact_id', 'on_hold_at');
  if (!lead) throw httpError('Lead not found', 404);
  if (lead.outcome) throw httpError('Lead already closed by an admin', 409);

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.callStatus !== undefined || input.callNotes !== undefined) updates.call_updated_at = new Date();
  if (input.callStatus !== undefined) updates.call_status = input.callStatus;
  if (input.callNotes !== undefined) updates.call_notes = input.callNotes?.trim() || null;
  if (input.meetingAt !== undefined) updates.meeting_at = input.meetingAt ? new Date(input.meetingAt) : null;
  if (input.meetingMode !== undefined) updates.meeting_mode = input.meetingMode;
  if (input.meetingLocation !== undefined) updates.meeting_location = input.meetingLocation || null;
  if (input.meetingDuration !== undefined) updates.meeting_duration = input.meetingDuration;
  if (input.meetingAttendeeIds !== undefined) updates.meeting_attendee_ids = JSON.stringify(input.meetingAttendeeIds);
  if (input.meetingGuests !== undefined) updates.meeting_guests = JSON.stringify(input.meetingGuests);
  if (input.whatsappStatus !== undefined) updates.whatsapp_status = input.whatsappStatus;

  // "Concluir lead" exige um resultado escolhido; "Editar" reabre
  if (input.concluded === true) {
    const status = input.callStatus ?? lead.call_status;
    if (status === 'pending') throw httpError('Choose a call result before concluding', 422, 'result_required');
    if (status === 'meeting' && (!input.meetingAt || !input.meetingMode)) {
      throw httpError('Meeting date and mode are required', 422, 'meeting_required');
    }
    // Só reunião guarda agenda
    if (status !== 'meeting') {
      Object.assign(updates, {
        meeting_at: null,
        meeting_mode: null,
        meeting_location: null,
        meeting_duration: null,
        meeting_attendee_ids: '[]',
        meeting_guests: '[]',
      });
    }
    updates.concluded_at = new Date();
    updates.on_hold_at = null;
  } else if (input.concluded === false) {
    updates.concluded_at = null;
  }
  // "Em aguardo" não conclui: só marca que o captador espera o lead
  if (input.onHold !== undefined && input.concluded !== true) updates.on_hold_at = input.onHold ? new Date() : null;

  await db('lead_assignments').where({ id, tenant_id: tenantId, captador_id: userId }).update(updates);
  // Pessoas de contato ficam na empresa (o admin também vê); só a do lead deste captador
  if (input.leadPeople !== undefined) {
    const people = input.leadPeople.map((p) => ({
      name: p.name,
      ...(p.title ? { title: p.title } : {}),
      ...(p.phone ? { phone: p.phone } : {}),
      ...(p.email ? { email: p.email.toLowerCase() } : {}),
    }));
    await db('contacts')
      .where({ id: lead.contact_id, tenant_id: tenantId })
      .update({ lead_people: JSON.stringify(people), updated_at: new Date() });
  }
  if (input.concluded !== undefined) await syncMeetingEvent(tenantId, userId, id);
  // Acabou de entrar em aguardo → avisa os admins
  if (input.onHold === true && input.concluded !== true && !lead.on_hold_at) await notifyOnHold(tenantId, userId, lead.contact_id);

  return db('lead_assignments as a')
    .join('contacts as c', 'a.contact_id', 'c.id')
    .where({ 'a.id': id, 'a.tenant_id': tenantId })
    .select(MY_LEAD_COLUMNS)
    .first();
}

// Datas no fuso do Brasil (o banco guarda em UTC)
const LOCAL_DAY = (col: string) => `(${col} AT TIME ZONE 'America/Sao_Paulo')::date`;

/**
 * Painel do captador: números do período (últimos 7 ou 30 dias) comparados com o período anterior,
 * atividade por dia, funil dos leads recebidos no período e resultado das ligações.
 * "Ligação feita" = lead cujo resultado foi registrado (call_updated_at) no dia — guardamos o último
 * resultado de cada lead, não cada ligação.
 */
export async function getMyStats(tenantId: string, userId: string, days: 7 | 30) {
  const LOCAL_TODAY = "(now() AT TIME ZONE 'America/Sao_Paulo')::date";

  // Parâmetros posicionais (?): com bindings nomeados o Knex confunde ":nome::int" com identificador.
  // offset/days são números validados (7/30), seguros pra interpolar.

  // Mesma conta para o período atual (offset 0) e o anterior (offset = days)
  const periodTotals = (offset: number) => {
    const start = `${LOCAL_TODAY} - ${offset + days - 1}`;
    const end = `${LOCAL_TODAY} - ${offset}`;
    const inPeriod = (expr: string) => `${expr} BETWEEN ${start} AND ${end}`;
    return db.raw(
      `
      SELECT
        count(*) FILTER (WHERE ${inPeriod('a.assigned_for')})::int AS received,
        count(*) FILTER (WHERE a.call_status <> 'pending' AND ${inPeriod(LOCAL_DAY('a.call_updated_at'))})::int AS called,
        count(*) FILTER (WHERE a.call_status = 'meeting' AND ${inPeriod(LOCAL_DAY('a.call_updated_at'))})::int AS meetings,
        count(*) FILTER (WHERE a.outcome = 'won' AND ${inPeriod(LOCAL_DAY('a.closed_at'))})::int AS won,
        coalesce(sum(a.commission_value) FILTER (WHERE a.outcome = 'won' AND ${inPeriod(LOCAL_DAY('a.closed_at'))}), 0)::float8 AS commission
      FROM lead_assignments a
      WHERE a.tenant_id = ? AND a.captador_id = ?
      `,
      [tenantId, userId],
    );
  };

  const daily = db.raw(
    `
    WITH series AS (
      SELECT generate_series(${LOCAL_TODAY} - ${days - 1}, ${LOCAL_TODAY}, interval '1 day')::date AS day
    ),
    mine AS (
      SELECT * FROM lead_assignments WHERE tenant_id = ? AND captador_id = ?
    )
    SELECT
      to_char(s.day, 'YYYY-MM-DD') AS day,
      (SELECT count(*) FROM mine m WHERE m.assigned_for = s.day)::int AS received,
      (SELECT count(*) FROM mine m WHERE m.call_status <> 'pending' AND ${LOCAL_DAY('m.call_updated_at')} = s.day)::int AS called,
      (SELECT count(*) FROM mine m WHERE m.call_status = 'meeting' AND ${LOCAL_DAY('m.call_updated_at')} = s.day)::int AS meetings
    FROM series s
    ORDER BY s.day
    `,
    [tenantId, userId],
  );

  // Coorte: leads recebidos no período, e até onde cada um chegou
  const cohort = db.raw(
    `
    SELECT
      count(*)::int AS received,
      count(*) FILTER (WHERE call_status <> 'pending')::int AS called,
      count(*) FILTER (WHERE call_status = 'meeting' OR outcome = 'won')::int AS meetings,
      count(*) FILTER (WHERE outcome = 'won')::int AS won,
      count(*) FILTER (WHERE call_status = 'pending')::int AS st_pending,
      count(*) FILTER (WHERE call_status = 'no_answer')::int AS st_no_answer,
      count(*) FILTER (WHERE call_status = 'callback')::int AS st_callback,
      count(*) FILTER (WHERE call_status = 'meeting')::int AS st_meeting,
      count(*) FILTER (WHERE call_status = 'lost')::int AS st_lost
    FROM lead_assignments
    WHERE tenant_id = ? AND captador_id = ? AND assigned_for >= ${LOCAL_TODAY} - ${days - 1}
    `,
    [tenantId, userId],
  );

  const [current, previous, dailyRows, cohortRows] = await Promise.all([periodTotals(0), periodTotals(days), daily, cohort]);
  const c = cohortRows.rows[0];

  return {
    days,
    current: current.rows[0],
    previous: previous.rows[0],
    daily: dailyRows.rows,
    funnel: [
      { stage: 'Recebidos', value: c.received },
      { stage: 'Ligados', value: c.called },
      { stage: 'Reuniões', value: c.meetings },
      { stage: 'Fechados', value: c.won },
    ],
    byStatus: {
      pending: c.st_pending,
      no_answer: c.st_no_answer,
      callback: c.st_callback,
      meeting: c.st_meeting,
      lost: c.st_lost,
    },
  };
}

export async function getMySummary(tenantId: string, userId: string) {
  const row = await db('lead_assignments')
    .where({ tenant_id: tenantId, captador_id: userId })
    .first(
      db.raw('count(*) filter (where assigned_for = ?)::int as today_total', [TODAY]),
      db.raw("count(*) filter (where assigned_for = ? and call_status = 'pending')::int as today_pending", [TODAY]),
      // Concluídos hoje / leads de hoje ainda sem concluir (barra de progresso do captador)
      db.raw('count(*) filter (where assigned_for = ? and concluded_at is not null)::int as today_concluded', [TODAY]),
      db.raw("count(*) filter (where outcome is null and call_status = 'pending')::int as open_pending", []),
      db.raw("count(*) filter (where call_status = 'meeting')::int as meetings", []),
      db.raw("count(*) filter (where outcome = 'won')::int as won", []),
      db.raw("coalesce(sum(commission_value) filter (where outcome = 'won' and commission_paid_at is null), 0)::float8 as commission_pending", []),
      db.raw("coalesce(sum(commission_value) filter (where outcome = 'won' and commission_paid_at is not null), 0)::float8 as commission_paid", []),
    );
  return row;
}

// ── Admin / gerente ─────────────────────────────────────────────────────────

/** Captadores do workspace com os números de cada um (leads, ligações, fechamentos, comissão) */
export async function listCaptadores(tenantId: string) {
  return db('user_tenants as ut')
    .join('users as u', 'ut.user_id', 'u.id')
    .leftJoin('lead_assignments as a', function joinOwn(this: Knex.JoinClause) {
      this.on('a.captador_id', '=', 'u.id').andOn('a.tenant_id', '=', 'ut.tenant_id');
    })
    .where({ 'ut.tenant_id': tenantId, 'ut.role': 'captador' })
    .groupBy('u.id', 'ut.id')
    .orderBy('u.full_name', 'asc')
    .select(
      'u.id', 'u.full_name', 'u.email', 'u.avatar_url', 'ut.is_active', 'u.last_login_at',
      db.raw('count(a.id)::int as total'),
      db.raw('count(a.id) filter (where a.assigned_for = ?)::int as today', [TODAY]),
      db.raw("count(a.id) filter (where a.outcome is null and a.call_status = 'pending')::int as pending", []),
      db.raw("count(a.id) filter (where a.call_status = 'no_answer')::int as no_answer", []),
      db.raw("count(a.id) filter (where a.call_status = 'callback')::int as callback", []),
      db.raw("count(a.id) filter (where a.call_status = 'meeting')::int as meetings", []),
      db.raw("count(a.id) filter (where a.call_status = 'lost')::int as lost", []),
      db.raw("count(a.id) filter (where a.outcome = 'won')::int as won", []),
      db.raw("coalesce(sum(a.deal_value) filter (where a.outcome = 'won'), 0)::float8 as won_value", []),
      db.raw("coalesce(sum(a.commission_value) filter (where a.outcome = 'won' and a.commission_paid_at is null), 0)::float8 as commission_pending", []),
      db.raw("coalesce(sum(a.commission_value) filter (where a.outcome = 'won' and a.commission_paid_at is not null), 0)::float8 as commission_paid", []),
    );
}

/**
 * Ficha de um lead pro admin/gerente (página aberta pela aba Distribuir): dados do contato e, se já
 * estiver com alguém, com quem. Só leads (não clientes) do workspace.
 */
export async function getLeadForManager(tenantId: string, contactId: string) {
  const lead = await db('contacts as c')
    .leftJoin('lead_assignments as a', function joinAssignment() {
      this.on('a.contact_id', '=', 'c.id').andOn('a.tenant_id', '=', 'c.tenant_id');
    })
    .leftJoin('users as u', 'a.captador_id', 'u.id')
    .where({ 'c.tenant_id': tenantId, 'c.id': contactId })
    .whereNot('c.type', 'client')
    .first(
      'c.id', 'c.full_name', 'c.phone', 'c.email', 'c.company_name', 'c.job_title', 'c.niche', 'c.created_at',
      'c.address', 'c.maps_url', 'c.instagram', 'c.website', 'c.google_reviews', 'c.lead_context', 'c.lead_people',
      db.raw('c.google_rating::float8 as google_rating'),
      db.raw('a.id as assignment_id'), db.raw('u.full_name as captador_name'),
    );
  if (!lead) throw httpError('Lead not found', 404);
  return lead;
}

export async function listAvailableContacts(tenantId: string, query: AvailableContactsQuery) {
  const { page, limit, offset } = getPaginationParams(query);

  const base = availableContactsBase(tenantId);
  if (query.niche) base.where('c.niche', query.niche);
  if (query.search) {
    const term = `%${query.search}%`;
    base.where((q) =>
      q.whereILike('c.full_name', term).orWhereILike('c.company_name', term).orWhereILike('c.phone', term),
    );
  }

  const [{ count }] = await base.clone().count('c.id as count');
  const rows = await base
    .clone()
    .select(
      'c.id', 'c.full_name', 'c.phone', 'c.email', 'c.company_name', 'c.niche', 'c.created_at', 'c.google_reviews',
      db.raw('c.google_rating::float8 as google_rating'),
    )
    .orderBy('c.created_at', 'asc')
    .limit(limit)
    .offset(offset);

  return paginatedResponse(rows, Number(count), page, limit);
}

export async function assignLeads(tenantId: string, adminId: string, input: AssignLeadsInput) {
  await getActiveCaptador(tenantId, input.captadorId);

  // Só contatos do próprio workspace
  const ids = [...new Set(input.contactIds)];
  const valid = await db('contacts').where({ tenant_id: tenantId }).whereIn('id', ids).pluck('id');

  const inserted = valid.length
    ? await db('lead_assignments')
        .insert(valid.map((contactId: string) => ({
          tenant_id: tenantId,
          contact_id: contactId,
          captador_id: input.captadorId,
          assigned_by: adminId,
        })))
        .onConflict(['tenant_id', 'contact_id'])
        .ignore()
        .returning('id')
    : [];

  await notifyAssigned(tenantId, input.captadorId, inserted.length);
  return { assigned: inserted.length, skipped: ids.length - inserted.length };
}

/**
 * Lead cadastrado à mão: recusa duplicado (mesmo telefone ou e-mail no workspace) e, se vier
 * captadorId, já entrega o lead pra ele.
 */
export async function createLead(tenantId: string, adminId: string, input: CreateLeadInput) {
  const phoneDigits = input.phone?.replace(/\D/g, '') ?? '';
  const email = input.email?.toLowerCase() || '';
  if (phoneDigits.length >= 8 || email) {
    const duplicate = await db('contacts')
      .where({ tenant_id: tenantId })
      .where((q) => {
        if (phoneDigits.length >= 8) q.orWhereRaw("regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = ?", [phoneDigits]);
        if (email) q.orWhereRaw('lower(email) = ?', [email]);
      })
      .first('id', 'full_name');
    if (duplicate) {
      throw Object.assign(new Error('Lead already exists'), { status: 409, code: 'duplicate_lead', existing: duplicate.full_name });
    }
  }

  if (input.captadorId) await getActiveCaptador(tenantId, input.captadorId);

  const contact = await createContact(tenantId, {
    type: 'lead',
    fullName: input.fullName,
    phone: input.phone || undefined,
    email: email || undefined,
    companyName: input.companyName || undefined,
    jobTitle: input.jobTitle || undefined,
    niche: input.niche || undefined,
    address: input.address || undefined,
    mapsUrl: input.mapsUrl || undefined,
    instagram: input.instagram || undefined,
    website: input.website || undefined,
    leadContext: input.leadContext || undefined,
    source: 'Manual',
  });

  if (input.captadorId) {
    await db('lead_assignments').insert({
      tenant_id: tenantId,
      contact_id: contact.id,
      captador_id: input.captadorId,
      assigned_by: adminId,
    });
    // Captador que cadastrou o próprio lead não precisa ser avisado
    if (input.captadorId !== adminId) await notifyAssigned(tenantId, input.captadorId, 1);
  }

  return { id: contact.id, full_name: contact.full_name, assigned: !!input.captadorId };
}

/**
 * Distribuição automática diária: completa a cota do dia do captador (configuração do workspace)
 * com os leads livres mais antigos. Roda quando ele abre "Meus leads" — o que o admin atribuiu
 * à mão hoje conta na cota. O lock por workspace evita duas abas/captadores pegando o mesmo lead
 * ou estourando a cota ao mesmo tempo.
 */
export async function topUpDailyLeads(tenantId: string, captadorId: string) {
  const assigned = await db.transaction(async (trx) => {
    await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`daily-leads:${tenantId}`]);

    const member = await trx('user_tenants')
      .where({ tenant_id: tenantId, user_id: captadorId, role: 'captador', is_active: true })
      .first('id');
    if (!member) return 0;

    const tenant = await trx('tenants').where({ id: tenantId }).first('daily_leads_per_captador');
    const quota = Number(tenant?.daily_leads_per_captador ?? 0);
    if (quota <= 0) return 0;

    const [{ count }] = await trx('lead_assignments')
      .where({ tenant_id: tenantId, captador_id: captadorId })
      .where('assigned_for', TODAY)
      // Leads que o próprio captador cadastrou não gastam a cota da distribuição
      .where((q) => q.whereNull('assigned_by').orWhereNot('assigned_by', captadorId))
      .count('id as count');
    // Leads que o admin tirou dele hoje continuam contando na cota: tirar não abre vaga pra
    // a distribuição automática encher de novo (antes o captador recebia outros no lugar na hora)
    const [{ count: removedToday }] = await trx('lead_assignment_removals')
      .where({ tenant_id: tenantId, captador_id: captadorId })
      .whereRaw("(removed_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date")
      .count('id as count');
    const missing = quota - Number(count) - Number(removedToday);
    if (missing <= 0) return 0;

    const contactIds: string[] = await availableContactsBase(tenantId)
      .transacting(trx)
      // Lead que um admin tirou deste captador não volta pra ele sozinho
      .whereNotExists(
        trx('lead_assignment_removals as r')
          .whereRaw('r.contact_id = c.id')
          .andWhere({ 'r.tenant_id': tenantId, 'r.captador_id': captadorId }),
      )
      .orderBy('c.created_at', 'asc')
      .limit(missing)
      .pluck('c.id');
    if (contactIds.length === 0) return 0;

    const inserted = await trx('lead_assignments')
      .insert(contactIds.map((contactId) => ({ tenant_id: tenantId, contact_id: contactId, captador_id: captadorId })))
      .onConflict(['tenant_id', 'contact_id'])
      .ignore()
      .returning('id');
    return inserted.length;
  });

  if (assigned > 0) await notifyAssigned(tenantId, captadorId, assigned);
  return assigned;
}

export async function listAssignments(tenantId: string, query: AssignmentsQuery) {
  const { page, limit, offset } = getPaginationParams(query);

  const base = db('lead_assignments as a')
    .join('contacts as c', 'a.contact_id', 'c.id')
    .leftJoin('users as u', 'a.captador_id', 'u.id')
    .where('a.tenant_id', tenantId);

  if (query.captadorId) base.where('a.captador_id', query.captadorId);
  if (query.status) base.where('a.call_status', query.status);
  if (query.outcome === 'open') base.whereNull('a.outcome');
  else if (query.outcome) base.where('a.outcome', query.outcome);
  if (query.search) {
    const term = `%${query.search}%`;
    base.where((q) => q.whereILike('c.full_name', term).orWhereILike('c.company_name', term));
  }

  const [{ count }] = await base.clone().count('a.id as count');
  const rows = await base
    .clone()
    .select(
      'a.id', 'a.contact_id', 'a.captador_id', 'a.assigned_for', 'a.call_status', 'a.call_notes',
      'a.call_updated_at', 'a.outcome', 'a.closed_at', 'a.commission_paid_at', 'a.concluded_at', 'a.on_hold_at',
      'a.whatsapp_at', 'a.whatsapp_count', 'a.whatsapp_status',
      db.raw('a.deal_value::float8 as deal_value'),
      db.raw('a.commission_rate::float8 as commission_rate'),
      db.raw('a.commission_value::float8 as commission_value'),
      'c.full_name', 'c.phone', 'c.company_name', 'c.niche',
      db.raw('u.full_name as captador_name'),
    )
    // Reuniões marcadas e leads aguardando decisão no topo
    .orderByRaw("CASE WHEN a.outcome IS NULL AND a.call_status = 'meeting' THEN 0 WHEN a.outcome IS NULL THEN 1 ELSE 2 END")
    .orderBy('a.call_updated_at', 'desc', 'last')
    .orderBy('a.assigned_for', 'desc')
    .limit(limit)
    .offset(offset);

  return paginatedResponse(rows, Number(count), page, limit);
}

export async function closeAssignment(tenantId: string, adminId: string, id: string, input: CloseAssignmentInput) {
  const assignment = await db('lead_assignments').where({ id, tenant_id: tenantId }).first();
  if (!assignment) throw httpError('Assignment not found', 404);
  if (assignment.commission_paid_at) {
    throw httpError('Commission already paid — mark it as unpaid before changing the outcome', 409);
  }

  let updates: Record<string, unknown>;
  if (input.outcome === 'won') {
    const tenant = await db('tenants').where({ id: tenantId }).first('commission_rate');
    const rate = Number(tenant?.commission_rate ?? 8);
    updates = {
      outcome: 'won',
      deal_value: input.dealValue,
      commission_rate: rate,
      commission_value: Math.round(input.dealValue * rate) / 100,
      closed_at: new Date(),
      closed_by: adminId,
    };
  } else if (input.outcome === 'lost') {
    updates = {
      outcome: 'lost', deal_value: null, commission_rate: null, commission_value: null,
      closed_at: new Date(), closed_by: adminId,
    };
  } else {
    updates = {
      outcome: null, deal_value: null, commission_rate: null, commission_value: null,
      closed_at: null, closed_by: null,
    };
  }

  await db.transaction(async (trx) => {
    await trx('lead_assignments').where({ id, tenant_id: tenantId }).update({ ...updates, updated_at: new Date() });
    // Fechou: o lead vira cliente
    if (input.outcome === 'won') {
      await trx('contacts')
        .where({ id: assignment.contact_id, tenant_id: tenantId })
        .update({ type: 'client', updated_at: new Date() });
    }
  });

  if (input.outcome === 'won' && assignment.captador_id) {
    await createNotification({
      tenantId,
      userId: assignment.captador_id,
      type: 'leads.won',
      title: 'Um lead seu fechou negócio!',
      body: 'Sua comissão já aparece em Meus leads.',
    });
  }

  return { id, ...updates };
}

export async function setCommissionPaid(tenantId: string, id: string, paid: boolean) {
  const assignment = await db('lead_assignments').where({ id, tenant_id: tenantId }).first('outcome');
  if (!assignment) throw httpError('Assignment not found', 404);
  if (assignment.outcome !== 'won') throw httpError('Only won leads have a commission', 409);

  const commissionPaidAt = paid ? new Date() : null;
  await db('lead_assignments')
    .where({ id, tenant_id: tenantId })
    .update({ commission_paid_at: commissionPaidAt, updated_at: new Date() });
  return { id, commission_paid_at: commissionPaidAt };
}

/** Pagar todas as comissões em aberto de um captador de uma vez */
export async function payAllCommissions(tenantId: string, captadorId: string) {
  const updated = await db('lead_assignments')
    .where({ tenant_id: tenantId, captador_id: captadorId, outcome: 'won' })
    .whereNull('commission_paid_at')
    .update({ commission_paid_at: new Date(), updated_at: new Date() });
  return { paid: updated };
}

export async function unassign(tenantId: string, adminId: string, id: string) {
  const assignment = await db('lead_assignments').where({ id, tenant_id: tenantId }).first('outcome', 'contact_id', 'captador_id');
  if (!assignment) throw httpError('Assignment not found', 404);
  if (assignment.outcome) throw httpError('Closed leads cannot be unassigned', 409);
  await db.transaction(async (trx) => {
    await trx('lead_assignments').where({ id, tenant_id: tenantId }).delete();
    // Guarda a remoção: a distribuição automática não devolve este lead pro mesmo captador
    await trx('lead_assignment_removals')
      .insert({ tenant_id: tenantId, contact_id: assignment.contact_id, captador_id: assignment.captador_id, removed_by: adminId })
      .onConflict(['tenant_id', 'contact_id', 'captador_id'])
      .merge({ removed_by: adminId, removed_at: new Date() });
  });
}

/** Captador abriu o WhatsApp do lead (plano B depois da ligação): registra quando e quantas vezes */
export async function recordWhatsapp(tenantId: string, userId: string, id: string) {
  const updated = await db('lead_assignments')
    .where({ id, tenant_id: tenantId, captador_id: userId })
    .update({
      whatsapp_at: new Date(),
      whatsapp_count: db.raw('whatsapp_count + 1'),
      // Abriu a conversa = mensagem enviada, aguardando resposta (se ainda não tinha situação)
      whatsapp_status: db.raw("coalesce(whatsapp_status, 'waiting')"),
      updated_at: new Date(),
    });
  if (!updated) throw httpError('Lead not found', 404);
  return db('lead_assignments as a')
    .join('contacts as c', 'a.contact_id', 'c.id')
    .where({ 'a.id': id, 'a.tenant_id': tenantId })
    .select(MY_LEAD_COLUMNS)
    .first();
}

export async function getSettings(tenantId: string) {
  const row = await db('tenants')
    .where({ id: tenantId })
    .first(db.raw('commission_rate::float8 as commission_rate'), 'daily_leads_per_captador');
  return { commissionRate: row?.commission_rate ?? 8, leadsPerDay: row?.daily_leads_per_captador ?? 10 };
}

export async function updateSettings(tenantId: string, input: { commissionRate?: number; leadsPerDay?: number }) {
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.commissionRate !== undefined) updates.commission_rate = input.commissionRate;
  if (input.leadsPerDay !== undefined) updates.daily_leads_per_captador = input.leadsPerDay;
  await db('tenants').where({ id: tenantId }).update(updates);
  return getSettings(tenantId);
}

/**
 * Agenda dos admins pro captador marcar reunião sem conflito: só os horários ocupados (sem título,
 * sem descrição). Conta eventos do calendário com algum admin (criador ou participante) e as
 * reuniões já marcadas pela captação (1h cada).
 */
export async function getAdminBusy(tenantId: string, from: Date, to: Date) {
  const admins = await db('user_tenants as ut')
    .join('users as u', 'ut.user_id', 'u.id')
    .where({ 'ut.tenant_id': tenantId, 'ut.role': 'admin', 'ut.is_active': true })
    .select('u.id', 'u.full_name');
  const adminIds = admins.map((a) => a.id as string);
  const nameOf = (id: string) => (admins.find((a) => a.id === id)?.full_name as string | undefined)?.split(' ')[0];

  const events = adminIds.length
    ? await db('calendar_events as e')
        .where('e.tenant_id', tenantId)
        .where('e.start_at', '<', to)
        .where('e.end_at', '>', from)
        .where((w) =>
          w
            .whereIn('e.created_by', adminIds)
            .orWhereExists(
              db('calendar_event_attendees as a').whereRaw('a.event_id = e.id').whereIn('a.user_id', adminIds),
            ),
        )
        .select('e.id', 'e.start_at', 'e.end_at', 'e.created_by')
    : [];
  const attendees = events.length
    ? await db('calendar_event_attendees').whereIn('event_id', events.map((e) => e.id)).whereIn('user_id', adminIds).select('event_id', 'user_id')
    : [];

  const meetings = await db('lead_assignments')
    .where({ tenant_id: tenantId, call_status: 'meeting' })
    .whereNull('meeting_event_id')
    .whereNotNull('meeting_at')
    .where('meeting_at', '>=', new Date(from.getTime() - 3_600_000))
    .where('meeting_at', '<', to)
    .select('meeting_at', 'meeting_duration');

  return [
    ...events.map((e) => {
      const ids = new Set([...attendees.filter((a) => a.event_id === e.id).map((a) => a.user_id as string)]);
      if (adminIds.includes(e.created_by)) ids.add(e.created_by);
      return {
        start: e.start_at,
        end: e.end_at,
        kind: 'event' as const,
        admins: [...ids].map(nameOf).filter(Boolean),
      };
    }),
    ...meetings.map((m) => ({
      start: m.meeting_at,
      end: new Date(new Date(m.meeting_at).getTime() + (m.meeting_duration ?? 60) * 60_000),
      kind: 'lead_meeting' as const,
      admins: [] as string[],
    })),
  ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}
