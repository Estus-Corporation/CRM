import {
  formatPhone,
  instagramUrl,
  normalized,
  number,
  safeUrl,
  text,
  validateCampaign,
  type CampaignConfig,
  type CompanyData,
  type ExportRow,
} from './domain';

// Importação e exportação de CSV (port de app.py:34-120 do LeadHunter).

const BOM = String.fromCharCode(0xfeff);
const IMPORT_MIN = 1;
const IMPORT_MAX = 100;

const EXPORT_HEADERS = [
  'Nome', 'Categoria', 'Cidade', 'Endereço', 'Telefone', 'Site', 'Instagram', 'Estado Instagram', 'Nota',
  'Avaliações', 'Pontos de prioridade', 'Prioridade', 'Posição mediana observada', 'Amostras', 'Etapa',
  'Observações do operador', 'Origem', 'Google Maps', 'Coletado em', 'Evidências de busca', 'Motivos',
  'Cobertura nas buscas',
];

type Cell = string | number | null | undefined;

/** Neutraliza fórmulas de planilha; o `'` é desfeito por `parseCsv` na volta. */
function guardFormula(value: Cell): string {
  const s = value == null ? '' : String(value);
  return /^[=+\-@]/.test(s.trimStart()) || /^[\t\r]/.test(s) ? `'${s}` : s;
}

