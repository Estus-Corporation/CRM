import type { Knex } from 'knex';

/**
 * Convites para entrar num workspace. O admin convida por e-mail; a pessoa vê o convite na caixa
 * de entrada (e por e-mail, se o Resend estiver configurado) e aceita ou recusa. Chave pelo e-mail:
 * quem ainda não tem conta encontra o convite assim que se cadastrar.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('workspace_invites', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('email', 255).notNullable();
    t.string('role', 20).notNullable();
    t.uuid('invited_by').references('id').inTable('users').onDelete('SET NULL');
    // pending | accepted | declined | canceled
    t.string('status', 20).notNullable().defaultTo('pending');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('responded_at', { useTz: true });
  });
  // Um convite pendente por pessoa por workspace
  await knex.raw(
    "CREATE UNIQUE INDEX workspace_invites_pending_unique ON workspace_invites (tenant_id, lower(email)) WHERE status = 'pending'",
  );
  await knex.raw('CREATE INDEX workspace_invites_email_idx ON workspace_invites (lower(email), status)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('workspace_invites');
}
