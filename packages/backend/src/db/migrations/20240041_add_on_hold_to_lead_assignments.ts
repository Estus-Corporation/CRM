import type { Knex } from 'knex';

/**
 * "Em aguardo": o captador está esperando o lead (retorno, resposta, decisão) — salva o que já tem
 * sem concluir. Concluir limpa a marca.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('lead_assignments', (t) => {
    t.timestamp('on_hold_at', { useTz: true }).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('lead_assignments', (t) => {
    t.dropColumn('on_hold_at');
  });
}
