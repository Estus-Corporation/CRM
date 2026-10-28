import { describe, it, expect } from 'vitest';
import {
  formatPhone,
  identity,
  instagramUrl,
  isFresh,
  localFit,
  mapsSearchKey,
  safeUrl,
  scoreLead,
  shortDate,
  validateCampaign,
  type CompanyData,
  type Fit,
} from './domain';

function campaign(overrides: Record<string, unknown> = {}) {
  return validateCampaign({
    niche: 'Loja de moda feminina',
    city: 'São Carlos,São Paulo,Brazil',
    service: 'google',
    source: 'demo',
    limit: 10,
    ...overrides,
  });
}

function company(overrides: Partial<CompanyData> = {}): CompanyData {
  return {
    name: 'Loja A',
    category: 'Moda feminina',
    city: 'São Carlos',
    borough: null,
    address: 'Rua Teste 1',
    placeId: null,
    phone: null,
    website: null,
    websiteChecked: false,
    rating: null,
    reviews: null,
    mapsUrl: null,
    sourceUrl: null,
    collectedAt: '2026-01-01T00:00:00+00:00',
    updatedAt: '2026-01-01T00:00:00+00:00',
    instagram: null,
    instagramStatus: 'not_searched',
    instagramSource: null,
    instagramCandidates: [],
    instagramSearchedAt: null,
    instagramVerifiedAt: null,
    fieldSources: {},
    ...overrides,
  };
}

const unknownFit: Fit = { choice: 'unknown', method: 'rules', confidence: null, model: null };

describe('pontuação', () => {
  it('números ausentes não viram zero nem ranking ruim', () => {
    const lead = company();
    const result = scoreLead(lead, [], localFit(lead, 'moda feminina'), 'google');
    expect(result.rankMedian).toBeNull();
    expect(result.visibility).toBe('not_measured');
    expect(result.score).toBe(25);
  });

  it('a completude arredonda metade para o par, como o Python', () => {
    expect(scoreLead(company(), [], unknownFit, 'google').completeness).toBe(38);
    expect(scoreLead(company({ phone: '1', website: 'https://a.com' }), [], unknownFit, 'google').completeness).toBe(62);
  });

  it('site ausente em importação não é lacuna verificada', () => {
    const result = scoreLead(company(), [], localFit(company(), 'moda feminina'), 'website');
    expect(result.score).toBe(25);
  });

  it('a mediana usa só posições observadas', () => {
    const obs = [
      { rank: 12 },
      { rank: null },
      { rank: 20 },
    ] as never;
    const score = scoreLead(company(), obs, unknownFit, 'google');
    expect(score.rankMedian).toBe(16);
    expect(score.rankSamples).toBe(2);
    expect(score.priority).toBe('review');
  });

  it('a cobertura conta ausências explícitas sem mudar a nota', () => {
    const searches = ['a', 'b', 'c'].flatMap((query) =>
      ['p1', 'p2', 'p3'].map((location) => ({ query, location, depth: 30 })),
    );
    const base = { depth: 30, observedAt: '', sourceUrl: null };
    const obs = [
      { ...base, query: 'a', location: 'p1', rank: 4 },
      { ...base, query: 'b', location: 'p2', rank: null },
      { ...base, query: 'x', location: 'p1', rank: 2 },
    ];
    const result = scoreLead(company(), obs, unknownFit, 'google', null, searches);
    expect(result.coverage).toEqual({ appeared: 1, searched: 9, depth: 30 });
    expect(result.score).toBe(scoreLead(company(), obs, unknownFit, 'google').score);
    expect(scoreLead(company(), obs, unknownFit, 'google').coverage).toBeNull();
  });

  it('JEV incerto vira revisão e JEV descartado vira excluído', () => {
    const lead = company({ phone: '123', rating: 4.8, reviews: 10 });
    const obs = [{ rank: 18 }] as never;
    let result = scoreLead(lead, obs, { choice: 'match', confidence: 0.6, method: 'jev', model: null }, 'google', 30);
    expect(result.priority).toBe('review');
    result = scoreLead(lead, [], { choice: 'no_match', confidence: 0.95, method: 'jev', model: null }, 'google');
    expect(result.priority).toBe('excluded');
  });
});

