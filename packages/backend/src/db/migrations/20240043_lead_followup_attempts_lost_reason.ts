import type { Knex } from 'knex';

/**
 * Captação mais completa:
 * - `next_contact_at`: quando o captador combinou de voltar a falar com o lead (lembrete avisado uma vez,
 *   marcado em `next_contact_notified_at`);
 * - `lost_reason`: por que o lead foi perdido (junto do `lead_result = 'lost'`);
 * - `lead_contact_attempts`: histórico de cada tentativa (ligação ou WhatsApp) com o resultado.
 * O resultado "número errado" (`call_status = 'wrong_number'`) não precisa de coluna: `call_status` não tem CHECK.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('lead_assignments', (t) => {
    t.timestamp('next_contact_at', { useTz: true }).nullable();
    t.timestamp('next_contact_notified_at', { useTz: true }).nullable();
    t.string('lost_reason', 30).nullable();
  });
  await knex.raw(
    "ALTER TABLE lead_assignments ADD CONSTRAINT lead_assignments_lost_reason_check CHECK (lost_reason IN ('no_interest', 'has_supplier', 'price', 'wrong_number', 'closed_business', 'other'))",
  );
  await knex.raw('CREATE INDEX lead_assignments_next_contact_idx ON lead_assignments (tenant_id, captador_id, next_contact_at) WHERE next_contact_at IS NOT NULL');

  await knex.schema.createTable('lead_contact_attempts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('assignment_id').notNullable().references('id').inTable('lead_assignments').onDelete('CASCADE');
    t.uuid('captador_id').references('id').inTable('users').onDelete('SET NULL');
    t.string('channel', 10).notNullable(); // call | whatsapp
    t.string('result', 20).notNullable(); // call_status (no_answer, answered, wrong_number, meeting) ou whatsapp_status
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['tenant_id', 'assignment_id', 'created_at']);
  });
  await knex.raw("ALTER TABLE lead_contact_attempts ADD CONSTRAINT lead_contact_attempts_channel_check CHECK (channel IN ('call', 'whatsapp'))");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('lead_contact_attempts');
  await knex.raw('DROP INDEX IF EXISTS lead_assignments_next_contact_idx');
  await knex.raw('ALTER TABLE lead_assignments DROP CONSTRAINT IF EXISTS lead_assignments_lost_reason_check');
  await knex.schema.alterTable('lead_assignments', (t) => {
    t.dropColumn('next_contact_at');
    t.dropColumn('next_contact_notified_at');
    t.dropColumn('lost_reason');
  });
}
