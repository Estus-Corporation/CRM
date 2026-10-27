import { randomUUID } from 'crypto';
import { db } from '../../db';
import { getPaginationParams, paginatedResponse } from '../../shared/utils/paginate';
import type { CreateContactInput, UpdateContactInput, ListContactsQuery } from './contacts.schema';
import { fireWebhook } from '../integrations/integrations.service';
import { findActiveMemberById } from '../users/users.service';

export async function listContacts(tenantId: string, query: ListContactsQuery) {
  const { page, limit, offset } = getPaginationParams(query);

  let base = db('contacts as c')
    .leftJoin('users as u', 'c.owner_id', 'u.id')
    .where('c.tenant_id', tenantId)
    .select(
      'c.id',
      'c.type',
      'c.full_name',
      'c.email',
      'c.phone',
      'c.company_name',
      'c.job_title',
      'c.source',
      'c.niche',
      'c.tags',
      'c.owner_id',
      'c.created_at',
      'c.updated_at',
      db.raw("u.full_name as owner_name"),
      db.raw("(c.photo_data IS NOT NULL) as has_photo"),
    );

  if (query.type) base = base.where('c.type', query.type);
  if (query.owner) base = base.where('c.owner_id', query.owner);
  if (query.niche) base = base.where('c.niche', query.niche);
  if (query.search) {
    const term = `%${query.search}%`;
    base = base.where((q) =>
      q
        .whereILike('c.full_name', term)
        .orWhereILike('c.email', term)
        .orWhereILike('c.company_name', term),
    );
  }

  const countQuery = db('contacts').where('tenant_id', tenantId);
  if (query.type) countQuery.where('type', query.type);
  if (query.owner) countQuery.where('owner_id', query.owner);
  if (query.niche) countQuery.where('niche', query.niche);
  if (query.search) {
    const term = `%${query.search}%`;
    countQuery.where((q) =>
      q
        .whereILike('full_name', term)
        .orWhereILike('email', term)
        .orWhereILike('company_name', term),
    );
  }
  const [{ count }] = await countQuery.count('id as count');

  const contacts = await base.orderBy('c.created_at', 'desc').limit(limit).offset(offset);

  return paginatedResponse(contacts, Number(count), page, limit);
}

/** Nichos distintos já usados no workspace — alimenta o filtro e as sugestões do formulário */
export async function listNiches(tenantId: string): Promise<string[]> {
  const rows = await db('contacts')
    .where({ tenant_id: tenantId })
    .whereNotNull('niche')
    .distinct('niche')
    .orderBy('niche', 'asc');
  return rows.map((r: { niche: string }) => r.niche);
}

export async function getContact(tenantId: string, id: string) {
  const contact = await db('contacts as c')
    .leftJoin('users as u', 'c.owner_id', 'u.id')
    .where({ 'c.id': id, 'c.tenant_id': tenantId })
    .select(
      'c.id', 'c.tenant_id', 'c.type', 'c.full_name', 'c.email', 'c.phone',
      'c.company_name', 'c.job_title', 'c.source', 'c.niche', 'c.tags', 'c.owner_id',
      'c.custom_fields', 'c.created_at', 'c.updated_at',
      db.raw("u.full_name as owner_name"),
      db.raw("u.email as owner_email"),
      db.raw("(c.photo_data IS NOT NULL) as has_photo"),
    )
    .first();

  if (!contact) throw Object.assign(new Error('Contact not found'), { status: 404 });
  return contact;
}

const FREE_CONTACT_LIMIT = 300;

async function assertActiveOwner(tenantId: string, ownerId?: string | null) {
  if (!ownerId) return;
  if (!(await findActiveMemberById(tenantId, ownerId))) {
    throw Object.assign(new Error('Responsável não é membro ativo deste workspace'), {
      status: 422,
      code: 'invalid_owner',
    });
  }
}

