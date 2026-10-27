import type { Knex } from 'knex';

/**
 * Detalhes da reunião marcada pelo captador (vão para o evento do calendário): duração, quais admins
 * participam e convidados do lado do cliente (nome e cargo).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('lead_assignments', (t) => {
    t.integer('meeting_duration');
    t.jsonb('meeting_attendee_ids').notNullable().defaultTo('[]');
    t.jsonb('meeting_guests').notNullable().defaultTo('[]');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('lead_assignments', (t) => {
    t.dropColumn('meeting_duration');
    t.dropColumn('meeting_attendee_ids');
    t.dropColumn('meeting_guests');
  });
}
