import { db } from '../../db';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { getPaginationParams, paginatedResponse } from '../../shared/utils/paginate';
import { env } from '../../config/env';

export const updateUserSchema = z.object({
  role: z.enum(['admin', 'manager', 'seller']).optional(),
  fullName: z.string().min(2).max(255).optional(),
  isActive: z.boolean().optional(),
});

export const inviteUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(255),
  role: z.enum(['admin', 'manager', 'seller']).default('seller'),
});

export async function listUsers(tenantId: string, query: Record<string, unknown>) {
  const { page, limit, offset } = getPaginationParams(query);

  const base = db('users').where({ tenant_id: tenantId });
  const [{ count }] = await base.clone().count('id as count');
  const users = await base
    .clone()
    .select('id', 'email', 'full_name', 'role', 'is_active', 'last_login_at', 'created_at')
    .orderBy('created_at', 'asc')
    .limit(limit)
    .offset(offset);

  return paginatedResponse(users, Number(count), page, limit);
}

export async function inviteUser(tenantId: string, input: z.infer<typeof inviteUserSchema>) {
  const existing = await db('users').where({ tenant_id: tenantId, email: input.email }).first();
  if (existing) throw Object.assign(new Error('User with this email already exists'), { status: 409 });

  const tempPassword = Math.random().toString(36).slice(-12);
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const [user] = await db('users')
    .insert({
      tenant_id: tenantId,
      email: input.email,
      full_name: input.fullName,
      role: input.role,
      password_hash: passwordHash,
      must_change_password: true,
    })
    .returning(['id', 'email', 'full_name', 'role', 'created_at']);

  await db('user_tenants')
    .insert({ user_id: user.id, tenant_id: tenantId, role: input.role })
    .onConflict(['user_id', 'tenant_id'])
    .ignore();

  if (env.RESEND_API_KEY) {
    const tenant = await db('tenants').where({ id: tenantId }).select('name').first();
    const workspaceName = tenant?.name ?? 'TitanFlow';

    const { Resend } = await import('resend');
    const resend = new Resend(env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: input.email,
      subject: `Você foi convidado para ${workspaceName} no TitanFlow`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#ffffff">
          <div style="margin-bottom:24px">
            <span style="font-size:20px;font-weight:700;color:#0c0f15">Titan<span style="color:#72d296">Flow</span></span>
          </div>
          <h2 style="color:#111827;font-size:22px;margin:0 0 8px">Você foi convidado!</h2>
          <p style="color:#374151;margin:0 0 16px">Olá, <strong>${input.fullName}</strong>!</p>
          <p style="color:#374151;margin:0 0 20px"><strong>${workspaceName}</strong> convidou você para acessar o TitanFlow. Use as credenciais abaixo para entrar:</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:0 0 24px">
            <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em">E-mail</p>
            <p style="margin:0 0 16px;font-weight:600;color:#111827;font-size:15px">${input.email}</p>
            <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em">Senha temporária</p>
            <p style="margin:0;font-weight:700;color:#111827;font-size:18px;letter-spacing:3px">${tempPassword}</p>
          </div>
          <a href="${env.FRONTEND_URL}/login" style="display:inline-block;background:#72d296;color:#0c0f15;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px">
            Acessar o TitanFlow
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:28px;border-top:1px solid #f3f4f6;padding-top:20px">
            Por segurança, troque sua senha no primeiro acesso. Se não esperava esse convite, ignore este e-mail.
          </p>
        </div>
      `,
    });
    console.log('[Resend]', JSON.stringify(result));
  }

  return { ...user, tempPassword: env.RESEND_API_KEY ? undefined : tempPassword };
}

export async function resendInvite(tenantId: string, userId: string) {
  const user = await db('users').where({ id: userId, tenant_id: tenantId }).first();
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const tempPassword = Math.random().toString(36).slice(-12);
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  await db('users').where({ id: userId, tenant_id: tenantId }).update({
    password_hash: passwordHash,
    must_change_password: true,
    updated_at: new Date(),
  });

  if (env.RESEND_API_KEY) {
    const tenant = await db('tenants').where({ id: tenantId }).select('name').first();
    const workspaceName = tenant?.name ?? 'TitanFlow';

    const { Resend } = await import('resend');
    const resend = new Resend(env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: user.email,
      subject: `Seu acesso ao ${workspaceName} no TitanFlow`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#ffffff">
          <div style="margin-bottom:24px">
            <span style="font-size:20px;font-weight:700;color:#0c0f15">Titan<span style="color:#72d296">Flow</span></span>
          </div>
          <h2 style="color:#111827;font-size:22px;margin:0 0 8px">Novo acesso gerado</h2>
          <p style="color:#374151;margin:0 0 16px">Olá, <strong>${user.full_name}</strong>!</p>
          <p style="color:#374151;margin:0 0 20px">Um novo convite foi enviado para sua conta em <strong>${workspaceName}</strong>. Use as credenciais abaixo para entrar:</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:0 0 24px">
            <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em">E-mail</p>
            <p style="margin:0 0 16px;font-weight:600;color:#111827;font-size:15px">${user.email}</p>
            <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em">Nova senha temporária</p>
            <p style="margin:0;font-weight:700;color:#111827;font-size:18px;letter-spacing:3px">${tempPassword}</p>
          </div>
          <a href="${env.FRONTEND_URL}/login" style="display:inline-block;background:#72d296;color:#0c0f15;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px">
            Acessar o TitanFlow
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:28px;border-top:1px solid #f3f4f6;padding-top:20px">
            Por segurança, troque sua senha no primeiro acesso. Se não esperava esse convite, ignore este e-mail.
          </p>
        </div>
      `,
    });
    console.log('[Resend resend-invite]', JSON.stringify(result));
  }

  return { id: userId, tempPassword: env.RESEND_API_KEY ? undefined : tempPassword };
}

export async function deleteUser(tenantId: string, userId: string) {
  const user = await db('users').where({ id: userId, tenant_id: tenantId }).first();
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  await db('users').where({ id: userId, tenant_id: tenantId }).delete();
  return { id: userId };
}

export async function updateUser(
  tenantId: string,
  userId: string,
  input: z.infer<typeof updateUserSchema>,
) {
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.role !== undefined) updates.role = input.role;
  if (input.fullName !== undefined) updates.full_name = input.fullName;
  if (input.isActive !== undefined) updates.is_active = input.isActive;

  const [user] = await db('users')
    .where({ id: userId, tenant_id: tenantId })
    .update(updates)
    .returning(['id', 'email', 'full_name', 'role', 'is_active', 'updated_at']);

  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user;
}
