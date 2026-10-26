import type { Knex } from 'knex';

/**
 * Dados que vêm do LeadHunter / planilhas de prospecção (endereço, página do Google, Instagram,
 * site, avaliações) e o "concluir lead" do captador.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('contacts', (t) => {
    t.text('address');
    t.text('maps_url');
    t.string('instagram', 255);
    // null = sem site (informação de venda: "esse lead não tem site")
    t.string('website', 500);
    t.decimal('google_rating', 2, 1);
    t.integer('google_reviews');
  });

  // Captador clicou em "Concluir": o resultado está registrado; "Editar" reabre (volta a null)
  await knex.schema.alterTable('lead_assignments', (t) => {
    t.timestamp('concluded_at', { useTz: true });
  });
  // Leads que já tinham resultado contam como concluídos
  await knex.raw(`UPDATE lead_assignments SET concluded_at = call_updated_at WHERE call_status <> 'pending'`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('lead_assignments', (t) => {
    t.dropColumn('concluded_at');
  });
  await knex.schema.alterTable('contacts', (t) => {
    t.dropColumn('address');
    t.dropColumn('maps_url');
    t.dropColumn('instagram');
    t.dropColumn('website');
    t.dropColumn('google_rating');
    t.dropColumn('google_reviews');
  });
}
