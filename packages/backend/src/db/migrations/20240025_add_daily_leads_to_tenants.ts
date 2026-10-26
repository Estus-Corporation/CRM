import type { Knex } from 'knex';

/**
 * Distribuição automática: cada captador ativo recebe até N leads novos por dia (0 = desligada).
 * Configurado na engrenagem da Captação, junto com a comissão.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tenants', (t) => {
    t.integer('daily_leads_per_captador').notNullable().defaultTo(10);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tenants', (t) => {
    t.dropColumn('daily_leads_per_captador');
  });
}
