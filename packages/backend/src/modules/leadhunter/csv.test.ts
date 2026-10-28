import { describe, it, expect } from 'vitest';
import { validateCampaign, type Analysis, type CompanyData, type ExportRow } from './domain';
import { exportCsv, parseCsv, validateImport } from './csv';

// Cabeçalho do LeadHunter (app.py:37), na ordem do arquivo.
const HEADERS = [
  'Nome', 'Categoria', 'Cidade', 'Endereço', 'Telefone', 'Site', 'Instagram', 'Estado Instagram', 'Nota',
  'Avaliações', 'Pontos de prioridade', 'Prioridade', 'Posição mediana observada', 'Amostras', 'Etapa',
  'Observações do operador', 'Origem', 'Google Maps', 'Coletado em', 'Evidências de busca', 'Motivos',
  'Cobertura nas buscas',
];

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

function company(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Loja A', category: 'Moda feminina', city: 'São Carlos', address: 'Rua Teste 1',
    phone: null, website: null, reviews: null, rating: null, ...overrides,
  };
}

function exportRow(overrides: Partial<ExportRow['company']> = {}, analysis: Analysis | null = null): ExportRow {
  return {
    company: {
      name: 'Loja A', category: 'Moda feminina', city: 'São Carlos', borough: null, address: 'Rua Teste 1',
      placeId: null, phone: null, website: null, websiteChecked: false, rating: null, reviews: null,
      mapsUrl: null, sourceUrl: null, collectedAt: '2026-10-27T10:00:00Z', updatedAt: '2026-10-27T10:00:00Z',
      instagram: null, instagramStatus: 'not_searched', instagramSource: null, instagramCandidates: [],
      instagramSearchedAt: null, instagramVerifiedAt: null, fieldSources: {},
      source: 'live', stage: 'new', notes: '', ...overrides,
    } as CompanyData & { source: 'live'; stage: 'new'; notes: string },
    analysis,
    observations: [],
  };
}

const lines = (csv: string) => csv.slice(1).split('\r\n');

describe('validateImport', () => {
  it('aceita campos ausentes e rejeita números inválidos', () => {
    const { config, leads } = validateImport({ config: campaign(), leads: [company()] });
    expect(config.source).toBe('import');
    expect(config.useJev).toBe(false);
    expect(config.enrich).toBe(false);
    expect(leads[0].rating).toBeNull();
    expect(() => validateImport({ config: campaign(), leads: [company({ rating: 9 })] })).toThrow();
  });

  it('força importação sem enriquecimento mesmo que a config peça o contrário', () => {
    const { config } = validateImport({ config: { ...campaign(), enrich: true, useJev: true }, leads: [company()] });
    expect(config.enrich).toBe(false);
    expect(config.useJev).toBe(false);
  });

  it('importa CSV no formato do Excel brasileiro', () => {
    const csv = '\ufeffNome;Endereço;Cidade;Nota;Avaliações;Telefone;Coluna extra\r\nLoja A;Rua 1;;4,8;1.234;(16) 3333-0000;x\r\n;;;;;;\r\n';
    const { leads } = validateImport({ config: campaign(), csv });
    expect(leads).toHaveLength(1);
    expect(leads[0].rating).toBe(4.8);
    expect(leads[0].reviews).toBe(1234);
    expect(leads[0].city).toBe('São Carlos,São Paulo,Brazil');
    expect(leads[0].website).toBeNull();
  });

  it('cria campanha só com Nome e Endereço e rejeita CSV sem Endereço', () => {
    const config = { niche: 'Loja de moda feminina', city: 'São Carlos' };
    const { leads } = validateImport({ config, csv: 'Nome;Endereço\nLoja A;Rua 1\nLoja B;Rua 2\n' });
    expect(leads.map((l) => l.name)).toEqual(['Loja A', 'Loja B']);
    expect(() => validateImport({ config, csv: 'Nome\nA\n' })).toThrow(/Endereço/);
  });

  it('numera erros por linha do arquivo no CSV e por empresa na lista', () => {
    expect(() =>
      validateImport({ config: campaign(), csv: 'nome,endereco,nota\nA,Rua 1,4\nB,Rua 2,9\n' }),
    ).toThrow('Linha 3: Número fora do intervalo permitido.');
    expect(() => validateImport({ config: campaign(), leads: [company(), company({ name: '' })] })).toThrow(
      'Empresa 2: Preencha o texto com até 200 caracteres.',
    );
    expect(() => validateImport({ config: campaign(), leads: ['x'] })).toThrow('Empresa 1: Empresa inválida no arquivo.');
  });

  it('exige de 1 a 100 empresas', () => {
    const msg = 'Importe de 1 a 100 empresas por arquivo.';
    expect(() => validateImport({ config: campaign(), leads: [] })).toThrow(msg);
    expect(() => validateImport({ config: campaign(), leads: Array.from({ length: 101 }, () => company()) })).toThrow(msg);
    expect(() => validateImport({ config: campaign() })).toThrow(msg);
    expect(() => validateImport(null)).toThrow(msg);
    expect(validateImport({ config: campaign(), leads: Array.from({ length: 100 }, () => company()) }).leads).toHaveLength(100);
  });

  it('exige campanha válida', () => {
    expect(() => validateImport({ leads: [company()] })).toThrow();
    expect(() => validateImport({ config: 'x', leads: [company()] })).toThrow('Campanha inválida.');
  });

  it('normaliza instagram, ids e links aceitando camelCase e snake_case', () => {
    const { leads } = validateImport({
      config: campaign(),
      leads: [
        company({ instagram: 'https://instagram.com/loja/?x=1', place_id: 'p1', maps_url: 'https://maps.example/a' }),
        company({ instagram: 'javascript:alert(1)', placeId: 'p2', mapsUrl: 'https://maps.example/b', sourceUrl: 'ftp://x' }),
      ],
    });
    expect(leads[0]).toMatchObject({
      instagram: 'https://www.instagram.com/loja/', instagramStatus: 'candidate', placeId: 'p1',
      mapsUrl: 'https://maps.example/a', instagramSource: 'Arquivo importado pelo operador.',
    });
    expect(leads[1]).toMatchObject({ instagram: null, instagramStatus: 'not_searched', placeId: 'p2', sourceUrl: null });
  });
});

