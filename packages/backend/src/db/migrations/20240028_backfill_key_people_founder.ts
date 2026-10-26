import type { Knex } from 'knex';

/** Workspaces criados antes de "Quem faz parte": o admin mais antigo entra como fundador */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    UPDATE tenants t
    SET key_people = jsonb_build_array(jsonb_build_object('name', u.full_name, 'title', 'Fundador', 'email', u.email))
    FROM (
      SELECT DISTINCT ON (ut.tenant_id) ut.tenant_id, ut.user_id
      FROM user_tenants ut
      WHERE ut.role = 'admin'
      ORDER BY ut.tenant_id, ut.created_at ASC
    ) first_admin
    JOIN users u ON u.id = first_admin.user_id
    WHERE t.id = first_admin.tenant_id AND t.key_people = '[]'::jsonb
  `);
}

export async function down(): Promise<void> {
  // Dados preenchidos — nada a desfazer
}
