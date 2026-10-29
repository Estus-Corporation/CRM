import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db';
import { getContact } from '../contacts/contacts.service';
import { hasTestDb, makeTenant, migrateTestDb, resetLeadHunter } from '../../test/db';
import { getContactLeadHunter } from './contactView';
import type { Analysis, CampaignConfig, CompanyData, Observation } from './domain';
import * as store from './store';

const config: CampaignConfig = {
  niche: 'Loja de moda feminina',
  city: 'São Carlos,São Paulo,Brazil',
  source: 'demo',
  service: 'google',
  limit: 10,
  keywords: ['loja de moda feminina São Carlos'],
  coordinates: [],
  enrich: true,
  useJev: true,
  forceRefresh: false,
};

const lead: Partial<CompanyData> = {
  name: 'Loja A',
  category: 'Moda feminina',
  city: 'São Carlos',
  address: 'Rua Teste 1',
  placeId: 'p1',
  phone: '1633334444',
  website: null,
  rating: 4.5,
  reviews: 120,
  mapsUrl: 'https://maps.google.com/?cid=1',
  sourceUrl: 'https://interno.example/serp',
  borough: null,
  instagram: null,
  instagramStatus: 'not_searched',
  instagramCandidates: [],
  collectedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const observation: Observation = {
  query: 'loja de moda feminina São Carlos',
  location: 'SC',
  rank: 3,
  depth: 30,
  observedAt: '2026-01-01T00:00:00.000Z',
  sourceUrl: null,
};

const analysis: Analysis = {
  score: 72,
  priority: 'high',
  reasons: [{ points: 20, text: 'Sem site' }],
  rankMedian: 3,
  rankSamples: 1,
  visibility: 'top',
  completeness: 80,
  coverage: { appeared: 1, searched: 1, depth: 30 },
  fit: { choice: 'match', method: 'rules', confidence: null, model: null },
  version: 'v1',
  peerMedian: null,
};

describe.skipIf(!hasTestDb)('ficha LeadHunter do contato', () => {
  let tenantA: string;
  let tenantB: string;

  async function seedCompany(
    tenantId: string,
    opts: { lead?: Partial<CompanyData>; analysis?: Analysis } = {},
  ): Promise<{ companyId: string; identity: string }> {
    const campaign = await store.createCampaign(tenantId, config);
    const companyId = await store.upsertCompany(tenantId, campaign, { ...lead, ...opts.lead }, 'live', observation);
    await store.setAnalysis(tenantId, campaign, companyId, opts.analysis ?? analysis);
    await store.updateCompany(tenantId, companyId, { notes: 'nota interna do operador' });
    const company = await store.getCompany(tenantId, companyId);
    return { companyId, identity: company!.identity };
  }

  async function seedContact(tenantId: string, extra: Record<string, unknown> = {}): Promise<string> {
    const [row] = await db('contacts')
      .insert({ tenant_id: tenantId, type: 'lead', full_name: 'Loja A', source: 'leadhunter', google_rating: 4.5, ...extra })
      .returning('id');
    return row.id as string;
  }

  beforeAll(async () => {
    await migrateTestDb();
  });
  beforeEach(async () => {
    await resetLeadHunter();
    tenantA = await makeTenant({ leadhunterEnabled: true });
    tenantB = await makeTenant();
  });
  afterAll(async () => {
    await db.destroy();
  });

  it('contato do LeadHunter devolve a ficha com análise, sem dados internos', async () => {
    const { identity } = await seedCompany(tenantA);
    const contactId = await seedContact(tenantA, { external_id: identity });

    const info = await getContactLeadHunter(tenantA, contactId);

    expect(info).toMatchObject({
      name: 'Loja A',
      rating: 4.5,
      reviews: 120,
      mapsUrl: 'https://maps.google.com/?cid=1',
      instagramStatus: 'not_searched',
      analysis: { score: 72, priority: 'high', priorityLabel: 'Alta', visibility: 'top', fitChoice: 'match', completeness: 80 },
    });
    const text = JSON.stringify(info);
    for (const forbidden of ['nota interna', 'fieldSources', '"notes"', '"stage"', '"crm"', '"source"', '"sourceUrl"', '"observations"', '"companyId"', 'interno.example']) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('contato sem external_id ou de outra origem devolve null', async () => {
    const { identity } = await seedCompany(tenantA);
    const manual = await seedContact(tenantA, { source: 'manual', external_id: null });
    const otherSource = await seedContact(tenantA, { source: 'manual', external_id: identity });
    const noId = await seedContact(tenantA, { external_id: null });
    const orphan = await seedContact(tenantA, { external_id: 'sem-empresa' });

    for (const id of [manual, otherSource, noId, orphan]) expect(await getContactLeadHunter(tenantA, id)).toBeNull();
  });

  it('isola workspaces: contato de outro workspace dá 404 e empresa de mesma identidade fora do tenant nunca vem', async () => {
    const { identity } = await seedCompany(tenantA);
    const contactA = await seedContact(tenantA, { external_id: identity });

    await expect(getContactLeadHunter(tenantB, contactA)).rejects.toMatchObject({ status: 404 });

    // Contato do tenant B aponta para a mesma identidade, mas a empresa só existe no tenant A
    const contactB = await seedContact(tenantB, { external_id: identity });
    expect(await getContactLeadHunter(tenantB, contactB)).toBeNull();
  });

  it('usa a análise da campanha mais antiga quando a mais nova não tem análise', async () => {
    const { identity } = await seedCompany(tenantA);
    const newer = await store.createCampaign(tenantA, config);
    await store.upsertCompany(tenantA, newer, lead, 'live');
    const contactId = await seedContact(tenantA, { external_id: identity });

    const info = await getContactLeadHunter(tenantA, contactId);

    expect(info?.analysis).toMatchObject({ score: 72, priority: 'high' });
  });

  it('mesma identidade em dois workspaces: cada contato vê só a própria empresa', async () => {
    const a = await seedCompany(tenantA);
    const b = await seedCompany(tenantB, { lead: { rating: 3 }, analysis: { ...analysis, score: 10, priority: 'low' } });
    expect(b.identity).toBe(a.identity);
    const contactA = await seedContact(tenantA, { external_id: a.identity });
    const contactB = await seedContact(tenantB, { external_id: b.identity });

    const infoA = await getContactLeadHunter(tenantA, contactA);
    const infoB = await getContactLeadHunter(tenantB, contactB);

    expect(infoA).toMatchObject({ rating: 4.5, analysis: { score: 72, priorityLabel: 'Alta' } });
    expect(infoB).toMatchObject({ rating: 3, analysis: { score: 10, priorityLabel: 'Baixa' } });
  });

  it('GET /contacts/:id devolve google_rating como número', async () => {
    const contactId = await seedContact(tenantA, { external_id: 'x', lead_score: 55 });
    const noRating = await seedContact(tenantA, { google_rating: null });

    expect(await getContact(tenantA, contactId)).toMatchObject({ google_rating: 4.5, lead_score: 55, external_id: 'x' });
    expect((await getContact(tenantA, noRating)).google_rating).toBeNull();
  });
});
