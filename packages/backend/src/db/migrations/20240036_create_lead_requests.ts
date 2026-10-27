import type { Knex } from 'knex';

/**
 * Pedidos de leads: o usuário pede "N empresas de <nicho> em <cidade>", o Radar Local (chave de API)
 * pega o pedido da fila, roda a busca e entrega os leads. `claim_expires_at` é a reserva do Radar
 * (vencida, o pedido volta para a fila). `contacts.lead_request_id` liga cada lead novo ao pedido.
 * As cotas ficam no workspace: máximo de empresas por pedido e pedidos por usuário por dia (0 = desativado).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('lead_requests', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    // SET NULL: quem pediu pode sair do sistema e o histórico continua
    t.uuid('requested_by').references('id').inTable('users').onDelete('SET NULL');
    t.string('niche', 100).notNullable();
    t.string('city', 100).notNullable();
    t.integer('quantity').notNullable();
    t.text('notes');
    t.string('status', 20).notNullable().defaultTo('queued');
    t.text('message');
    t.integer('delivered_count').notNullable().defaultTo(0);
    t.timestamp('claimed_at', { useTz: true });
    t.timestamp('claim_expires_at', { useTz: true });
    t.timestamp('finished_at', { useTz: true });
    t.timestamps(true, true);

    t.index(['tenant_id', 'status', 'created_at']);
    t.index(['tenant_id', 'requested_by', 'created_at']);
  });
  await knex.raw('ALTER TABLE lead_requests ADD CONSTRAINT lead_requests_quantity_range CHECK (quantity BETWEEN 1 AND 50)');
  await knex.raw(
    "ALTER TABLE lead_requests ADD CONSTRAINT lead_requests_status_valid CHECK (status IN ('queued','claimed','running','done','partial','failed','cancelled'))",
  );

  await knex.schema.alterTable('contacts', (t) => {
    t.uuid('lead_request_id').references('id').inTable('lead_requests').onDelete('SET NULL');
    t.index(['lead_request_id']);
  });

  await knex.schema.alterTable('tenants', (t) => {
    t.integer('lead_request_max_quantity').notNullable().defaultTo(20);
    t.integer('lead_request_daily_per_user').notNullable().defaultTo(3);
  });
  await knex.raw('ALTER TABLE tenants ADD CONSTRAINT tenants_lead_request_max_quantity_range CHECK (lead_request_max_quantity BETWEEN 1 AND 50)');
  await knex.raw('ALTER TABLE tenants ADD CONSTRAINT tenants_lead_request_daily_per_user_range CHECK (lead_request_daily_per_user BETWEEN 0 AND 50)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('contacts', (t) => {
    t.dropColumn('lead_request_id');
  });
  await knex.schema.dropTableIfExists('lead_requests');
  await knex.schema.alterTable('tenants', (t) => {
    t.dropColumn('lead_request_max_quantity');
    t.dropColumn('lead_request_daily_per_user');
  });
}
