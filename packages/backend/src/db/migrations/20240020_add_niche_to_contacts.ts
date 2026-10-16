import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('contacts', (t) => {
    t.string('niche', 100).nullable();
    t.index(['tenant_id', 'niche']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('contacts', (t) => {
    t.dropIndex(['tenant_id', 'niche']);
    t.dropColumn('niche');
  });
}
