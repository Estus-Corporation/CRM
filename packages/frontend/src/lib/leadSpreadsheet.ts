import type { BulkContact } from '@/services/contacts.service';

type Field = keyof BulkContact;

/** Nomes de coluna aceitos (comparados sem acento, minúsculos, sem espaços extras) */
const HEADER_ALIASES: Record<Field, string[]> = {
  fullName: ['nome', 'name', 'nome completo', 'full name', 'cliente', 'contato', 'lead', 'responsavel'],
  phone: ['telefone', 'phone', 'celular', 'whatsapp', 'whats', 'fone', 'tel', 'numero', 'contato telefone'],
  email: ['email', 'e-mail', 'e mail', 'mail'],
  company: ['empresa', 'company', 'razao social', 'nome fantasia', 'negocio', 'loja'],
  jobTitle: ['cargo', 'funcao', 'job title', 'titulo'],
  niche: ['nicho', 'segmento', 'ramo', 'setor', 'categoria', 'niche'],
  source: ['origem', 'fonte', 'source', 'canal'],
  // Dados de prospecção (LeadHunter / Google Maps)
  address: ['endereco', 'address', 'localizacao', 'logradouro', 'endereco completo', 'local'],
  mapsUrl: ['google', 'google maps', 'maps', 'link google', 'link do google', 'pagina do google', 'link maps', 'url maps', 'link google maps', 'perfil google', 'google url'],
  instagram: ['instagram', 'insta', 'ig', 'link instagram', 'perfil instagram'],
  website: ['site', 'website', 'web', 'url site', 'link site', 'site oficial', 'pagina web'],
  googleRating: ['avaliacao', 'nota', 'rating', 'estrelas', 'nota google', 'avaliacao google'],
  googleReviews: ['avaliacoes', 'reviews', 'numero de avaliacoes', 'qtd avaliacoes', 'total avaliacoes', 'quantidade de avaliacoes'],
  leadContext: ['contexto', 'contexto da empresa', 'observacoes', 'observacao', 'obs', 'sobre', 'sobre a empresa', 'descricao', 'notas'],
};

// "Sem site", "não tem", "-" etc. = vazio (o card mostra o selo "Sem site")
const EMPTY_VALUES = new Set(['-', '--', 'n/a', 'na', 'nao', 'nao tem', 'sem', 'sem site', 'nenhum', 'none', 'null']);

/** Converte o texto da célula no tipo do campo; null = ignorar */
function cellValue(field: Field, raw: string): string | number | null {
  const v = raw.trim();
  if (!v || EMPTY_VALUES.has(v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())) return null;
  if (field === 'googleRating') {
    const n = Number(v.replace(',', '.').replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n >= 0 && n <= 5 ? Math.round(n * 10) / 10 : null;
  }
  if (field === 'googleReviews') {
    const n = parseInt(v.replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? n : null;
  }
  const max =
    field === 'source' ? 100 : field === 'leadContext' ? 5000 : field === 'mapsUrl' ? 1000 : field === 'address' || field === 'website' ? 500 : 255;
  return v.slice(0, max);
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

function fieldForHeader(header: string): Field | null {
  const h = normalize(header);
  if (!h) return null;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [Field, string[]][]) {
    if (aliases.includes(h)) return field;
  }
  return null;
}

/** CSV simples com aspas; o separador é detectado (Excel pt-BR salva com ";") */
function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = [';', ',', '\t'].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best,
  );

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Excel pt-BR salva CSV em Windows-1252: se não for UTF-8 válido, relê nessa codificação */
function decodeText(buffer: ArrayBuffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

async function readRows(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer();
  if (/\.(xlsx|xls|ods)$/i.test(file.name)) {
    // Carregado só aqui: o SheetJS é pesado e só o importador usa
    const XLSX = await import('xlsx');
    const book = XLSX.read(buffer, { type: 'array' });
    const sheet = book.Sheets[book.SheetNames[0]];
    return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' });
  }
  return parseCsv(decodeText(buffer));
}

export interface ParsedSheet {
  leads: BulkContact[];
  /** Colunas reconhecidas, na ordem do arquivo (pra mostrar ao usuário) */
  columns: { header: string; field: Field | null }[];
  /** Linhas sem nome (ignoradas) */
  ignored: number;
  hasHeader: boolean;
}

/**
 * Lê .xlsx/.xls/.csv/.txt. Com cabeçalho reconhecido, mapeia pelas colunas;
 * sem cabeçalho, assume 1ª coluna = nome e 2ª = telefone.
 */
export async function parseLeadSpreadsheet(file: File): Promise<ParsedSheet> {
  const rows = (await readRows(file))
    .map((r) => r.map((c) => String(c ?? '').trim()))
    .filter((r) => r.some(Boolean));
  if (rows.length === 0) return { leads: [], columns: [], ignored: 0, hasHeader: false };

  const headerFields = rows[0].map(fieldForHeader);
  const hasHeader = headerFields.includes('fullName');
  const fields: (Field | null)[] = hasHeader ? headerFields : rows[0].map((_, i) => (i === 0 ? 'fullName' : i === 1 ? 'phone' : null));
  const columns = (hasHeader ? rows[0] : rows[0].map((_, i) => `Coluna ${i + 1}`)).map((header, i) => ({ header, field: fields[i] }));

  let ignored = 0;
  const leads: BulkContact[] = [];
  for (const row of hasHeader ? rows.slice(1) : rows) {
    const lead: Record<string, string | number> = {};
    fields.forEach((field, i) => {
      // Primeira coluna que bater vence (ex.: "Telefone" e "WhatsApp" na mesma planilha)
      if (!field || !row[i] || lead[field] !== undefined) return;
      const value = cellValue(field, row[i]);
      if (value !== null) lead[field] = value;
    });
    if (!lead.fullName) { ignored++; continue; }
    leads.push(lead as unknown as BulkContact);
  }
  return { leads, columns, ignored, hasHeader };
}

/** Modelo pra baixar: ";" + BOM, abre certo no Excel brasileiro */
export function downloadLeadTemplate() {
  const csv = [
    'Nome;Telefone;E-mail;Empresa;Cargo;Nicho;Endereço;Google Maps;Instagram;Site;Avaliação;Avaliações;Contexto',
    'Maria Souza;(16) 99999-0000;maria@empresa.com.br;Padaria Pão Bom;Sócia;Alimentação;Rua das Flores, 120 - Centro, Ribeirão Preto - SP;https://maps.google.com/?cid=123;@padariapaobom;;4,7;212;Padaria de bairro há 20 anos, quer vender por delivery',
    'João Lima;(11) 98888-1111;;Auto Peças Lima;Gerente;Automotivo;Av. Brasil, 900 - São Paulo - SP;;@autopecaslima;autopecaslima.com.br;4,2;58;',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo-leads.csv';
  a.click();
  URL.revokeObjectURL(url);
}
