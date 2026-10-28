import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { db } from '../db';

/** Os testes de integração só rodam com um banco descartável em TEST_DATABASE_URL */
export const hasTestDb = !!process.env.TEST_DATABASE_URL;

type Role = 'admin' | 'manager' | 'seller' | 'captador';

/** Última trava: confere o banco realmente conectado (e não só a URL) antes de escrever nele */
async function assertTestDatabase(who: string): Promise<void> {
  const { rows } = await db.raw('select current_database() as name');
  if (!String(rows[0]?.name).endsWith('_test')) {
    throw new Error(`${who} recusado: "${rows[0]?.name}" nao e um banco de teste (_test)`);
  }
}

const MIGRATIONS_DIR = path.join(__dirname, '..', 'db', 'migrations');

/**
 * Aplica as migrações no banco de teste (o `db` já aponta para TEST_DATABASE_URL pelo setup).
 * O loader nativo do knex não entende `import { Knex }` de migrações antigas (que não podem ser
 * editadas); aqui cada arquivo é importado pelo vite, que descarta os imports só de tipo.
 * Deve ser a única forma de os testes migrarem ou reverterem o banco (nada de `db.migrate` direto).
 */
export async function migrateTestDb(): Promise<void> {
  await assertTestDatabase('migrateTestDb');
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.ts'))
    .sort();
  await db.migrate.latest({
    migrationSource: {
      getMigrations: async () => files,
      getMigrationName: (name: string) => name,
      getMigration: (name: string) => import(/* @vite-ignore */ path.join(MIGRATIONS_DIR, name)),
    },
  });
}

export async function makeTenant(opts: { leadhunterEnabled?: boolean; plan?: string } = {}): Promise<string> {
  const slug = `t-${randomUUID().slice(0, 12)}`;
  const [row] = await db('tenants')
    .insert({
      name: `Teste ${slug}`,
      slug,
      plan: opts.plan ?? 'free',
      leadhunter_enabled: opts.leadhunterEnabled ?? false,
    })
    .returning('id');
  return row.id as string;
}

export async function makeUser(
  tenantId: string,
  role: Role,
  opts: { active?: boolean } = {},
): Promise<string> {
  const active = opts.active ?? true;
  const key = randomUUID().slice(0, 12);
  const [row] = await db('users')
    .insert({
      tenant_id: tenantId,
      email: `${role}-${key}@teste.local`,
      password_hash: 'x',
      full_name: `${role} ${key}`,
      role,
      is_active: active,
    })
    .returning('id');
  await db('user_tenants').insert({ user_id: row.id, tenant_id: tenantId, role, is_active: active });
  return row.id as string;
}

/** Limpa o que os testes do LeadHunter escrevem (as tabelas dependentes caem em cascata) */
export async function resetLeadHunter(): Promise<void> {
  // O TRUNCATE ... CASCADE apaga também negócios, atividades, agenda etc.
  await assertTestDatabase('resetLeadHunter');
  await db.raw(
    'TRUNCATE lh_api_calls, lh_searches, lh_search_coverage, lh_observations, lh_campaign_companies, lh_companies, lh_campaigns, lead_requests, contacts, notifications, lead_assignments RESTART IDENTITY CASCADE',
  );
}
