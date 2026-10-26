import { db } from '../../db';
import { generateSlug, issueSession, resolveWorkspace } from './auth.service';

export async function handleGoogleUser(profile: {
  id: string;
  emails?: Array<{ value: string }>;
  displayName: string;
}) {
  const email = profile.emails?.[0]?.value;
  if (!email) throw new Error('No email from Google profile');

  // Conta existente (mesmo e-mail, sem diferenciar maiúsculas): entra no último workspace dela
  const existingUser = await db('users').whereRaw('lower(email) = lower(?)', [email]).first();

  if (existingUser) {
    await db('users').where({ id: existingUser.id }).update({ last_login_at: new Date() });
    const { tenantId, role } = await resolveWorkspace(existingUser);
    return { ...(await issueSession(existingUser, tenantId, role)), isNew: false };
  }

  // Conta nova: cria a conta e o workspace próprio (como no cadastro por e-mail)
  const workspaceName = profile.displayName || email.split('@')[0];
  const { tenant, user } = await db.transaction(async (trx) => {
    const [tenant] = await trx('tenants').insert({ name: workspaceName, slug: generateSlug(workspaceName) }).returning('*');
    const [user] = await trx('users')
      .insert({
        tenant_id: tenant.id,
        email,
        password_hash: null,
        full_name: profile.displayName || email,
        role: 'admin',
      })
      .returning('*');
    await trx('user_tenants').insert({ user_id: user.id, tenant_id: tenant.id, role: 'admin' });
    return { tenant, user };
  });

  return { ...(await issueSession(user, tenant.id, 'admin')), isNew: true };
}
