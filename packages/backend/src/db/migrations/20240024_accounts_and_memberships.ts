import type { Knex } from 'knex';

/**
 * Conta independente de workspace: a pessoa tem a própria conta e participa de vários workspaces
 * (user_tenants). users.tenant_id passa a ser só "o último workspace usado".
 */
export async function up(knex: Knex): Promise<void> {
  // Ativo/inativo é por workspace: desativar alguém num workspace não bloqueia a conta toda
  await knex.schema.alterTable('user_tenants', (t) => {
    t.boolean('is_active').notNullable().defaultTo(true);
  });
  await knex.raw(`
    UPDATE user_tenants ut SET is_active = u.is_active
    FROM users u WHERE u.id = ut.user_id AND u.tenant_id = ut.tenant_id
  `);

  // A sessão renovada volta pro mesmo workspace (antes voltava sempre pro de origem)
  await knex.schema.alterTable('refresh_tokens', (t) => {
    t.uuid('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
  });

  // Perfil pessoal (Minha conta). avatar_url vira text: guarda data URL da foto recortada
  await knex.schema.alterTable('users', (t) => {
    t.text('avatar_url').alter();
    t.string('job_title', 120);
    t.string('phone', 30);
    t.text('bio');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('bio');
    t.dropColumn('phone');
    t.dropColumn('job_title');
  });
  await knex.raw('UPDATE users SET avatar_url = NULL WHERE length(avatar_url) > 500');
  await knex.schema.alterTable('users', (t) => {
    t.string('avatar_url', 500).alter();
  });
  await knex.schema.alterTable('refresh_tokens', (t) => {
    t.dropColumn('tenant_id');
  });
  await knex.schema.alterTable('user_tenants', (t) => {
    t.dropColumn('is_active');
  });
}
