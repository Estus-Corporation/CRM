import type { Knex } from 'knex';

/**
 * Reunião marcada com dia/hora/formato, contexto do lead para o captador,
 * e-mail da empresa e quem é quem no workspace (fundador, cofundador, captadores…).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('lead_assignments', (t) => {
    t.timestamp('meeting_at', { useTz: true });
    // 'online' | 'presencial'
    t.string('meeting_mode', 20);
    // Link da chamada (online) ou endereço (presencial)
    t.string('meeting_location', 500);
  });

  await knex.schema.alterTable('contacts', (t) => {
    // Contexto sobre a empresa do lead, escrito por quem cadastrou/importou
    t.text('lead_context');
  });

  await knex.schema.alterTable('tenants', (t) => {
    t.string('email', 255);
    // [{ name, title }] — ex.: { name: 'Ana', title: 'Fundadora' }
    t.jsonb('key_people').notNullable().defaultTo('[]');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tenants', (t) => {
    t.dropColumn('email');
    t.dropColumn('key_people');
  });
  await knex.schema.alterTable('contacts', (t) => {
    t.dropColumn('lead_context');
  });
  await knex.schema.alterTable('lead_assignments', (t) => {
    t.dropColumn('meeting_at');
    t.dropColumn('meeting_mode');
    t.dropColumn('meeting_location');
  });
}
