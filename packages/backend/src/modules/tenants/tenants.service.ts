import { db } from '../../db';
import { z } from 'zod';

// Campos longos com limite generoso: é texto corrido pra equipe ler (preços, scripts, objeções)
const longText = z.string().max(20000);

// Logo: data URL de imagem (o frontend reduz pra 256px; ~400 KB é folga de sobra)
const logoSchema = z
  .string()
  .max(400_000)
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Logo inválido')
  .nullable();

// Quem é quem no workspace (fundador, cofundador, captadores…)
export const keyPeopleSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1).max(120),
      title: z.string().trim().min(1).max(60),
      email: z.string().trim().email().max(255).optional().or(z.literal('')),
    }),
  )
  .max(50);

export const updateTenantSchema = z.object({
  name: z.string().trim().min(2).max(255).optional(),
  email: z.string().trim().email().max(255).nullable().optional().or(z.literal('')),
  keyPeople: keyPeopleSchema.optional(),
  serviceType: z.string().trim().max(120).nullable().optional(),
  about: longText.nullable().optional(),
  offer: longText.nullable().optional(),
  pitch: longText.nullable().optional(),
  logo: logoSchema.optional(),
});

// Toda a equipe lê o workspace (inclusive captador) — nada de dados de cobrança aqui
const PUBLIC_COLUMNS = [
  'id', 'name', 'slug', 'plan', 'max_users', 'created_at',
  'service_type', 'about', 'offer', 'pitch', 'logo_url', 'email', 'key_people',
];

/** Membros ativos do workspace (foto, papel, desde quando) — o mais antigo primeiro */
function listMembers(tenantId: string) {
  return db('user_tenants as ut')
    .join('users as u', 'ut.user_id', 'u.id')
    .where({ 'ut.tenant_id': tenantId, 'ut.is_active': true })
    .orderBy('ut.created_at', 'asc')
    .select('u.id', 'u.full_name', 'u.email', 'u.avatar_url', 'ut.role', db.raw('ut.created_at as joined_at'));
}

export async function getTenant(tenantId: string) {
  const [tenant, members] = await Promise.all([
    db('tenants').where({ id: tenantId }).first(PUBLIC_COLUMNS),
    listMembers(tenantId),
  ]);
  if (!tenant) throw Object.assign(new Error('Tenant not found'), { status: 404 });
  // Sem e-mail da empresa cadastrado: usa o do dono (admin mais antigo) até alguém preencher
  const owner = members.find((m: { role: string }) => m.role === 'admin');
  return { ...tenant, email: tenant.email ?? owner?.email ?? null, members };
}

export async function updateTenant(tenantId: string, input: z.infer<typeof updateTenantSchema>) {
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.serviceType !== undefined) updates.service_type = input.serviceType || null;
  if (input.about !== undefined) updates.about = input.about?.trim() || null;
  if (input.offer !== undefined) updates.offer = input.offer?.trim() || null;
  if (input.pitch !== undefined) updates.pitch = input.pitch?.trim() || null;
  if (input.logo !== undefined) updates.logo_url = input.logo;
  if (input.email !== undefined) updates.email = input.email || null;
  if (input.keyPeople !== undefined) updates.key_people = JSON.stringify(input.keyPeople);

  await db('tenants').where({ id: tenantId }).update(updates);
  return getTenant(tenantId);
}
