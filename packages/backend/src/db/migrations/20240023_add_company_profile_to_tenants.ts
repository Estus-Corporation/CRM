import type { Knex } from 'knex';

/**
 * Perfil da empresa (preenchido ao criar o workspace): o que a empresa faz, preços e como abordar
 * o cliente. A equipe — principalmente os captadores — lê isso na página "Sobre a empresa".
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tenants', (t) => {
    t.string('service_type', 120);
    t.text('about');
    t.text('offer');
    t.text('pitch');
    // Data URL de uma imagem pequena (o frontend reduz pra 256px antes de enviar)
    t.text('logo_url');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tenants', (t) => {
    t.dropColumn('service_type');
    t.dropColumn('about');
    t.dropColumn('offer');
    t.dropColumn('pitch');
    t.dropColumn('logo_url');
  });
}
