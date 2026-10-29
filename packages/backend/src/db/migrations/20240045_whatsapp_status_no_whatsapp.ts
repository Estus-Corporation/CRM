import type { Knex } from 'knex';

/**
 * Situação da mensagem ganha "no_whatsapp" (o número não tem WhatsApp). "no_reply" passa a ser "sem resposta"
 * (o captador desistiu de esperar), sem mudar o valor gravado.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE lead_assignments DROP CONSTRAINT IF EXISTS lead_assignments_whatsapp_status_check');
  await knex.raw(
    "ALTER TABLE lead_assignments ADD CONSTRAINT lead_assignments_whatsapp_status_check CHECK (whatsapp_status IN ('waiting', 'replied', 'no_reply', 'no_whatsapp'))",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("UPDATE lead_assignments SET whatsapp_status = 'no_reply' WHERE whatsapp_status = 'no_whatsapp'");
  await knex.raw('ALTER TABLE lead_assignments DROP CONSTRAINT IF EXISTS lead_assignments_whatsapp_status_check');
  await knex.raw(
    "ALTER TABLE lead_assignments ADD CONSTRAINT lead_assignments_whatsapp_status_check CHECK (whatsapp_status IN ('waiting', 'replied', 'no_reply'))",
  );
}
