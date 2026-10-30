import type { Knex } from 'knex';

/**
 * Situação da mensagem ganha "lost" (o captador marcou Perdeu pela mensagem; o lead fica concluído como perdido).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE lead_assignments DROP CONSTRAINT IF EXISTS lead_assignments_whatsapp_status_check');
  await knex.raw(
    "ALTER TABLE lead_assignments ADD CONSTRAINT lead_assignments_whatsapp_status_check CHECK (whatsapp_status IN ('waiting', 'replied', 'no_reply', 'no_whatsapp', 'lost'))",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("UPDATE lead_assignments SET whatsapp_status = 'no_reply' WHERE whatsapp_status = 'lost'");
  await knex.raw('ALTER TABLE lead_assignments DROP CONSTRAINT IF EXISTS lead_assignments_whatsapp_status_check');
  await knex.raw(
    "ALTER TABLE lead_assignments ADD CONSTRAINT lead_assignments_whatsapp_status_check CHECK (whatsapp_status IN ('waiting', 'replied', 'no_reply', 'no_whatsapp'))",
  );
}