function quote(s: string): string {
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsv(rows: ExportRow[]): string {
  const lines = [EXPORT_HEADERS.join(';')];
  for (const { company, analysis, observations } of rows) {
    const cov = analysis?.coverage;
    const cells: Cell[] = [
      company.name, company.category, company.city, company.address, formatPhone(company.phone), company.website,
      company.instagram, company.instagramStatus, company.rating, company.reviews,
      analysis?.score, analysis?.priority, analysis?.rankMedian, analysis?.rankSamples,
      company.stage, company.notes, company.source, company.mapsUrl, company.collectedAt,
      JSON.stringify(observations),
      (analysis?.reasons ?? []).map((r) => r.text).join(' | '),
      cov ? `${cov.appeared} de ${cov.searched} (até ${cov.depth} resultados)` : null,
    ];
    lines.push(cells.map((c) => quote(guardFormula(c))).join(';'));
  }
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

const CSV_COLUMNS: Record<string, string> = {
  nome: 'name', name: 'name', empresa: 'name', categoria: 'category', category: 'category',
  cidade: 'city', city: 'city', endereco: 'address', address: 'address',
  telefone: 'phone', phone: 'phone', site: 'website', website: 'website', instagram: 'instagram',
  nota: 'rating', rating: 'rating', avaliacoes: 'reviews', reviews: 'reviews',
  'place id': 'place_id', place_id: 'place_id', 'google maps': 'maps_url', 'maps url': 'maps_url', maps_url: 'maps_url',
  fonte: 'source_url', 'source url': 'source_url', source_url: 'source_url',
};

const column = (header: string): string | undefined =>
  Object.hasOwn(CSV_COLUMNS, header) ? CSV_COLUMNS[header] : undefined;

/** Leitor de CSV como o `csv.reader` do Python: aspas só no início do campo, linha em branco vira `[]`. */
function readRows(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (content[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (c === '"' && field === '') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && content[i + 1] === '\n') i++;
      rows.push(row.length || field ? [...row, field] : []);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (row.length || field) rows.push([...row, field]);
  return rows;
}

/** Converte o CSV do operador (lista própria ou export anterior) em linhas de importação. */
export function parseCsv(content: string): Record<string, string>[] {
  if (typeof content !== 'string' || !content.trim()) throw new Error('Arquivo CSV vazio.');
  let start = 0;
  while (content[start] === BOM) start++;
  const body = content.slice(start);
  if (!body) throw new Error('Arquivo CSV vazio.');
  const first = body.split(/[\r\n]/, 1)[0];
  const count = (d: string) => first.split(d).length - 1;
  const delimiter = [';', ',', '\t'].reduce((best, d) => (count(d) > count(best) ? d : best));

  const [headerRow = [], ...dataRows] = readRows(body, delimiter);
  const fields = headerRow.map((h) => {
    const header = normalized(h).replace(/_/g, ' ');
    return column(header) ?? column(header.replace(/ /g, '_'));
  });
  if (!fields.includes('name') || !fields.includes('address')) {
    throw new Error('O CSV precisa das colunas Nome e Endereço na primeira linha.');
  }

  const rows: Record<string, string>[] = [];
  for (const values of dataRows) {
    if (!values.some((v) => v.trim())) continue;
    const row: Record<string, string> = {};
    fields.forEach((field, i) => {
      if (i >= values.length) return;
      let value = values[i].trim();
      // Desfaz a proteção de fórmula do nosso próprio export.
      if (["'=", "'+", "'-", "'@"].includes(value.slice(0, 2))) value = value.slice(1);
      if (!field || field in row || !value) return;
      if (field === 'rating') value = value.replace(/,/g, '.');
      else if (field === 'reviews' && /^\d{1,3}(\.\d{3})+$/.test(value)) value = value.replace(/\./g, '');
      row[field] = value;
    });
    rows.push(row);
  }
  return rows;
}

type Row = Record<string, unknown>;

const isObject = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Aceita camelCase (API) e snake_case (CSV e LeadHunter). */
const pick = (row: Row, camel: string, snake: string): unknown => (row[camel] !== undefined ? row[camel] : row[snake]);

function importRow(row: unknown, config: CampaignConfig): Partial<CompanyData> {
  if (!isObject(row)) throw new Error('Empresa inválida no arquivo.');
  const instagram = instagramUrl(row.instagram);
  return {
    name: text(row.name, 200, true),
    address: text(row.address, 500, true),
    city: text(row.city || config.city, 100, true),
    category: text(row.category, 200),
    placeId: text(pick(row, 'placeId', 'place_id'), 250) || null,
    phone: text(row.phone, 80) || null,
    website: safeUrl(row.website),
    instagram,
    instagramStatus: instagram ? 'candidate' : 'not_searched',
    instagramSource: 'Arquivo importado pelo operador.',
    rating: number(row.rating, 0, 5),
    reviews: number(row.reviews, 0, 10_000_000, true),
    sourceUrl: safeUrl(pick(row, 'sourceUrl', 'source_url')),
    mapsUrl: safeUrl(pick(row, 'mapsUrl', 'maps_url')),
    collectedAt: new Date().toISOString(),
  };
}

/** `{config?, csv}` ou `{config?, leads}`: de 1 a 100 empresas, erros apontam "Linha N" (CSV) ou "Empresa N". */
export function validateImport(body: unknown): { config: CampaignConfig; leads: Partial<CompanyData>[] } {
  if (!isObject(body)) throw new Error('Importe de 1 a 100 empresas por arquivo.');
  const data = body;
  const fromCsv = 'csv' in data;
  const rows: unknown = fromCsv ? parseCsv(data.csv as string) : data.leads;
  const rawConfig = data.config ?? {};
  const config = validateCampaign(
    isObject(rawConfig) ? { ...rawConfig, source: 'import', enrich: false, useJev: false } : rawConfig,
  );
  if (!Array.isArray(rows) || rows.length < IMPORT_MIN || rows.length > IMPORT_MAX) {
    throw new Error('Importe de 1 a 100 empresas por arquivo.');
  }
  const label = fromCsv ? 'Linha' : 'Empresa';
  // CSV: o cabeçalho é a linha 1, então a primeira empresa é a linha 2.
  const first = fromCsv ? 2 : 1;
  const leads = rows.map((row, i) => {
    try {
      return importRow(row, config);
    } catch (err) {
      const reason = err instanceof Error && err.message.endsWith('.') ? err.message : 'valor inválido.';
      throw new Error(`${label} ${i + first}: ${reason}`);
    }
  });
  return { config, leads };
}
