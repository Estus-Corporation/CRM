import type { Knex } from 'knex';

/**
 * Pipeline do captador: ele envia o lead pela página do lead e o move entre as fases
 * (qualificando / tratando / reunião marcada). null = lead fora do pipeline.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('lead_assignments', (t) => {
    t.text('pipeline_stage').nullable();
    t.timestamp('pipeline_at', { useTz: true }).nullable();
  });
  await knex.raw(
    `ALTER TABLE lead_assignments ADD CONSTRAINT lead_assignments_pipeline_stage_check CHECK (pipeline_stage IS NULL OR pipeline_stage IN ('qualifying', 'treating', 'meeting'))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE lead_assignments DROP CONSTRAINT IF EXISTS lead_assignments_pipeline_stage_check');
  await knex.schema.alterTable('lead_assignments', (t) => {
    t.dropColumn('pipeline_at');
    t.dropColumn('pipeline_stage');
  });
}