export async function createContact(tenantId: string, input: CreateContactInput) {
  await assertActiveOwner(tenantId, input.ownerId);
  const tenant = await db('tenants').where({ id: tenantId }).first('plan');
  if (tenant?.plan === 'free') {
    const [{ count }] = await db('contacts').where({ tenant_id: tenantId }).count('id as count');
    if (Number(count) >= FREE_CONTACT_LIMIT) {
      throw Object.assign(
        new Error('Contact limit reached for free plan'),
        { status: 402, code: 'upgrade_required', requiredPlan: 'starter' },
      );
    }
  }

  const [contact] = await db('contacts')
    .insert({
      tenant_id: tenantId,
      type: input.type,
      full_name: input.fullName,
      email: input.email || null,
      phone: input.phone || null,
      company_name: input.companyName || null,
      job_title: input.jobTitle || null,
      source: input.source || null,
      niche: input.niche?.trim() || null,
      address: input.address?.trim() || null,
      maps_url: input.mapsUrl?.trim() || null,
      instagram: input.instagram?.trim() || null,
      website: input.website?.trim() || null,
      google_rating: input.googleRating ?? null,
      google_reviews: input.googleReviews ?? null,
      lead_context: input.leadContext?.trim() || null,
      tags: input.tags ? JSON.stringify(input.tags) : '{}',
      owner_id: input.ownerId || null,
      custom_fields: input.customFields ? JSON.stringify(input.customFields) : '{}',
    })
    .returning('*');

  fireWebhook(tenantId, 'contact.created', contact).catch(() => {});
  return contact;
}

export async function updateContact(
  tenantId: string,
  id: string,
  input: UpdateContactInput,
) {
  await assertActiveOwner(tenantId, input.ownerId);
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.type !== undefined) updates.type = input.type;
  if (input.fullName !== undefined) updates.full_name = input.fullName;
  if (input.email !== undefined) updates.email = input.email || null;
  if (input.phone !== undefined) updates.phone = input.phone || null;
  if (input.companyName !== undefined) updates.company_name = input.companyName || null;
  if (input.jobTitle !== undefined) updates.job_title = input.jobTitle || null;
  if (input.source !== undefined) updates.source = input.source || null;
  if (input.niche !== undefined) updates.niche = input.niche.trim() || null;
  if (input.address !== undefined) updates.address = input.address.trim() || null;
  if (input.mapsUrl !== undefined) updates.maps_url = input.mapsUrl.trim() || null;
  if (input.instagram !== undefined) updates.instagram = input.instagram.trim() || null;
  if (input.website !== undefined) updates.website = input.website.trim() || null;
  if (input.googleRating !== undefined) updates.google_rating = input.googleRating;
  if (input.googleReviews !== undefined) updates.google_reviews = input.googleReviews;
  if (input.leadContext !== undefined) updates.lead_context = input.leadContext.trim() || null;
  if (input.tags !== undefined) updates.tags = JSON.stringify(input.tags);
  if (input.ownerId !== undefined) updates.owner_id = input.ownerId || null;
  if (input.customFields !== undefined) updates.custom_fields = JSON.stringify(input.customFields);

  const [contact] = await db('contacts')
    .where({ id, tenant_id: tenantId })
    .update(updates)
    .returning('*');

  if (!contact) throw Object.assign(new Error('Contact not found'), { status: 404 });
  fireWebhook(tenantId, 'contact.updated', contact).catch(() => {});
  return contact;
}

export async function deleteContact(tenantId: string, id: string) {
  const deleted = await db('contacts').where({ id, tenant_id: tenantId }).delete();
  if (!deleted) throw Object.assign(new Error('Contact not found'), { status: 404 });
  fireWebhook(tenantId, 'contact.deleted', { id }).catch(() => {});
}

export async function importContactsCsv(
  tenantId: string,
  buffer: Buffer,
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const { parse } = await import('csv-parse/sync');

  const rows = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const fullName = row['Name'] || row['full_name'] || row['nome'];
    if (!fullName) { skipped++; continue; }

    const email = row['Email'] || row['email'] || null;
    if (email) {
      const existing = await db('contacts').where({ tenant_id: tenantId, email }).first();
      if (existing) { skipped++; continue; }
    }

    try {
      await db('contacts').insert({
        tenant_id: tenantId,
        full_name: fullName,
        email: email || null,
        phone: row['Phone'] || row['phone'] || row['telefone'] || null,
        company_name: row['Company'] || row['company_name'] || row['empresa'] || null,
        job_title: row['Job Title'] || row['job_title'] || row['cargo'] || null,
        type: (row['Type'] || row['type'] || 'lead') as 'lead' | 'contact' | 'client',
        source: row['Source'] || row['source'] || null,
        tags: '{}',
        custom_fields: '{}',
      });
      imported++;
    } catch {
      errors.push(`Linha ${i + 2}: erro ao importar "${fullName}"`);
    }
  }

  return { imported, skipped, errors };
}

