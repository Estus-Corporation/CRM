import type { Knex } from 'knex';

/**
 * Reunião marcada pelo captador vira um evento no calendário (com os admins como participantes):
 * aparece na agenda de quem vai à reunião. Guardamos o evento pra atualizar/remover junto com o lead.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('lead_assignments', (t) => {
    t.uuid('meeting_event_id').references('id').inTable('calendar_events').onDelete('SET NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('lead_assignments', (t) => {
    t.dropColumn('meeting_event_id');
  });
}
