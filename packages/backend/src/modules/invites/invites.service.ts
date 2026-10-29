import { db } from '../../db';
import { env } from '../../config/env';
import { createNotification } from '../notifications/notifications.service';
import { publishToTenantManagers, publishToUser } from '../realtime/hub';

/**
 * Convites para entrar num workspace (workspace_invites). O admin convida pelo e-mail; a pessoa
 * aceita ou recusa na caixa de entrada. Só ao aceitar o vínculo (user_tenants) é criado.
 */

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  manager: 'Gerente',
  seller: 'Vendedor',
  captador: 'Captador',
};

function httpError(message: string, status: number, code?: string) {
  return Object.assign(new Error(message), { status, code });
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** E-mail do convite (só com Resend configurado; falha no envio não impede o convite) */
async function sendInviteEmail(email: string, workspaceName: string, actorName: string, role: string, hasAccount: boolean) {
  if (!env.RESEND_API_KEY) return;
  const ws = escapeHtml(workspaceName);
  const actor = escapeHtml(actorName);
  const link = `${env.FRONTEND_URL}/${hasAccount ? 'login' : 'register'}`;
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(env.RESEND_API_KEY);
    await resend.emails.send({
      from: env.EMAIL_FROM,
      to: email,
      subject: `${actorName} convidou você para ${workspaceName} no TitanFlow`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#ffffff">
          <div style="margin-bottom:24px">
            <span style="font-size:20px;font-weight:700;color:#0c0f15">Titan<span style="color:#72d296">Flow</span></span>
          </div>
          <h2 style="color:#111827;font-size:22px;margin:0 0 12px">Você recebeu um convite</h2>
          <p style="color:#374151;margin:0 0 20px">
            <strong>${actor}</strong> quer que você participe de <strong>${ws}</strong> como <strong>${ROLE_LABEL[role] ?? role}</strong>.
          </p>
          <p style="color:#374151;margin:0 0 24px">
            ${hasAccount ? 'Entre no TitanFlow e abra a caixa de entrada para aceitar ou recusar.' : 'Crie sua conta com este e-mail e o convite aparece na sua caixa de entrada para aceitar ou recusar.'}
          </p>
          <a href="${link}" style="display:inline-block;background:#72d296;color:#0c0f15;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px">
            ${hasAccount ? 'Ver convite' : 'Criar conta'}
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:28px;border-top:1px solid #f3f4f6;padding-top:20px">
            Se não esperava esse convite, é só ignorar este e-mail.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[invite email]', err);
  }
}

export async function createInvite(tenantId: string, actorId: string, input: { email: string; role: string }) {
  const email = input.email.trim().toLowerCase();
  const user = await db('users').whereRaw('lower(email) = ?', [email]).andWhere({ is_active: true }).first();

  if (user) {
    const membership = await db('user_tenants').where({ user_id: user.id, tenant_id: tenantId, is_active: true }).first();
    if (membership) throw httpError('Already a member of this workspace', 409, 'already_member');
  }

  // Já havia convite pendente: atualiza o papel e reenvia
  const pending = await db('workspace_invites').where({ tenant_id: tenantId, status: 'pending' }).whereRaw('lower(email) = ?', [email]).first();
  const [invite] = pending
    ? await db('workspace_invites')
        .where({ id: pending.id })
        .update({ role: input.role, invited_by: actorId, created_at: new Date() })
        .returning('*')
    : await db('workspace_invites').insert({ tenant_id: tenantId, email, role: input.role, invited_by: actorId }).returning('*');

  const [tenant, actor] = await Promise.all([
    db('tenants').where({ id: tenantId }).first('name'),
    db('users').where({ id: actorId }).first('full_name'),
  ]);
  void sendInviteEmail(email, tenant?.name ?? 'um workspace', actor?.full_name ?? 'Um admin', input.role, !!user);
  // Quem já está conectado vê o convite na hora; os outros admins veem o pendente na equipe
  publishToUser(user?.id, 'invites');
  void publishToTenantManagers(tenantId, 'team');

  return { ...invite, has_account: !!user, full_name: user?.full_name ?? null, avatar_url: user?.avatar_url ?? null };
}

/** Convites pendentes do workspace (pra equipe ver quem ainda não respondeu) */
export function listTenantInvites(tenantId: string) {
  return db('workspace_invites as i')
    .leftJoin('users as u', function () {
      this.on(db.raw('lower(u.email) = lower(i.email)'));
    })
    .where({ 'i.tenant_id': tenantId, 'i.status': 'pending' })
    .orderBy('i.created_at', 'desc')
    .select('i.id', 'i.email', 'i.role', 'i.created_at', 'u.full_name', 'u.avatar_url');
}

export async function cancelInvite(tenantId: string, inviteId: string) {
  const [canceled] = await db('workspace_invites')
    .where({ id: inviteId, tenant_id: tenantId, status: 'pending' })
    .update({ status: 'canceled', responded_at: new Date() })
    .returning('email');
  if (!canceled) throw httpError('Invite not found', 404);
  const invitee = await db('users').whereRaw('lower(email) = lower(?)', [canceled.email]).first('id');
  publishToUser(invitee?.id, 'invites');
  void publishToTenantManagers(tenantId, 'team');
}

async function userEmail(userId: string) {
  const user = await db('users').where({ id: userId }).first('email', 'full_name');
  if (!user) throw httpError('User not found', 404);
  return user as { email: string; full_name: string };
}

/** Convites pendentes para a pessoa logada (vale em qualquer workspace em que ela esteja) */
export async function listMyInvites(userId: string) {
  const { email } = await userEmail(userId);
  return db('workspace_invites as i')
    .join('tenants as t', 'i.tenant_id', 't.id')
    .leftJoin('users as a', 'i.invited_by', 'a.id')
    .where('i.status', 'pending')
    .whereRaw('lower(i.email) = lower(?)', [email])
    .orderBy('i.created_at', 'desc')
    .select(
      'i.id',
      'i.role',
      'i.created_at',
      't.id as tenant_id',
      't.name as tenant_name',
      't.logo_url as tenant_logo_url',
      'a.full_name as invited_by_name',
    );
}

async function pendingInviteFor(userId: string, inviteId: string) {
  const { email, full_name } = await userEmail(userId);
  const invite = await db('workspace_invites')
    .where({ id: inviteId, status: 'pending' })
    .whereRaw('lower(email) = lower(?)', [email])
    .first();
  if (!invite) throw httpError('Invite not found', 404, 'invite_not_found');
  return { invite, fullName: full_name };
}

export async function acceptInvite(userId: string, inviteId: string) {
  const { invite, fullName } = await pendingInviteFor(userId, inviteId);

  await db.transaction(async (trx) => {
    const existing = await trx('user_tenants').where({ user_id: userId, tenant_id: invite.tenant_id }).first();
    if (existing) {
      await trx('user_tenants').where({ id: existing.id }).update({ role: invite.role, is_active: true, updated_at: new Date() });
    } else {
      await trx('user_tenants').insert({ user_id: userId, tenant_id: invite.tenant_id, role: invite.role });
    }
    await trx('workspace_invites').where({ id: invite.id }).update({ status: 'accepted', responded_at: new Date() });
  });

  if (invite.invited_by) {
    await createNotification({
      tenantId: invite.tenant_id,
      userId: invite.invited_by,
      type: 'workspace.invite_accepted',
      title: `${fullName} aceitou o convite`,
      body: `Agora faz parte da equipe como ${ROLE_LABEL[invite.role] ?? invite.role}.`,
      resourceType: 'user',
      resourceId: userId,
    }).catch(() => {});
  }

  // Outras abas da pessoa atualizam workspaces/convites; a equipe vê o novo membro
  publishToUser(userId, 'invites');
  publishToUser(userId, 'workspaces');
  void publishToTenantManagers(invite.tenant_id, 'team');

  const tenant = await db('tenants').where({ id: invite.tenant_id }).first('id', 'name');
  return { tenantId: tenant.id as string, tenantName: tenant.name as string, role: invite.role as string };
}

export async function declineInvite(userId: string, inviteId: string) {
  const { invite, fullName } = await pendingInviteFor(userId, inviteId);
  await db('workspace_invites').where({ id: invite.id }).update({ status: 'declined', responded_at: new Date() });
  publishToUser(userId, 'invites');
  void publishToTenantManagers(invite.tenant_id, 'team');
  if (invite.invited_by) {
    await createNotification({
      tenantId: invite.tenant_id,
      userId: invite.invited_by,
      type: 'workspace.invite_declined',
      title: `${fullName} recusou o convite`,
      resourceType: 'user',
      resourceId: userId,
    }).catch(() => {});
  }
}
