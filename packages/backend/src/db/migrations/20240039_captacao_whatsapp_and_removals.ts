import type { Knex } from 'knex';

/**
 * Captação:
 * - WhatsApp (plano B quando o lead não atende): quando o captador abriu a conversa pela última vez,
 *   quantas vezes e a situação da mensagem (waiting/replied/no_reply) — os admins veem no acompanhamento.
 * - Remoções: lead que o admin tirou de um captador. A distribuição automática não devolve esse lead
 *   pro mesmo captador (antes ele voltava sozinho ao abrir "Meus leads").
 * (20240038 fica reservada pro M25.)
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('lead_assignments', (t) => {
    t.timestamp('whatsapp_at', { useTz: true });
    t.integer('whatsapp_count').notNullable().defaultTo(0);
    t.string('whatsapp_status', 20);
  });
  await knex.raw(
    "ALTER TABLE lead_assignments ADD CONSTRAINT lead_assignments_whatsapp_status_check CHECK (whatsapp_status IN ('waiting', 'replied', 'no_reply'))",
  );

  await knex.schema.createTable('lead_assignment_removals', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('contact_id').notNullable().references('id').inTable('contacts').onDelete('CASCADE');
    t.uuid('captador_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.uuid('removed_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('removed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['tenant_id', 'contact_id', 'captador_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('lead_assignment_removals');
  await knex.schema.alterTable('lead_assignments', (t) => {
    t.dropColumn('whatsapp_at');
    t.dropColumn('whatsapp_count');
    t.dropColumn('whatsapp_status');
  });
}
