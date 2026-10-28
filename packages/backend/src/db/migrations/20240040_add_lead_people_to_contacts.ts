import type { Knex } from 'knex';

/**
 * Pessoas de contato conseguidas na ligação (ex.: o atendente passa o contato do dono):
 * `[{ name, title?, phone?, email? }]` guardadas na empresa (contato do tipo lead), visíveis pro
 * captador e pros admins.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('contacts', (t) => {
    t.jsonb('lead_people').notNullable().defaultTo('[]');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('contacts', (t) => {
    t.dropColumn('lead_people');
  });
}
