import type { Knex } from 'knex';

/**
 * Captação de leads: o admin distribui contatos para captadores, que ligam e registram o resultado.
 * O admin fecha (ganho/perdido) e, se ganho, a comissão do captador é calculada sobre o valor fechado.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tenants', (t) => {
    t.decimal('commission_rate', 5, 2).notNullable().defaultTo(8);
  });

  await knex.schema.createTable('lead_assignments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('contact_id').notNullable().references('id').inTable('contacts').onDelete('CASCADE');
    // SET NULL: excluir o captador não apaga o histórico de fechamentos/comissões
    t.uuid('captador_id').references('id').inTable('users').onDelete('SET NULL');
    t.uuid('assigned_by').references('id').inTable('users').onDelete('SET NULL');
    // Dia da distribuição no fuso do Brasil (o servidor roda em UTC)
    t.date('assigned_for').notNullable().defaultTo(knex.raw("(now() AT TIME ZONE 'America/Sao_Paulo')::date"));

    // Resultado da ligação, registrado pelo captador:
    // pending (a ligar) | no_answer (não atendeu) | callback (em aguardo) | meeting (reunião marcada) | lost (perdido)
    t.string('call_status', 20).notNullable().defaultTo('pending');
    t.text('call_notes');
    t.timestamp('call_updated_at', { useTz: true });

    // Fechamento, registrado pelo admin: null (em aberto) | won | lost
    t.string('outcome', 10);
    t.decimal('deal_value', 14, 2);
    t.decimal('commission_rate', 5, 2);
    t.decimal('commission_value', 14, 2);
    t.timestamp('closed_at', { useTz: true });
    t.uuid('closed_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('commission_paid_at', { useTz: true });

    t.timestamps(true, true);

    // Um lead fica com um captador por vez
    t.unique(['tenant_id', 'contact_id']);
    t.index(['tenant_id', 'captador_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('lead_assignments');
  await knex.schema.alterTable('tenants', (t) => {
    t.dropColumn('commission_rate');
  });
}