describe('validação', () => {
  it('o termo padrão não é separado pelas vírgulas da cidade', () => {
    expect(campaign().keywords).toEqual(['Loja de moda feminina São Carlos,São Paulo,Brazil']);
  });

  it('rejeita entradas excessivas e não finitas', () => {
    const invalid = [{ limit: 1000 }, { limit: NaN }, { coordinates: '999,0,14z' }, { keywords: ['a', 'b', 'c', 'd'] }];
    for (const data of invalid) expect(() => campaign(data)).toThrow();
  });

  it('separa termos por linhas, vírgulas e ponto e vírgula', () => {
    const raw = 'loja de roupa feminina são carlos, boutique feminina são carlos;moda feminina são carlos';
    for (const value of [raw, [raw], raw.replace(', ', '\n').replace(';', '\r\n')]) {
      expect(campaign({ keywords: value }).keywords).toHaveLength(3);
    }
    expect(campaign({ keywords: 'a\n\n a ,b' }).keywords).toEqual(['a', 'b']);
  });

  it('forceRefresh só é verdadeiro com true', () => {
    expect(campaign().forceRefresh).toBe(false);
    expect(campaign({ forceRefresh: true }).forceRefresh).toBe(true);
    expect(campaign({ force_refresh: true }).forceRefresh).toBe(true);
    expect(campaign({ forceRefresh: 'sim' }).forceRefresh).toBe(false);
  });

  it('enrich e useJev valem true a menos que venha false', () => {
    expect(campaign()).toMatchObject({ enrich: true, useJev: true });
    expect(campaign({ enrich: false, use_jev: false })).toMatchObject({ enrich: false, useJev: false });
    expect(campaign({ useJev: false }).useJev).toBe(false);
  });

  it('normaliza os pontos de busca como o Python', () => {
    expect(campaign({ coordinates: '-22.0174, -47.8909, 14z' }).coordinates).toEqual(['-22.0174,-47.8909,14z']);
    expect(campaign({ coordinates: ['-22,-47,14'] }).coordinates).toEqual(['-22.0,-47.0,14z']);
    expect(campaign({ coordinates: '-22,-47,14z\r\n\n-23,-48,10z' }).coordinates).toEqual(['-22.0,-47.0,14z', '-23.0,-48.0,10z']);
    expect(() => campaign({ coordinates: ['-22,-47'] })).toThrow('Ponto deve ser latitude,longitude,zoom');
  });
});

describe('Instagram e telefone', () => {
  it('só aceita URLs de perfil do Instagram', () => {
    expect(instagramUrl('javascript:alert(1)')).toBeNull();
    expect(instagramUrl('https://instagram.com.evil.test/a')).toBeNull();
    expect(instagramUrl('https://instagram.com/p/xyz')).toBeNull();
    expect(instagramUrl('https://instagram.com/loja/?x=1')).toBe('https://www.instagram.com/loja/');
  });

  it('safeUrl exige http(s):// como o urlparse do Python', () => {
    expect(safeUrl('https:/evil.com')).toBeNull();
    expect(safeUrl('http:foo')).toBeNull();
    expect(safeUrl('https://a.com')).toBe('https://a.com');
    expect(instagramUrl('https:/instagram.com/loja')).toBeNull();
  });

  it('formata o padrão de telefone do provedor e deixa o resto como está', () => {
    expect(formatPhone('+55163371-5243')).toBe('+55 16 3371-5243');
    expect(formatPhone('+551699225-9814')).toBe('+55 16 99225-9814');
    for (const other of ['(16) 3333-0000', '+1 555 123 4567', '+5516337', null]) {
      expect(formatPhone(other)).toBe(other);
    }
  });
});

describe('identidade e chaves', () => {
  it('a identidade preserva filiais e separa demonstração', () => {
    const first = company({ phone: '555' });
    const second = company({ phone: '555', address: 'Rua Teste 2' });
    expect(identity(first, 'live')).not.toBe(identity(second, 'live'));
    expect(identity(first, 'live')).not.toBe(identity(first, 'demo'));
  });

  it('identity bate com o valor gravado pelo Python', () => {
    expect(identity({ placeId: 'abc', name: '', address: null, city: null }, 'live')).toBe('09b5ff589bc988c5865b2a019a075b71');
    expect(identity({ placeId: null, name: 'Loja A', address: 'Rua Teste 1', city: 'São Carlos' }, 'demo')).toBe(
      '003d5627f009d4cc67960eb97e79d449',
    );
  });

  it('mapsSearchKey bate com o valor gravado pelo Python', () => {
    expect(mapsSearchKey('Moda feminina', 'São Carlos')).toBe('ea8d6cde569321d1b269a8442b7a1c9f');
  });

  it('mapsSearchKey dobra a caixa como o casefold do Python', () => {
    expect(mapsSearchKey('ß', 'x')).toBe('c2f61fa0176295d872d066bcb8fe4aac');
    expect(mapsSearchKey('ΑΣ', 'x')).toBe('3d00831eabe558b0b485c293f4363426');
  });

  it('acentos, caixa e espaços compartilham a chave, mas hemisférios não', () => {
    expect(mapsSearchKey('Moda  Feminina', 'São Carlos,State of São Paulo,Brazil')).toBe(
      mapsSearchKey('moda feminina', 'Sao Carlos,State of Sao Paulo,Brazil'),
    );
    expect(mapsSearchKey('x', 'c', '-22.0,-47.8,14z')).not.toBe(mapsSearchKey('x', 'c', '22.0,47.8,14z'));
    expect(mapsSearchKey('x', 'c')).not.toBe(mapsSearchKey('x', 'd'));
  });

  it('palavras-chave e cidades sem letras latinas não colidem', () => {
    expect(mapsSearchKey('日本', 'Tokyo')).not.toBe(mapsSearchKey('한국', 'Tokyo'));
    expect(mapsSearchKey('x', '東京')).not.toBe(mapsSearchKey('x', '大阪'));
  });
});

describe('datas', () => {
  it('a data curta usa o fuso de Brasília', () => {
    expect(shortDate('2026-01-01T01:00:00+00:00')).toBe('31/12');
  });

  it('isFresh compara com o limite em dias', () => {
    const now = new Date('2026-10-27T12:00:00Z');
    expect(isFresh('2026-10-20T12:00:00+00:00', 30, now)).toBe(true);
    expect(isFresh('2026-09-01T12:00:00+00:00', 30, now)).toBe(false);
    expect(isFresh(null, 30, now)).toBe(false);
    expect(isFresh(undefined, 30, now)).toBe(false);
  });
});
