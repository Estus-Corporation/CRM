import { db } from '../../db';
import { z } from 'zod';
import { getPaginationParams, paginatedResponse } from '../../shared/utils/paginate';
import { cancelInvite, createInvite, listTenantInvites } from '../invites/invites.service';

/**
 * Equipe de um workspace = vínculos (user_tenants). A conta da pessoa existe por conta própria:
 * aqui só se adiciona/remove/edita o vínculo dela com o workspace — nunca a conta.
 */

const roleEnum = z.enum(['admin', 'manager', 'seller', 'captador']);

export const updateUserSchema = z.object({
  role: roleEnum.optional(),
  isActive: z.boolean().optional(),
});

export const inviteUserSchema = z.object({
  email: z.string().trim().email(),
  role: roleEnum.default('seller'),
});

function httpError(message: string, status: number, code?: string) {
  return Object.assign(new Error(message), { status, code });
}

const MEMBER_COLUMNS = [
  'u.id', 'u.email', 'u.full_name', 'u.avatar_url', 'u.job_title', 'u.last_login_at',
  'ut.role', 'ut.is_active', 'ut.created_at',
];

/** Membros ativos do workspace (rota pública: só id, nome, e-mail e papel) */
export function listActiveMembers(tenantId: string): Promise<{ id: string; name: string; email: string; role: string }[]> {
  return db('user_tenants as ut')
    .join('users as u', 'ut.user_id', 'u.id')
    .where({ 'ut.tenant_id': tenantId, 'ut.is_active': true })
    .select('u.id', 'u.full_name as name', 'u.email', 'ut.role')
    .orderBy('u.full_name', 'asc');
}

export function findActiveMemberByEmail(tenantId: string, email: string): Promise<{ id: string } | undefined> {
  return db('user_tenants as ut')
    .join('users as u', 'ut.user_id', 'u.id')
    .where({ 'ut.tenant_id': tenantId, 'ut.is_active': true })
    .whereRaw('lower(u.email) = lower(?)', [email])
    .first('u.id');
}

export function findActiveMemberById(tenantId: string, userId: string): Promise<{ id: string } | undefined> {
  return db('user_tenants as ut')
    .join('users as u', 'ut.user_id', 'u.id')
    .where({ 'ut.tenant_id': tenantId, 'ut.user_id': userId, 'ut.is_active': true })
    .first('u.id');
}

export async function listUsers(tenantId: string, query: Record<string, unknown>) {
  const { page, limit, offset } = getPaginationParams(query);

  const base = db('user_tenants as ut').join('users as u', 'ut.user_id', 'u.id').where('ut.tenant_id', tenantId);
  const [{ count }] = await base.clone().count('ut.id as count');
  const users = await base.clone().select(MEMBER_COLUMNS).orderBy('ut.created_at', 'asc').limit(limit).offset(offset);

  return paginatedResponse(users, Number(count), page, limit);
}

/**
 * Convida alguém pro workspace pelo e-mail. Não cria o vínculo: a pessoa aceita ou recusa na caixa
 * de entrada (ver modules/invites). Quem ainda não tem conta vê o convite ao se cadastrar.
 */
export function inviteUser(tenantId: string, actorId: string, input: z.infer<typeof inviteUserSchema>) {
  return createInvite(tenantId, actorId, input);
}

export { listTenantInvites, cancelInvite };

async function assertNotLastAdmin(tenantId: string, userId: string) {
  const membership = await db('user_tenants').where({ tenant_id: tenantId, user_id: userId }).first();
  if (!membership) throw httpError('User not found', 404);
  if (membership.role !== 'admin' || !membership.is_active) return membership;
  const [{ count }] = await db('user_tenants')
    .where({ tenant_id: tenantId, role: 'admin', is_active: true })
    .count('id as count');
  if (Number(count) <= 1) throw httpError('Workspace needs at least one admin', 409, 'last_admin');
  return membership;
}

/** Tira a pessoa do workspace (a conta continua existindo, com os outros workspaces dela) */
export async function deleteUser(tenantId: string, userId: string) {
  await assertNotLastAdmin(tenantId, userId);

  await db.transaction(async (trx) => {
    // Leads ainda abertos do captador voltam pra fila; os fechados ficam no histórico
    await trx('lead_assignments').where({ tenant_id: tenantId, captador_id: userId }).whereNull('outcome').delete();
    // Sessões abertas neste workspace: a próxima renovação leva a pessoa pra outro workspace dela
    await trx('user_tenants').where({ tenant_id: tenantId, user_id: userId }).delete();
  });
  return { id: userId };
}

export async function updateUser(tenantId: string, userId: string, input: z.infer<typeof updateUserSchema>) {
  const membership = await db('user_tenants').where({ tenant_id: tenantId, user_id: userId }).first();
  if (!membership) throw httpError('User not found', 404);

  // Rebaixar ou desativar o último admin deixaria o workspace sem dono
  const losesAdmin = (input.role !== undefined && input.role !== 'admin') || input.isActive === false;
  if (losesAdmin) await assertNotLastAdmin(tenantId, userId);

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.role !== undefined) updates.role = input.role;
  if (input.isActive !== undefined) updates.is_active = input.isActive;
  await db('user_tenants').where({ id: membership.id }).update(updates);


  return db('user_tenants as ut')
    .join('users as u', 'ut.user_id', 'u.id')
    .where({ 'ut.id': membership.id })
    .select(MEMBER_COLUMNS)
    .first();
}