describe('parseCsv', () => {
  it('rejeita arquivo vazio e CSV sem as colunas obrigatórias', () => {
    expect(() => parseCsv('  \n ')).toThrow('Arquivo CSV vazio.');
    expect(() => parseCsv(42 as unknown as string)).toThrow('Arquivo CSV vazio.');
    expect(() => parseCsv('nome;telefone\nA;1\n')).toThrow('O CSV precisa das colunas Nome e Endereço na primeira linha.');
  });

  it('detecta ; , e tab pela primeira linha', () => {
    for (const sep of [';', ',', '\t']) {
      expect(parseCsv(`Nome${sep}Endereço\nA${sep}Rua 1\n`)).toEqual([{ name: 'A', address: 'Rua 1' }]);
    }
  });

  it('lê campos entre aspas com separador, aspas duplas e quebra de linha', () => {
    const rows = parseCsv('Nome;Endereço\n"A; ""B""";"Rua 1\nfundos"\n');
    expect(rows).toEqual([{ name: 'A; "B"', address: 'Rua 1\nfundos' }]);
  });

  it('desfaz a proteção de fórmula do nosso próprio export, sem tocar em apóstrofos comuns', () => {
    const rows = parseCsv("Nome;Endereço\n'=Loja;'Rua 1\n'+x;'-y\n'@z;Rua 2\n");
    expect(rows.map((r) => r.name)).toEqual(['=Loja', '+x', '@z']);
    expect(rows[0].address).toBe("'Rua 1");
    expect(rows[1].address).toBe('-y');
  });

  it('usa só a primeira coluna repetida, ignora vazias e colunas desconhecidas', () => {
    const rows = parseCsv('Nome;Empresa;Endereço;Place_ID;Foo\nA;B;Rua 1;;x\n');
    expect(rows).toEqual([{ name: 'A', address: 'Rua 1' }]);
    expect(parseCsv('Nome;Endereço;Place ID;Google Maps;Fonte\nA;R;p1;m;s\n')[0]).toMatchObject({
      place_id: 'p1', maps_url: 'm', source_url: 's',
    });
  });

  it('não confunde nomes de propriedade do Object com colunas', () => {
    expect(parseCsv('constructor;Nome;Endereço\nx;A;R\n')).toEqual([{ name: 'A', address: 'R' }]);
  });
});

