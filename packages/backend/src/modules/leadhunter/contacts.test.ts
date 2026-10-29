import { describe, expect, it } from 'vitest';
import type { Analysis } from './domain';
import { cutUtf16, splitSendable, toContactInput } from './contacts';
import type { Company } from './store';

// Port de CrmTests de test_radar.py (lead_payload e filtros de envio), agora sobre o CRM interno.

const company = (extra: Partial<Company> = {}): Company => ({
  id: 'company-id',
  identity: 'abc',
  source: 'import',
  stage: 'new',
  notes: '',
  crm: null,
  name: 'Loja A',
  category: null,
  city: null,
  borough: null,
  address: null,
  placeId: null,
  phone: null,
  website: null,
  websiteChecked: false,
  rating: null,
  reviews: null,
  mapsUrl: null,
  sourceUrl: null,
  collectedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  instagram: null,
  instagramStatus: 'not_searched',
  instagramSource: null,
  instagramCandidates: [],
  instagramSearchedAt: null,
  instagramVerifiedAt: null,
  fieldSources: {},
  ...extra,
});

const analysis = (extra: Partial<Analysis> = {}): Analysis => ({
  score: 10,
  priority: 'low',
  reasons: [],
  rankMedian: null,
  rankSamples: 0,
  visibility: 'not_measured',
  completeness: 0,
  coverage: null,
  fit: { choice: 'match', method: 'rules', confidence: null, model: null },
  version: 'v1',
  peerMedian: null,
  ...extra,
});

const units = (s: string | undefined) => s?.length ?? 0;
const hasLoneSurrogate = (s: string) => /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(s);

describe('toContactInput', () => {
  it('mapeia os campos; o Instagram candidato vai marcado como não confirmado', () => {
    const lead = company({
      category: 'Moda',
      address: 'Rua X',
      phone: '1699',
      website: 'https://a.com',
      mapsUrl: 'https://maps/x',
      rating: 4.5,
      reviews: 12,
      instagram: 'https://instagram.com/a/',
      instagramStatus: 'candidate',
      notes: 'Falar com a dona',
    });
    const scored = analysis({
      score: 72,
      priority: 'high',
      reasons: [
        { points: 20, text: 'Sem site' },
        { points: 5, text: 'Poucas avaliações' },
      ],
    });
    const payload = toContactInput(lead, scored);

    expect(payload.instagram).toBe('https://instagram.com/a/');
    expect(payload.leadContext).toContain('Instagram não confirmado');
    const confirmed = toContactInput({ ...lead, instagramStatus: 'confirmed' }, scored);
    expect(confirmed.instagram).toBe('https://instagram.com/a/');
    expect(confirmed.leadContext).not.toContain('Instagram não confirmado');
    const rejected = toContactInput({ ...lead, instagramStatus: 'rejected' }, scored);
    expect(rejected).not.toHaveProperty('instagram');
    expect(payload.externalId).toBe('abc');
    expect(payload.leadScore).toBe(72);
    expect([payload.fullName, payload.company, payload.niche]).toEqual(['Loja A', 'Loja A', 'Moda']);
    expect([payload.googleRating, payload.googleReviews, payload.mapsUrl, payload.website]).toEqual([
      4.5,
      12,
      'https://maps/x',
      'https://a.com',
    ]);
    for (const part of ['Prioridade Alta (72/100)', '- Sem site', '- Poucas avaliações', 'Observações: Falar com a dona']) {
      expect(payload.leadContext).toContain(part);
    }

    const bare = toContactInput(company(), analysis());
    for (const key of ['phone', 'website', 'instagram', 'googleRating', 'mapsUrl']) expect(bare).not.toHaveProperty(key);
    expect(bare.leadContext).not.toContain('Observações');
  });

  it('mantém os campos dentro dos limites do CRM', () => {
    const payload = toContactInput(
      company({
        phone: '9'.repeat(80),
        website: `https://a.com/${'x'.repeat(600)}`,
        mapsUrl: `https://m.com/${'y'.repeat(1100)}`,
        address: 'r'.repeat(700),
        city: 'c'.repeat(150),
        category: 'n'.repeat(300),
        notes: 'o'.repeat(9000),
      }),
      analysis(),
    );
    expect(payload.phone).toHaveLength(50);
    expect(payload).not.toHaveProperty('website');
    expect(payload).not.toHaveProperty('mapsUrl');
    expect(payload.leadContext).toHaveLength(5000);
    expect(payload.address).toHaveLength(500);
    expect(payload.city).toHaveLength(100);
    expect(payload.niche).toHaveLength(255);
  });

  it('corta por unidades UTF-16 e os limites ASCII continuam valendo', () => {
    const payload = toContactInput(
      company({
        notes: '😀'.repeat(4000),
        address: '😀'.repeat(400),
        category: 'a😀'.repeat(200),
        website: `https://a.com/${'😀'.repeat(300)}`,
      }),
      analysis({ score: 1 }),
    );
    expect(units(payload.leadContext)).toBeLessThanOrEqual(5000);
    expect(units(payload.leadContext)).toBeGreaterThan(4990);
    expect(units(payload.address)).toBeLessThanOrEqual(500);
    expect(units(payload.niche)).toBeLessThanOrEqual(255);
    expect(payload).not.toHaveProperty('website');
    expect(toContactInput(company({ notes: 'o'.repeat(9000) }), analysis({ score: 1 })).leadContext).toHaveLength(5000);
  });

  it('emoji e campos longos são cortados por UTF-16 e URL longa é omitida', () => {
    const payload = toContactInput(
      company({ name: '😀'.repeat(300), website: `https://a.com/${'x'.repeat(3000)}` }),
      analysis(),
    );
    expect(units(payload.fullName)).toBeLessThanOrEqual(255);
    expect(units(payload.company)).toBeLessThanOrEqual(255);
    expect(hasLoneSurrogate(payload.fullName)).toBe(false);
    expect(payload.website).toBeUndefined();
  });

  it('limita a pontuação a 0–100 e trata empresa sem análise como "Em revisão"', () => {
    expect(toContactInput(company(), analysis({ score: 140 })).leadScore).toBe(100);
    expect(toContactInput(company(), analysis({ score: -5 })).leadScore).toBe(0);
    const bare = toContactInput(company(), null);
    expect(bare).not.toHaveProperty('leadScore');
    expect(bare.leadContext).toBe('Prioridade Em revisão');
  });
});

