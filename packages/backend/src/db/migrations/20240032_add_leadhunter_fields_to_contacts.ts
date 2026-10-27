import type { Knex } from 'knex';

/**
 * Campos para receber leads do Radar Local (LeadHunter): `lead_score` guarda a nota 0-100 do lead
 * (restrição no banco, não só no app) e `external_id` o id do lead no sistema de origem. O índice
 * único parcial em (tenant_id, source, external_id) impede importar o mesmo lead duas vezes; contatos
 * sem external_id (todos os atuais) ficam fora do índice.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('contacts', (t) => {
    t.integer('lead_score');
    t.text('external_id');
  });
  await knex.raw('ALTER TABLE contacts ADD CONSTRAINT contacts_lead_score_range CHECK (lead_score BETWEEN 0 AND 100)');
  await knex.raw(
    'CREATE UNIQUE INDEX contacts_source_external_id_unique ON contacts (tenant_id, source, external_id) WHERE external_id IS NOT NULL',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS contacts_source_external_id_unique');
  await knex.schema.alterTable('contacts', (t) => {
    t.dropColumn('lead_score');
    t.dropColumn('external_id');
  });
}
