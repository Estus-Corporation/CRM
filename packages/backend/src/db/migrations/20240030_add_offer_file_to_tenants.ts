import type { Knex } from 'knex';

/**
 * "Serviços e preços" passa a ser um arquivo (PDF ou DOCX) em vez de texto digitado.
 * Fica no banco como a foto dos contatos; o GET /tenant devolve só nome/tipo/tamanho.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tenants', (t) => {
    t.binary('offer_file_data').nullable();
    t.string('offer_file_mime', 120).nullable();
    t.string('offer_file_name', 255).nullable();
    t.integer('offer_file_size').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tenants', (t) => {
    t.dropColumn('offer_file_data');
    t.dropColumn('offer_file_mime');
    t.dropColumn('offer_file_name');
    t.dropColumn('offer_file_size');
  });
}
