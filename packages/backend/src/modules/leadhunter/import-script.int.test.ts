import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { importRadarExport, type RadarExport } from '../../../scripts/import-leadhunter';
import { db } from '../../db';
import { hasTestDb, makeTenant, migrateTestDb, resetLeadHunter } from '../../test/db';
import type { CampaignConfig } from './domain';
import { estimateCalls } from './engine';
import type { Settings } from './providers';
import * as store from './store';

// Gerada por LeadHunter/scripts/export_for_crm.py a partir de um SQLite descartável: campanha demo,
// uma importação (com etapa, notas, Instagram confirmado e envio ao CRM), uma campanha ao vivo com
// busca paga em cache (executed_at em 2099, para nunca vencer os 30 dias) e uma campanha que
// estava na fila com uma chamada pendente.
const fixture = (): RadarExport =>
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'test', 'fixtures', 'radar-export.json'), 'utf-8')) as RadarExport;

const SETTINGS: Settings = { dataforseo: null, jevKey: null, jevModel: 'm', runLimit: 80, dailyLimit: 200, cacheDays: 30 };

const LIVE_CONFIG: CampaignConfig = {
  niche: 'Moda',
  city: 'São Carlos,São Paulo,Brazil',
  source: 'live',
  service: 'google',
  limit: 10,
  keywords: ['moda são carlos'],
  coordinates: [],
  enrich: false,
  useJev: false,
  forceRefresh: false,
};

const countOf = async (table: string, tenantId: string): Promise<number> =>
  Number((await db(table).where({ tenant_id: tenantId }).count({ n: '*' }).first())?.n);

const snakeKeys = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(snakeKeys);
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => [...(k.includes('_') ? [k] : []), ...snakeKeys(v)]);
  }
  return [];
};

