import type { Knex } from 'knex';

/**
 * Contatos e redes da empresa (WhatsApp, Instagram, site, endereço): viram atalhos de um clique
 * na página "Sobre a empresa", no mesmo padrão dos atalhos do card de lead.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tenants', (t) => {
    t.string('phone', 40);
    t.string('instagram', 255);
    t.string('website', 255);
    t.string('address', 500);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tenants', (t) => {
    t.dropColumn('phone');
    t.dropColumn('instagram');
    t.dropColumn('website');
    t.dropColumn('address');
  });
}
