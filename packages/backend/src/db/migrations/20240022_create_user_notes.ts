import type { Knex } from 'knex';

/** Bloco de notas pessoal: um por usuário em cada workspace (painel "Notas" do app) */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_notes', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('content').notNullable().defaultTo('');
    t.timestamps(true, true);

    t.unique(['tenant_id', 'user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_notes');
}
