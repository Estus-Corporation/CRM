import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import crypto from 'crypto';
import { db } from '../../db';
import { env } from '../../config/env';
import type { RegisterInput, LoginInput, UpdateMeInput } from './auth.schema';

const accessSecret = new TextEncoder().encode(env.JWT_SECRET);

/**
 * Modelo de contas: a pessoa tem UMA conta (users) e participa de vários workspaces (user_tenants,
 * com papel e ativo/inativo por workspace). users.tenant_id é só o último workspace usado — o login
 * entra nele. O papel do token sempre vem do user_tenants do workspace do token.
 */

/** E-mail já usado por alguma conta (comparação sem diferenciar maiúsculas) */
export async function emailInUse(email: string) {
  const row = await db('users').whereRaw('lower(email) = lower(?)', [email]).first('id');
  return !!row;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function signAccessToken(userId: string, tenantId: string, role: string, email: string) {
  return new SignJWT({ tenantId, role, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(accessSecret);
}

/** Refresh token guarda o workspace: renovar a sessão mantém a pessoa onde ela está */
async function signRefreshToken(userId: string, tenantId: string) {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db('refresh_tokens').insert({
    user_id: userId,
    tenant_id: tenantId,
    token_hash: hashToken(rawToken),
    expires_at: expiresAt,
  });

  return rawToken;
}

export function generateSlug(name: string) {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'workspace';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

/** Cria um workspace com a pessoa como admin e passa a usá-lo como o atual */
export async function createWorkspace(userId: string, name: string, slug = generateSlug(name)) {
  return db.transaction(async (trx) => {
    // Quem cria o workspace já entra como fundador em "Quem faz parte"
    const creator = await trx('users').where({ id: userId }).first('full_name', 'email');
    const keyPeople = creator ? [{ name: creator.full_name, title: 'Fundador', email: creator.email }] : [];
    const [tenant] = await trx('tenants')
      .insert({ name: name.trim(), slug, key_people: JSON.stringify(keyPeople) })
      .returning('*');
    await trx('user_tenants').insert({ user_id: userId, tenant_id: tenant.id, role: 'admin' });
    await trx('users').where({ id: userId }).update({ tenant_id: tenant.id, updated_at: new Date() });
    return tenant;
  });
}

async function activeMembership(userId: string, tenantId: string) {
  return db('user_tenants').where({ user_id: userId, tenant_id: tenantId, is_active: true }).first();
}

/**
 * Em qual workspace a pessoa entra: o último usado, se ela ainda participa; senão o primeiro
 * em que participa; se não participa de nenhum (foi removida de todos), ganha um workspace próprio.
 */
export async function resolveWorkspace(user: { id: string; tenant_id: string; full_name: string }) {
  const last = await activeMembership(user.id, user.tenant_id);
  if (last) return { tenantId: user.tenant_id, role: last.role as string };

  const any = await db('user_tenants')
    .where({ user_id: user.id, is_active: true })
    .orderBy('created_at', 'asc')
    .first();
  if (any) {
    await db('users').where({ id: user.id }).update({ tenant_id: any.tenant_id });
    return { tenantId: any.tenant_id as string, role: any.role as string };
  }

  const tenant = await createWorkspace(user.id, `Workspace de ${user.full_name.split(' ')[0]}`);
  return { tenantId: tenant.id as string, role: 'admin' };
}

/** Tokens + usuário com tenant_id/role do workspace da sessão (o frontend usa esses dois) */
export async function issueSession(user: Record<string, any>, tenantId: string, role: string) {
  const accessToken = await signAccessToken(user.id, tenantId, role, user.email);
  const refreshToken = await signRefreshToken(user.id, tenantId);
  return { accessToken, refreshToken, user: { ...sanitizeUser(user), tenant_id: tenantId, role } };
}

export async function register(input: RegisterInput) {
  // Nem todo mundo tem empresa: o espaço nasce com o nome da pessoa e pode ser renomeado depois
  const workspaceName = input.workspaceName || `Espaço de ${input.fullName.trim().split(/\s+/)[0]}`;
  let slug = input.slug ?? generateSlug(workspaceName);
  if (await db('tenants').where({ slug }).first()) slug = generateSlug(workspaceName);

  // Uma conta por e-mail — o login acha a conta só pelo e-mail
  if (await emailInUse(input.email)) {
    throw Object.assign(new Error('Email already registered'), { status: 409, code: 'email_in_use' });
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const { tenant, user } = await db.transaction(async (trx) => {
    const [tenant] = await trx('tenants').insert({ name: workspaceName, slug }).returning('*');
    const [user] = await trx('users')
      .insert({
        tenant_id: tenant.id,
        email: input.email,
        password_hash: passwordHash,
        full_name: input.fullName,
        role: 'admin',
      })
      .returning('*');
    await trx('user_tenants').insert({ user_id: user.id, tenant_id: tenant.id, role: 'admin' });
    return { tenant, user };
  });

  return { ...(await issueSession(user, tenant.id, 'admin')), tenant };
}

export async function login(input: LoginInput) {
  // Pode haver mais de uma linha com o mesmo e-mail (dados antigos, de antes do e-mail ser único):
  // entra na que tiver a senha certa. Conta só-Google (sem senha) nunca casa.
  const candidates = await db('users')
    .whereRaw('lower(email) = lower(?)', [input.email])
    .andWhere({ is_active: true })
    .whereNotNull('password_hash')
    .orderBy('created_at', 'asc');

  let user: Record<string, any> | undefined;
  for (const candidate of candidates) {
    if (await bcrypt.compare(input.password, candidate.password_hash)) {
      user = candidate;
      break;
    }
  }
  if (!user) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  await db('users').where({ id: user.id }).update({ last_login_at: new Date() });
  const { tenantId, role } = await resolveWorkspace(user as { id: string; tenant_id: string; full_name: string });
  return issueSession(user, tenantId, role);
}

export async function refresh(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const stored = await db('refresh_tokens')
    .where({ token_hash: tokenHash })
    .andWhere('expires_at', '>', new Date())
    .first();

  if (!stored) throw Object.assign(new Error('Invalid or expired refresh token'), { status: 401 });

  await db('refresh_tokens').where({ id: stored.id }).delete();

  const user = await db('users').where({ id: stored.user_id, is_active: true }).first();
  if (!user) throw Object.assign(new Error('User not found'), { status: 401 });

  // Mantém o workspace da sessão; se a pessoa saiu dele (ou foi removida), cai no padrão
  const membership = stored.tenant_id ? await activeMembership(user.id, stored.tenant_id) : null;
  const { tenantId, role } = membership
    ? { tenantId: stored.tenant_id as string, role: membership.role as string }
    : await resolveWorkspace(user);

  const session = await issueSession(user, tenantId, role);
  return { accessToken: session.accessToken, refreshToken: session.refreshToken, tenantId, role };
}

export async function logout(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  await db('refresh_tokens').where({ token_hash: tokenHash }).delete();
}

export async function getMe(userId: string, tenantId: string, role: string) {
  const user = await db('users').where({ id: userId }).first();
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return { ...sanitizeUser(user), tenant_id: tenantId, role };
}

export async function updateMe(userId: string, tenantId: string, role: string, input: UpdateMeInput) {
  const current = await db('users').where({ id: userId }).first();
  if (!current) throw Object.assign(new Error('User not found'), { status: 404 });

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.fullName !== undefined) updates.full_name = input.fullName;
  if (input.jobTitle !== undefined) updates.job_title = input.jobTitle?.trim() || null;
  if (input.phone !== undefined) updates.phone = input.phone?.trim() || null;
  if (input.bio !== undefined) updates.bio = input.bio?.trim() || null;
  if (input.avatar !== undefined) updates.avatar_url = input.avatar;

  if (input.password) {
    // Troca voluntária pede a senha atual; a obrigatória (primeiro acesso) e conta só-Google não
    if (!current.must_change_password && current.password_hash) {
      const ok = input.currentPassword && (await bcrypt.compare(input.currentPassword, current.password_hash));
      if (!ok) throw Object.assign(new Error('Current password is incorrect'), { status: 400, code: 'wrong_password' });
    }
    updates.password_hash = await bcrypt.hash(input.password, 12);
    updates.must_change_password = false;
  }

  const [user] = await db('users').where({ id: userId }).update(updates).returning('*');
  return { ...sanitizeUser(user), tenant_id: tenantId, role };
}

export async function listWorkspaces(userId: string) {
  return db('user_tenants as ut')
    .join('tenants as t', 'ut.tenant_id', 't.id')
    .where({ 'ut.user_id': userId, 'ut.is_active': true })
    .orderBy('t.name', 'asc')
    .select('t.id', 't.name', 't.slug', 't.plan', 't.logo_url', 'ut.role');
}

export async function switchWorkspace(userId: string, tenantId: string) {
  const membership = await activeMembership(userId, tenantId);
  if (!membership) throw Object.assign(new Error('No access to this workspace'), { status: 403 });

  const user = await db('users').where({ id: userId, is_active: true }).first();
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  // Lembra o último workspace: o próximo login entra nele
  await db('users').where({ id: userId }).update({ tenant_id: tenantId });

  const session = await issueSession(user, tenantId, membership.role);
  const tenant = await db('tenants').where({ id: tenantId }).first('name');
  return { ...session, tenantId, tenantName: tenant.name, role: membership.role };
}

/** "Criar novo workspace" no seletor: a pessoa vira admin dele e já entra nele */
export async function createOwnWorkspace(
  userId: string,
  name: string,
  extra: { email?: string; keyPeople?: { name: string; title: string; email?: string }[] } = {},
) {
  const user = await db('users').where({ id: userId, is_active: true }).first();
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  const tenant = await createWorkspace(userId, name);
  if (extra.email || extra.keyPeople?.length) {
    await db('tenants')
      .where({ id: tenant.id })
      .update({
        email: extra.email || null,
        ...(extra.keyPeople?.length ? { key_people: JSON.stringify(extra.keyPeople) } : {}),
      });
  }
  const session = await issueSession({ ...user, tenant_id: tenant.id }, tenant.id, 'admin');
  return { ...session, tenantId: tenant.id, tenantName: tenant.name, role: 'admin' };
}

/** Sair de um workspace (não apaga a conta). O último admin não pode sair — passaria a não ter dono. */
export async function leaveWorkspace(userId: string, tenantId: string) {
  const membership = await activeMembership(userId, tenantId);
  if (!membership) throw Object.assign(new Error('Not a member'), { status: 404 });

  if (membership.role === 'admin') {
    const [{ count }] = await db('user_tenants')
      .where({ tenant_id: tenantId, role: 'admin', is_active: true })
      .count('id as count');
    if (Number(count) <= 1) {
      throw Object.assign(new Error('Last admin cannot leave'), { status: 409, code: 'last_admin' });
    }
  }

  await db.transaction(async (trx) => {
    // Leads ainda abertos do captador voltam pra fila; fechados ficam no histórico
    await trx('lead_assignments').where({ tenant_id: tenantId, captador_id: userId }).whereNull('outcome').delete();
    await trx('user_tenants').where({ user_id: userId, tenant_id: tenantId }).delete();
  });
}

function sanitizeUser(user: Record<string, unknown>) {
  const { password_hash, ...safe } = user;
  void password_hash;
  return safe;
}
