import type { Knex } from 'knex';

/**
 * Convidados de fora do espaço (do lado do cliente) num evento: só nome e cargo, sem conta.
 * Os participantes da equipe continuam em calendar_event_attendees.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('calendar_events', (t) => {
    t.jsonb('external_attendees').notNullable().defaultTo('[]');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('calendar_events', (t) => {
    t.dropColumn('external_attendees');
  });
}