describe.skipIf(!hasTestDb)('importação do histórico do Radar Local', () => {
  let tenant: string;

  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await resetLeadHunter();
    tenant = await makeTenant({ leadhunterEnabled: true });
  });
  afterAll(async () => {
    await db.destroy();
  });

  it('importa contagens iguais às do JSON', async () => {
    const data = fixture();
    const report = await importRadarExport(tenant, data);

    expect(report.campaigns.inserted).toBe(data.campaigns.length);
    expect(report.companies.inserted).toBe(data.leads.length);
    expect(await countOf('lh_campaigns', tenant)).toBe(data.campaigns.length);
    expect(await countOf('lh_companies', tenant)).toBe(data.leads.length);
    expect(await countOf('lh_campaign_companies', tenant)).toBe(data.campaign_leads.length);
    expect(await countOf('lh_observations', tenant)).toBe(data.observations.length);
    expect(await countOf('lh_search_coverage', tenant)).toBe(data.search_coverage.length);
    expect(await countOf('lh_searches', tenant)).toBe(data.searches.length);
    expect(await countOf('lh_api_calls', tenant)).toBe(data.api_calls.length);
  });

  it('rodar duas vezes não duplica nada', async () => {
    const data = fixture();
    await importRadarExport(tenant, data);
    const again = await importRadarExport(tenant, data);

    const { neutralized, ...tables } = again;
    expect(neutralized).toBe(0);
    for (const table of Object.values(tables)) expect(table.inserted).toBe(0);
    expect(await countOf('lh_campaigns', tenant)).toBe(data.campaigns.length);
    expect(await countOf('lh_companies', tenant)).toBe(data.leads.length);
    expect(await countOf('lh_campaign_companies', tenant)).toBe(data.campaign_leads.length);
    expect(await countOf('lh_observations', tenant)).toBe(data.observations.length);
    expect(await countOf('lh_search_coverage', tenant)).toBe(data.search_coverage.length);
    expect(await countOf('lh_searches', tenant)).toBe(data.searches.length);
    expect(await countOf('lh_api_calls', tenant)).toBe(data.api_calls.length);
  });

  it('etapa, notas e Instagram confirmado chegam intactos', async () => {
    const data = fixture();
    await importRadarExport(tenant, data);
    const radar = data.leads.find((l) => l.data.name === 'Boutique Importada');
    const row = await db('lh_companies').where({ tenant_id: tenant, identity: radar?.id }).first();
    const company = await store.getCompany(tenant, row.id);

    expect(company).toMatchObject({
      identity: radar?.id,
      source: 'import',
      stage: 'interested',
      notes: 'Falar com a dona na terça.',
      instagram: 'https://www.instagram.com/boutique/',
      instagramStatus: 'confirmed',
      instagramVerifiedAt: '2026-10-02T10:00:00+00:00',
      placeId: 'ChIJimportada',
      crm: { status: 'imported', contactId: '11111111-1111-1111-1111-111111111111', ownerId: null },
    });
    expect(company?.fieldSources.name.observedAt).toBe('2026-10-01T10:00:00+00:00');
    // chaves do JSON em camelCase em tudo: dados, análise e resultados de busca
    const analysis = await db('lh_campaign_companies').where({ tenant_id: tenant, company_id: row.id }).first('analysis');
    expect(analysis.analysis).toMatchObject({ score: 61, rankSamples: 0 });
    const searches = await db('lh_searches').where({ tenant_id: tenant }).select('results');
    expect([...snakeKeys(row.data), ...snakeKeys(analysis.analysis), ...snakeKeys(searches)]).toEqual([]);
    expect(row.data).not.toHaveProperty('id');
  });

  it('busca importada é reaproveitada por estimateCalls', async () => {
    const before = await estimateCalls(tenant, LIVE_CONFIG, SETTINGS);
    expect(before).toEqual({ searches: 1, reused: 0, calls: 1 });

    await importRadarExport(tenant, fixture());

    expect(await estimateCalls(tenant, LIVE_CONFIG, SETTINGS)).toEqual({ searches: 1, reused: 1, calls: 0 });
    // outro workspace não enxerga o cache
    const other = await makeTenant({ leadhunterEnabled: true });
    expect((await estimateCalls(other, LIVE_CONFIG, SETTINGS)).reused).toBe(0);
  });

  it('campanha que estava na fila não roda sozinha e chamada pendente vira desconhecida', async () => {
    await importRadarExport(tenant, fixture());

    expect(await db('lh_campaigns').where({ tenant_id: tenant, state: 'queued' }).count({ n: '*' }).first()).toMatchObject({ n: '0' });
    const queued = await db('lh_campaigns').where({ tenant_id: tenant }).whereRaw("config->>'niche' = 'Pet'").first();
    expect(queued.state).toBe('interrupted');
    expect(queued.config.radarId).toMatch(/^[0-9a-f]{32}$/);
    expect(queued.config.useJev).toBe(true);
    expect(await db('lh_api_calls').where({ tenant_id: tenant, state: 'pending' }).count({ n: '*' }).first()).toMatchObject({ n: '0' });
    expect(await db('lh_api_calls').where({ tenant_id: tenant, state: 'unknown' }).count({ n: '*' }).first()).toMatchObject({ n: '1' });
  });

  it('recusa workspace inexistente e não grava nada', async () => {
    await expect(importRadarExport(randomUUID(), fixture())).rejects.toThrow(/não existe/);
    expect(await db('lh_companies').count({ n: '*' }).first()).toMatchObject({ n: '0' });
  });

  it('dois workspaces importam o mesmo arquivo sem se misturar', async () => {
    const data = fixture();
    const other = await makeTenant({ leadhunterEnabled: true });
    await importRadarExport(tenant, data);
    await importRadarExport(other, data);

    expect(await countOf('lh_companies', tenant)).toBe(data.leads.length);
    expect(await countOf('lh_companies', other)).toBe(data.leads.length);
    expect(await countOf('lh_searches', other)).toBe(data.searches.length);
  });
});