describe('exportCsv', () => {
  it('começa com o BOM U+FEFF e termina linhas com CRLF', () => {
    const out = exportCsv([exportRow()]);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out.charCodeAt(1)).not.toBe(0xfeff);
    expect(out.endsWith('\r\n')).toBe(true);
  });

  it('cabeçalho exportado é idêntico ao do LeadHunter', () => {
    const header = lines(exportCsv([]))[0];
    expect(header.split(';')).toEqual(HEADERS);
    expect(header.split(';')).toHaveLength(22);
    expect(lines(exportCsv([exportRow()]))[0]).toBe(header);
  });

  it('escreve as 22 colunas de uma linha com análise completa', () => {
    const analysis = {
      score: 60, priority: 'medium', rankMedian: 16.5, rankSamples: 2, coverage: { appeared: 1, searched: 9, depth: 30 },
      reasons: [{ points: 25, text: 'Categoria compatível.' }, { points: 35, text: 'Sem site.' }],
    } as Analysis;
    const row = exportRow(
      { phone: '+551699225-9814', website: 'https://a.example', rating: 4.5, reviews: 7, notes: 'Ligar', instagram: 'https://www.instagram.com/a/', instagramStatus: 'candidate', mapsUrl: 'https://maps.example/a' },
      analysis,
    );
    row.observations = [{ query: 'q', location: 'l', rank: 3, depth: 30, observedAt: '2026-10-27T10:00:00Z', sourceUrl: null }];
    const cells = lines(exportCsv([row]))[1].split(';');
    expect(cells).toHaveLength(22);
    expect(cells.slice(0, 19)).toEqual([
      'Loja A', 'Moda feminina', 'São Carlos', 'Rua Teste 1', "'+55 16 99225-9814", 'https://a.example',
      'https://www.instagram.com/a/', 'candidate', '4.5', '7', '60', 'medium', '16.5', '2', 'new', 'Ligar', 'live',
      'https://maps.example/a', '2026-10-27T10:00:00Z',
    ]);
    expect(JSON.parse(cells[19].replace(/^"|"$/g, '').replace(/""/g, '"'))).toEqual(row.observations);
    expect(cells[20]).toBe('Categoria compatível. | Sem site.');
    expect(cells[21]).toBe('1 de 9 (até 30 resultados)');
  });

  it('deixa a análise em branco quando não há análise', () => {
    const cells = lines(exportCsv([exportRow()]))[1].split(';');
    expect(cells.slice(8, 15)).toEqual(['', '', '', '', '', '', 'new']);
    expect(cells[19]).toBe('[]');
    expect(cells.slice(20)).toEqual(['', '']);
  });

  it('neutraliza fórmulas em qualquer célula, inclusive com espaço antes', () => {
    const out = lines(exportCsv([exportRow({ name: '=SUM(1)', notes: '+formula', city: '@x', address: '-1', category: ' =y' })]))[1];
    const cells = out.split(';');
    expect(cells[0]).toBe("'=SUM(1)");
    expect(cells[1]).toBe("' =y");
    expect(cells[2]).toBe("'@x");
    expect(cells[3]).toBe("'-1");
    expect(cells[15]).toBe("'+formula");
  });

  it('prefixa células que começam com tab ou CR', () => {
    const out = exportCsv([exportRow({ name: '\tx', city: '\ry' })]);
    expect(out).toContain("'\tx;");
    expect(out).toContain(`"'\ry"`);
  });

  it('põe entre aspas o que tem ;, aspas ou quebra de linha', () => {
    const out = exportCsv([exportRow({ name: '=A;"B"', notes: 'a\nb' })]);
    expect(out).toContain(`"'=A;""B"""`);
    expect(out).toContain('"a\nb"');
  });

  it('o export volta intacto pelo import (ida e volta)', () => {
    const csv = exportCsv([exportRow({ name: '=Loja', phone: '123', rating: 4.5, reviews: 7 })]);
    const { leads } = validateImport({ config: campaign(), csv });
    expect(leads[0].name).toBe('=Loja');
    expect(leads[0].reviews).toBe(7);
    expect(leads[0].rating).toBe(4.5);
    expect(leads[0].phone).toBe('123');
  });
});