export interface BulkContactInput {
  fullName: string;
  phone?: string;
  email?: string;
  company?: string;
  jobTitle?: string;
  niche?: string;
  source?: string;
  address?: string;
  mapsUrl?: string;
  instagram?: string;
  website?: string;
  googleRating?: number;
  googleReviews?: number;
  leadContext?: string;
  city?: string;
  leadScore?: number;
  externalId?: string;
}

export interface BulkItemResult {
  externalId: string | null;
  contactId: string | null;
  status: 'imported' | 'duplicate' | 'error';
  error?: string;
}

const onlyDigits = (s: string) => s.replace(/\D/g, '');

const ADDRESS_MAX = 500;

/** `contacts` não tem coluna de cidade: ela entra no fim do endereço, se ainda não estiver nele. */
function composeAddress(address?: string, city?: string): string | null {
  const addr = address?.trim() ?? '';
  const cityName = city?.trim() ?? '';
  if (!cityName) return addr.slice(0, ADDRESS_MAX) || null;
  if (!addr) return cityName.slice(0, ADDRESS_MAX);
  if (addr.toLowerCase().includes(cityName.toLowerCase())) return addr.slice(0, ADDRESS_MAX);
  return `${addr}, ${cityName}`.slice(0, ADDRESS_MAX);
}

/**
 * Importação em lote (agenda do celular, planilha de leads, LeadHunter). Pula duplicados por
 * external_id, e-mail ou telefone — contra o que já existe no workspace e dentro do próprio lote —
 * e grava num insert só. `options.source` sobrescreve o `source` dos itens; `options.ownerId`
 * vira o responsável. Devolve um resultado por item, na ordem de entrada.
 */
export async function importContactsBulk(
  tenantId: string,
  contacts: BulkContactInput[],
  options: { ownerId?: string | null; source?: string } = {},
): Promise<{ imported: number; skipped: number; errors: string[]; items: BulkItemResult[] }> {
  const tenant = await db('tenants').where({ id: tenantId }).first('plan');
  const errors: string[] = [];
  const items: BulkItemResult[] = [];
  let skipped = 0;

  const existing = await db('contacts')
    .where({ tenant_id: tenantId })
    .select('id', db.raw('lower(email) as email'), db.raw("regexp_replace(coalesce(phone, ''), '\\D', '', 'g') as phone"));
  // valor -> id do contato que já existia; null = veio de outro item do mesmo lote
  const emails = new Map<string, string | null>();
  // Telefones curtos demais (ramal, lixo) não servem pra identificar duplicado
  const phones = new Map<string, string | null>();
  for (const r of existing as { id: string; email: string | null; phone: string }[]) {
    if (r.email) emails.set(r.email, r.id);
    if (r.phone.length >= 8) phones.set(r.phone, r.id);
  }

  const itemSource = (item: BulkContactInput) => options.source?.trim() || item.source?.trim() || null;
  const externalKey = (source: string | null, externalId: string) => `${source ?? ''}\u0000${externalId}`;

  const externalIds = new Map<string, string | null>();
  const wantedIds = contacts.map((c) => c.externalId?.trim()).filter((id): id is string => !!id);
  if (wantedIds.length) {
    const query = db('contacts').where({ tenant_id: tenantId }).whereIn('external_id', wantedIds);
    if (options.source?.trim()) query.where({ source: options.source.trim() });
    const found = await query.select('id', 'source', 'external_id');
    for (const r of found as { id: string; source: string | null; external_id: string }[]) {
      externalIds.set(externalKey(r.source, r.external_id), r.id);
    }
  }

  let room = Infinity;
  if (tenant?.plan === 'free') {
    const [{ count }] = await db('contacts').where({ tenant_id: tenantId }).count('id as count');
    room = Math.max(0, FREE_CONTACT_LIMIT - Number(count));
  }

  const limitMessage = `Limite de ${FREE_CONTACT_LIMIT} contatos atingido no plano gratuito`;
  const rows: Record<string, unknown>[] = [];
  let limitHit = false;
  for (const item of contacts) {
    const externalId = item.externalId?.trim() || null;

    if (limitHit) {
      items.push({ externalId, contactId: null, status: 'error', error: limitMessage });
      continue;
    }

    const fullName = item.fullName?.trim();
    if (!fullName) {
      skipped++;
      items.push({ externalId, contactId: null, status: 'error', error: 'Nome da empresa vazio' });
      continue;
    }

    const source = itemSource(item);
    const email = item.email?.trim().toLowerCase() || null;
    const phoneDigits = item.phone ? onlyDigits(item.phone) : '';
    const hasPhone = phoneDigits.length >= 8;
    const extKey = externalId ? externalKey(source, externalId) : null;
    const isDuplicate =
      (extKey && externalIds.has(extKey)) || (email && emails.has(email)) || (hasPhone && phones.has(phoneDigits));
    if (isDuplicate) {
      skipped++;
      const contactId =
        (extKey && externalIds.get(extKey)) ||
        (email && emails.get(email)) ||
        (hasPhone && phones.get(phoneDigits)) ||
        null;
      items.push({ externalId, contactId, status: 'duplicate' });
      continue;
    }

    if (rows.length >= room) {
      limitHit = true;
      errors.push(limitMessage);
      items.push({ externalId, contactId: null, status: 'error', error: limitMessage });
      continue;
    }

    const id = randomUUID();
    if (extKey) externalIds.set(extKey, null);
    if (email) emails.set(email, null);
    if (hasPhone) phones.set(phoneDigits, null);
    rows.push({
      id,
      tenant_id: tenantId,
      owner_id: options.ownerId ?? null,
      full_name: fullName,
      phone: item.phone?.trim() || null,
      email,
      company_name: item.company?.trim() || null,
      job_title: item.jobTitle?.trim() || null,
      niche: item.niche?.trim() || null,
      source,
      address: composeAddress(item.address, item.city),
      maps_url: item.mapsUrl?.trim() || null,
      instagram: item.instagram?.trim() || null,
      website: item.website?.trim() || null,
      google_rating: item.googleRating ?? null,
      google_reviews: item.googleReviews ?? null,
      lead_context: item.leadContext?.trim() || null,
      lead_score: item.leadScore ?? null,
      external_id: externalId,
      type: 'lead',
      tags: '{}',
      custom_fields: '{}',
    });
    items.push({ externalId, contactId: id, status: 'imported' });
  }

  if (rows.length) await db('contacts').insert(rows);
  return { imported: rows.length, skipped, errors, items };
}

