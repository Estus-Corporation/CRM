import type { Knex } from 'knex';

/** Presença: última requisição autenticada do usuário (online = visto nos últimos 2 minutos) */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.timestamp('last_seen_at', { useTz: true }).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('last_seen_at');
  });
}
