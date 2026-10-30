import type { Knex } from 'knex';

/**
 * Financeiro (M30): gastos recorrentes/avulsos, pagamentos por mês, impostos (% da receita) e sócios.
 * `finance_payments`: existir linha = a ocorrência daquele mês está paga (month sempre no dia 1).
 * `finance_taxes.kind` hoje só aceita 'percent_revenue' (ponto de extensão para outros tipos de imposto).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('finance_expenses', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('description', 160).notNullable();
    t.string('category', 60).notNullable().defaultTo('Outros');
    t.decimal('amount', 14, 2).notNullable();
    t.string('kind', 10).notNullable();
    // recorrente
    t.smallint('due_day');
    t.date('starts_on');
    t.date('ends_on');
    // avulso
    t.date('due_date');
    t.timestamps(true, true);

    t.index(['tenant_id', 'kind']);
  });
  await knex.raw('ALTER TABLE finance_expenses ADD CONSTRAINT finance_expenses_amount_nonneg CHECK (amount >= 0)');
  await knex.raw("ALTER TABLE finance_expenses ADD CONSTRAINT finance_expenses_kind_valid CHECK (kind IN ('recurring','one_off'))");
  await knex.raw(
    `ALTER TABLE finance_expenses ADD CONSTRAINT finance_expenses_kind_fields CHECK (
      (kind = 'recurring' AND due_day BETWEEN 1 AND 31 AND starts_on IS NOT NULL AND due_date IS NULL)
      OR (kind = 'one_off' AND due_date IS NOT NULL AND due_day IS NULL AND starts_on IS NULL AND ends_on IS NULL)
    )`,
  );

  await knex.schema.createTable('finance_payments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('expense_id').notNullable().references('id').inTable('finance_expenses').onDelete('CASCADE');
    t.date('month').notNullable();
    t.timestamp('paid_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamps(true, true);

    t.unique(['expense_id', 'month']);
    t.index(['tenant_id', 'month']);
  });

  await knex.schema.createTable('finance_taxes', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('name', 80).notNullable();
    t.decimal('rate', 5, 2).notNullable();
    t.string('kind', 30).notNullable().defaultTo('percent_revenue');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);

    t.index(['tenant_id']);
  });
  await knex.raw('ALTER TABLE finance_taxes ADD CONSTRAINT finance_taxes_rate_range CHECK (rate >= 0 AND rate <= 100)');
  await knex.raw("ALTER TABLE finance_taxes ADD CONSTRAINT finance_taxes_kind_valid CHECK (kind IN ('percent_revenue'))");

  await knex.schema.createTable('finance_partners', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('name', 120).notNullable();
    t.decimal('share_percent', 5, 2).notNullable();
    t.decimal('pro_labore', 14, 2).notNullable().defaultTo(0);
    t.timestamps(true, true);

    t.index(['tenant_id']);
  });
  await knex.raw('ALTER TABLE finance_partners ADD CONSTRAINT finance_partners_share_range CHECK (share_percent >= 0 AND share_percent <= 100)');
  await knex.raw('ALTER TABLE finance_partners ADD CONSTRAINT finance_partners_pro_labore_nonneg CHECK (pro_labore >= 0)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('finance_partners');
  await knex.schema.dropTableIfExists('finance_taxes');
  await knex.schema.dropTableIfExists('finance_payments');
  await knex.schema.dropTableIfExists('finance_expenses');
}
