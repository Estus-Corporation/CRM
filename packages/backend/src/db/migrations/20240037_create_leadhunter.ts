import type { Knex } from 'knex';

/**
 * LeadHunter dentro do CRM: a flag por workspace (`tenants.leadhunter_enabled`, ligada só por SQL)
 * e as tabelas `lh_*` portadas do Radar Local (campanhas, empresas encontradas, observações,
 * chamadas de API, cache de buscas e cobertura). Tudo é por workspace (`tenant_id`).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tenants', (t) => {
    t.boolean('leadhunter_enabled').notNullable().defaultTo(false);
  });

  await knex.schema.createTable('lh_campaigns', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.jsonb('config').notNullable();
    t.string('state', 20).notNullable();
    t.text('message').notNullable().defaultTo('');
    t.integer('progress').notNullable().defaultTo(0);
    t.boolean('cancel_requested').notNullable().defaultTo(false);
    t.jsonb('warnings').notNullable().defaultTo('[]');
    // SET NULL: quem criou pode sair do sistema e a campanha continua
    t.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);

    t.index(['tenant_id', 'created_at']);
    t.index(['tenant_id', 'state']);
  });
  await knex.raw(
    "ALTER TABLE lh_campaigns ADD CONSTRAINT lh_campaigns_state_valid CHECK (state IN ('importing','queued','running','completed','partial','failed','cancelled','interrupted'))",
  );

  await knex.schema.createTable('lh_companies', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('identity', 32).notNullable();
    t.string('source', 10).notNullable();
    t.jsonb('data').notNullable();
    t.string('stage', 20).notNullable().defaultTo('new');
    t.text('notes').notNullable().defaultTo('');
    // Resultado do envio ao CRM: { contactId, status, sentAt, ownerId, error? }
    t.jsonb('crm');
    t.timestamps(true, true);

    t.unique(['tenant_id', 'identity']);
  });
  await knex.raw("ALTER TABLE lh_companies ADD CONSTRAINT lh_companies_source_valid CHECK (source IN ('demo','live','import'))");
  await knex.raw(
    "ALTER TABLE lh_companies ADD CONSTRAINT lh_companies_stage_valid CHECK (stage IN ('new','reviewing','contacted','interested','discarded','do_not_contact'))",
  );

  await knex.schema.createTable('lh_campaign_companies', (t) => {
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('campaign_id').notNullable().references('id').inTable('lh_campaigns').onDelete('CASCADE');
    t.uuid('company_id').notNullable().references('id').inTable('lh_companies').onDelete('CASCADE');
    t.jsonb('analysis').notNullable().defaultTo('{}');
    t.specificType('position', 'serial');

    t.primary(['campaign_id', 'company_id']);
    t.index(['tenant_id', 'campaign_id']);
    t.index(['tenant_id', 'company_id']);
  });

  await knex.schema.createTable('lh_observations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('campaign_id').notNullable().references('id').inTable('lh_campaigns').onDelete('CASCADE');
    t.uuid('company_id').notNullable().references('id').inTable('lh_companies').onDelete('CASCADE');
    t.text('query').notNullable();
    t.text('location').notNullable();
    t.integer('rank');
    t.integer('depth');
    t.timestamp('observed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.text('source_url');

    t.unique(['campaign_id', 'company_id', 'query', 'location']);
    t.index(['tenant_id', 'company_id']);
    t.index(['tenant_id', 'campaign_id']);
  });

  await knex.schema.createTable('lh_api_calls', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('campaign_id').references('id').inTable('lh_campaigns').onDelete('SET NULL');
    t.string('provider', 20).notNullable();
    t.string('operation', 20).notNullable();
    t.string('state', 10).notNullable().defaultTo('pending');
    t.decimal('cost', 12, 6);
    t.integer('tokens');
    t.text('model');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index(['tenant_id', 'campaign_id']);
    // O limite diário de chamadas é global (todos os workspaces): por isso um índice só em created_at
    t.index(['created_at']);
  });
  await knex.raw("ALTER TABLE lh_api_calls ADD CONSTRAINT lh_api_calls_state_valid CHECK (state IN ('pending','success','error','unknown'))");

  await knex.schema.createTable('lh_searches', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('provider', 20).notNullable();
    t.string('operation', 20).notNullable();
    t.string('cache_key', 32).notNullable();
    t.text('keyword').notNullable();
    t.text('location').notNullable();
    t.integer('depth').notNullable();
    t.uuid('campaign_id').references('id').inTable('lh_campaigns').onDelete('SET NULL');
    t.timestamp('executed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.integer('result_count').notNullable().defaultTo(0);
    t.decimal('cost', 12, 6);
    t.jsonb('results').notNullable().defaultTo('[]');
    t.integer('reuse_count').notNullable().defaultTo(0);
    t.timestamp('last_reused_at', { useTz: true });

    t.index(['tenant_id', 'cache_key', 'executed_at']);
  });

  await knex.schema.createTable('lh_search_coverage', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.uuid('campaign_id').notNullable().references('id').inTable('lh_campaigns').onDelete('CASCADE');
    t.text('query').notNullable();
    t.text('location').notNullable();
    t.integer('depth').notNullable();
    t.timestamp('observed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.unique(['campaign_id', 'query', 'location']);
    t.index(['tenant_id', 'campaign_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('lh_search_coverage');
  await knex.schema.dropTableIfExists('lh_searches');
  await knex.schema.dropTableIfExists('lh_api_calls');
  await knex.schema.dropTableIfExists('lh_observations');
  await knex.schema.dropTableIfExists('lh_campaign_companies');
  await knex.schema.dropTableIfExists('lh_companies');
  await knex.schema.dropTableIfExists('lh_campaigns');
  await knex.schema.alterTable('tenants', (t) => {
    t.dropColumn('leadhunter_enabled');
  });
}