describe('cutUtf16', () => {
  it('devolve null para ausente, não parte par substituto e respeita o limite', () => {
    expect(cutUtf16(null, 10)).toBeNull();
    expect(cutUtf16(undefined, 10)).toBeNull();
    expect(cutUtf16('abc', 10)).toBe('abc');
    expect(cutUtf16('a😀', 2)).toBe('a');
    expect(cutUtf16('a😀', 3)).toBe('a😀');
  });
});

describe('splitSendable', () => {
  const lead = (id: string, extra: Partial<Company> = {}) => company({ id, ...extra });

  it('do_not_contact e discarded nunca são enviados', () => {
    const { pending, excluded } = splitSendable([
      lead('a', { stage: 'do_not_contact' }),
      lead('b', { stage: 'discarded' }),
      lead('c'),
    ]);
    expect(pending.map((c) => c.id)).toEqual(['c']);
    expect(excluded).toBe(2);
  });

  it('empresas de demonstração nunca são enviadas', () => {
    const { pending, excluded } = splitSendable([lead('a', { source: 'demo' }), lead('b', { source: 'live' })]);
    expect(pending.map((c) => c.id)).toEqual(['b']);
    expect(excluded).toBe(1);
  });

  it('o que já foi enviado não é reenviado, mas erro pode ser', () => {
    const sent = (status: 'imported' | 'duplicate' | 'error') => ({
      contactId: null,
      status,
      sentAt: '2026-01-01T00:00:00.000Z',
      ownerId: null,
    });
    const { pending, skipped, excluded } = splitSendable([
      lead('a', { crm: sent('imported') }),
      lead('b', { crm: sent('duplicate') }),
      lead('c', { crm: sent('error') }),
      lead('d'),
    ]);
    expect(pending.map((c) => c.id)).toEqual(['c', 'd']);
    expect(skipped).toBe(2);
    expect(excluded).toBe(0);
  });
});
