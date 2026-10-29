import type { Knex } from 'knex';

/**
 * Situação informada pelo captador ao salvar o lead: ganhou ou perdeu (em aguardo = `on_hold_at`).
 * O fechamento oficial (valor e comissão) continua sendo do admin em `outcome`.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('lead_assignments', (t) => {
    t.string('lead_result', 10).nullable();
  });
  await knex.raw(
    "ALTER TABLE lead_assignments ADD CONSTRAINT lead_assignments_lead_result_check CHECK (lead_result IN ('won', 'lost'))",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE lead_assignments DROP CONSTRAINT IF EXISTS lead_assignments_lead_result_check');
  await knex.schema.alterTable('lead_assignments', (t) => {
    t.dropColumn('lead_result');
  });
}