export async function uploadContactPhoto(
  tenantId: string,
  contactId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<void> {
  const contact = await db('contacts').where({ id: contactId, tenant_id: tenantId }).first('id');
  if (!contact) throw Object.assign(new Error('Contact not found'), { status: 404 });

  await db('contacts')
    .where({ id: contactId, tenant_id: tenantId })
    .update({ photo_data: buffer, photo_mime: mimeType, updated_at: new Date() });
}

export async function getContactPhoto(
  contactId: string,
): Promise<{ data: Buffer; mime: string } | null> {
  const row = await db('contacts').where({ id: contactId }).select('photo_data', 'photo_mime').first();
  if (!row || !row.photo_data) return null;
  return { data: row.photo_data, mime: row.photo_mime };
}

export async function deleteContactPhoto(tenantId: string, contactId: string): Promise<void> {
  const contact = await db('contacts').where({ id: contactId, tenant_id: tenantId }).first('id');
  if (!contact) throw Object.assign(new Error('Contact not found'), { status: 404 });

  await db('contacts')
    .where({ id: contactId, tenant_id: tenantId })
    .update({ photo_data: null, photo_mime: null, updated_at: new Date() });
}

export async function exportContactsCsv(tenantId: string): Promise<string> {
  const contacts = await db('contacts')
    .where({ tenant_id: tenantId })
    .select('full_name', 'email', 'phone', 'company_name', 'job_title', 'type', 'source', 'created_at')
    .orderBy('created_at', 'desc');

  const { stringify } = await import('csv-stringify/sync');
  return stringify(contacts, {
    header: true,
    columns: [
      { key: 'full_name', header: 'Name' },
      { key: 'email', header: 'Email' },
      { key: 'phone', header: 'Phone' },
      { key: 'company_name', header: 'Company' },
      { key: 'job_title', header: 'Job Title' },
      { key: 'type', header: 'Type' },
      { key: 'source', header: 'Source' },
      { key: 'created_at', header: 'Created At' },
    ],
  });
}
