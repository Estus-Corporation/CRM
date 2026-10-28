import type { Knex } from 'knex';

/**
 * Pedidos de leads executados pelo LeadHunter dentro do CRM (M25): o pedido guarda os campos do
 * formulário da campanha, a campanha que o atende e quem decidiu (executou ou recusou). O executor
 * externo (Radar Local) deixa de existir: `claimed` e a reserva (`claimed_at`/`claim_expires_at`)
 * não são mais usados, então qualquer pedido preso em claimed/running volta para a fila.
 * O CHECK de status não muda (`claimed` só deixa de ser gravado).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('lead_requests', (t) => {
    t.string('service', 20).notNullable().defaultTo('google');
    t.jsonb('keywords').notNullable().defaultTo('[]');
    t.jsonb('coordinates').notNullable().defaultTo('[]');
    t.boolean('enrich').notNullable().defaultTo(true);
    t.boolean('use_jev').notNullable().defaultTo(true);
    t.boolean('force_refresh').notNullable().defaultTo(false);
    // SET NULL: a campanha ou quem decidiu podem sumir e o histórico do pedido continua
    t.uuid('campaign_id').references('id').inTable('lh_campaigns').onDelete('SET NULL');
    t.uuid('decided_by').references('id').inTable('users').onDelete('SET NULL');
    t.index(['campaign_id']);
  });
  await knex('lead_requests')
    .whereIn('status', ['claimed', 'running'])
    .update({ status: 'queued', claimed_at: null, claim_expires_at: null });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('lead_requests', (t) => {
    t.dropColumn('decided_by');
    t.dropColumn('campaign_id');
    t.dropColumn('force_refresh');
    t.dropColumn('use_jev');
    t.dropColumn('enrich');
    t.dropColumn('coordinates');
    t.dropColumn('keywords');
    t.dropColumn('service');
  });
}
