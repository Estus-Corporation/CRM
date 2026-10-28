import { createHash } from 'node:crypto';

// Regras puras de validação, identidade e pontuação (port de radar/domain.py do LeadHunter).
// Sem banco e sem rede: tudo aqui é determinístico e testável.

export type Source = 'demo' | 'live' | 'import';
export type Service = 'google' | 'website' | 'marketing';
export type Stage = 'new' | 'reviewing' | 'contacted' | 'interested' | 'discarded' | 'do_not_contact';
export type Priority = 'high' | 'medium' | 'low' | 'review' | 'excluded';

export const SERVICES: Record<Service, string> = {
  google: 'Presença no Google',
  website: 'Criação de site',
  marketing: 'Marketing digital',
};

export const STAGES: readonly Stage[] = ['new', 'reviewing', 'contacted', 'interested', 'discarded', 'do_not_contact'];

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
  review: 'Em revisão',
  excluded: 'Fora do perfil',
};

export interface CampaignConfig {
  niche: string;
  city: string;
  source: Source;
  service: Service;
  limit: number;
  keywords: string[];
  coordinates: string[];
  enrich: boolean;
  useJev: boolean;
  forceRefresh: boolean;
}

export interface Fit {
  choice: 'match' | 'no_match' | 'unknown';
  method: 'rules' | 'jev' | 'error';
  confidence: number | null;
  model: string | null;
  niche?: string;
  evaluatedAt?: string;
  regionReview?: boolean;
}

export interface Observation {
  query: string;
  location: string;
  rank: number | null;
  depth: number;
  observedAt: string;
  sourceUrl: string | null;
}

export interface SearchDone {
  query: string;
  location: string;
  depth: number;
}

export interface CompanyData {
  name: string;
  category: string | null;
  city: string | null;
  borough: string | null;
  address: string | null;
  placeId: string | null;
  phone: string | null;
  website: string | null;
  websiteChecked: boolean;
  rating: number | null;
  reviews: number | null;
  mapsUrl: string | null;
  sourceUrl: string | null;
  collectedAt: string;
  updatedAt: string;
  rank?: number | null;
  regionReview?: boolean;
  instagram: string | null;
  instagramStatus: 'not_searched' | 'candidate' | 'not_found' | 'error' | 'confirmed' | 'rejected';
  instagramSource: string | null;
  instagramCandidates: { url: string; title: string; description: string }[];
  instagramSearchedAt: string | null;
  instagramVerifiedAt: string | null;
  fieldSources: Record<string, { source: Source; url: string | null; observedAt: string }>;
}

export interface Analysis {
  score: number;
  priority: Priority;
  reasons: { points: number; text: string }[];
  rankMedian: number | null;
  rankSamples: number;
  visibility: 'not_measured' | 'top' | 'middle' | 'low';
  completeness: number;
  coverage: { appeared: number; searched: number; depth: number } | null;
  fit: Fit;
  version: 'v1';
  peerMedian: number | null;
}

export interface ExportRow {
  company: CompanyData & { source: Source; stage: Stage; notes: string };
  analysis: Analysis | null;
  observations: Observation[];
}

export interface CallRecorder {
  reserve(op: { provider: 'dataforseo' | 'typesafe'; operation: 'maps' | 'organic' | 'classification' }): Promise<string>;
  finish(
    callId: string,
    r: { state: 'success' | 'error' | 'unknown'; cost?: number | null; tokens?: number | null; model?: string | null },
  ): Promise<void>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SEARCH_LANGUAGE = 'pt';

/** Contagem em pontos de código, como o `len` do Python. */
function length(value: string): number {
  return [...value].length;
}

export function normalized(v: unknown): string {
  const folded = String(v || '')
    .normalize('NFKD')
    .replace(/[^\x00-\x7f]/g, '')
    .toLowerCase();
  return (folded.match(/[a-z0-9]+/g) ?? []).join(' ');
}

export function number(v: unknown, min = 0, max = 10_000_000, integer = false): number | null {
  if (v === null || v === undefined || v === '') return null;
  let n: number;
  if (typeof v === 'number') {
    n = v;
  } else if (typeof v === 'string') {
    const s = v.trim();
    if (/^[+-]?(inf|infinity|nan)$/i.test(s)) throw new Error('Número fora do intervalo permitido.');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) throw new Error('Número inválido.');
    n = Number(s);
  } else {
    throw new Error('Número inválido.');
  }
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    throw new Error('Número fora do intervalo permitido.');
  }
  return n;
}

export function text(v: unknown, limit = 200, required = false): string {
  const value = v ?? '';
  if (typeof value !== 'string') throw new Error('Campo de texto inválido.');
  const trimmed = value.trim();
  if (length(trimmed) > limit || (required && !trimmed)) {
    throw new Error(`Preencha o texto com até ${limit} caracteres.`);
  }
  return trimmed;
}

export function safeUrl(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 2048) return null;
  const trimmed = v.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return trimmed;
  } catch {
    return null;
  }
}

const NON_PROFILE_PATHS = new Set(['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'direct']);

export function instagramUrl(v: unknown): string | null {
  const safe = safeUrl(v);
  if (!safe) return null;
  const url = new URL(safe);
  if (url.hostname !== 'instagram.com' && url.hostname !== 'www.instagram.com') return null;
  const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
  if (parts.length !== 1 || NON_PROFILE_PATHS.has(parts[0].toLowerCase())) return null;
  if (!/^[A-Za-z0-9._]{1,30}$/.test(parts[0])) return null;
  return `https://www.instagram.com/${parts[0]}/`;
}

/** Só exibição: números BR no padrão do provedor (+55DDNNNN-NNNN); outros valores ficam como estão. */
export function formatPhone(v: string | null): string | null {
  if (typeof v !== 'string') return v;
  const m = /^\+55(\d{2})(9\d{4}|[2-5]\d{3})-?(\d{4})$/.exec(v.trim());
  return m ? `+55 ${m[1]} ${m[2]}-${m[3]}` : v;
}

/** DD/MM no fuso de Brasília (UTC-3 fixo; sem horário de verão desde 2019). */
export function shortDate(iso: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) throw new Error('Data inválida.');
  const local = new Date(time - 3 * 60 * 60 * 1000);
  const day = String(local.getUTCDate()).padStart(2, '0');
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

export function isFresh(iso: string | null | undefined, days: number, now: Date = new Date()): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return !Number.isNaN(time) && time >= now.getTime() - days * DAY_MS;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

export function mapsSearchKey(keyword: string, city: string, coordinate?: string | null): string {
  // O ponto vai literal: normalized() descartaria o sinal e juntaria hemisférios opostos.
  // Sem caracteres latinos normalized() vira "" e termos distintos colidiriam; cai para o texto em minúsculas
  // (maiúsculas, minúsculas e sigma final aproximam o casefold do Python: ß -> ss, ς -> σ).
  const fold = (x: unknown) => normalized(x) || String(x || '').trim().toUpperCase().toLowerCase().replace(/ς/g, 'σ');
  const place = coordinate ? `coord:${coordinate}` : fold(city);
  return sha256(['maps', fold(keyword), place, SEARCH_LANGUAGE].join('|'));
}

/** Representação de float do Python (`-22.0`, `1e-05`), para o ponto de busca manter a mesma chave de cache. */
function pyFloat(n: number): string {
  if (Object.is(n, -0)) return '-0.0';
  if (Number.isInteger(n)) return `${n}.0`;
  if (Math.abs(n) < 1e-4) return n.toExponential().replace(/e([+-])(\d)$/, 'e$10$2');
  return String(n);
}

function searchPoint(raw: unknown): string {
  const invalid = () => new Error('Ponto deve ser latitude,longitude,zoom (ex.: -22.0174,-47.8909,14z).');
  const parts = text(raw, 60, true).replace(/ /g, '').split(',');
  if (parts.length !== 3) throw invalid();
  const lat = number(parts[0], -90, 90);
  const lon = number(parts[1], -180, 180);
  const zoom = number(parts[2].replace(/z$/, ''), 3, 21, true);
  if (lat === null || lon === null || zoom === null) throw invalid();
  return `${pyFloat(lat)},${pyFloat(lon)},${zoom}z`;
}

// Quebras de linha do `str.splitlines` do Python.
const LINE_BREAKS = new RegExp('\\r\\n|[\\n\\r\\v\\f\\x1c-\\x1e\\x85\\u2028\\u2029]');

const SOURCES: readonly string[] = ['demo', 'live', 'import'];

export function validateCampaign(data: unknown): CampaignConfig {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error('Campanha inválida.');
  const input = data as Record<string, unknown>;
  const pick = (camel: string, snake: string) => (input[camel] !== undefined ? input[camel] : input[snake]);

  const niche = text(input.niche, 100, true);
  const city = text(input.city, 100, true);
  const source = input.source === undefined ? 'demo' : input.source;
  if (typeof source !== 'string' || !SOURCES.includes(source)) throw new Error('Origem inválida.');
  const service = input.service === undefined ? 'google' : input.service;
  if (typeof service !== 'string' || !Object.hasOwn(SERVICES, service)) throw new Error('Serviço inválido.');
  const limit = number(input.limit === undefined ? 10 : input.limit, 1, 50, true);
  if (limit === null) throw new Error('Informe a quantidade de empresas.');

  let rawKeywords = input.keywords || [];
  if (typeof rawKeywords === 'string') rawKeywords = [rawKeywords];
  if (!Array.isArray(rawKeywords)) throw new Error('Termos inválidos.');
  // O termo padrão entra depois da separação: a cidade tem vírgulas e viraria termos soltos.
  const parts = rawKeywords
    .filter((k): k is string => typeof k === 'string')
    .flatMap((k) => k.split(/[\n\r,;]+/).map((part) => part.trim()));
  const keywords = [...new Set((parts.length ? parts : [`${niche} ${city}`]).filter(Boolean).map((k) => text(k, 180, true)))];
  if (keywords.length < 1 || keywords.length > 3) throw new Error('Use de um a três termos de busca.');

  let rawPoints = input.coordinates || [];
  if (typeof rawPoints === 'string') {
    rawPoints = rawPoints
      .split(LINE_BREAKS)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(rawPoints) || rawPoints.length > 3) throw new Error('Use até três pontos de busca.');

  return {
    niche,
    city,
    source: source as Source,
    service: service as Service,
    limit,
    keywords,
    coordinates: rawPoints.map(searchPoint),
    enrich: input.enrich !== false,
    useJev: pick('useJev', 'use_jev') !== false,
    forceRefresh: pick('forceRefresh', 'force_refresh') === true,
  };
}

export function identity(lead: Pick<CompanyData, 'placeId' | 'name' | 'address' | 'city'>, source: Source): string {
  const group = source === 'demo' ? 'demo' : 'real';
  const key = lead.placeId
    ? `place:${lead.placeId}`
    : `address:${[lead.name, lead.address, lead.city].map(normalized).join('|')}`;
  return sha256(`${group}:${key}`);
}

const NICHE_STOP_WORDS = new Set(['de', 'do', 'da', 'loja', 'lojas', 'em', 'e', 'para', 'a', 'o', 'empresa', 'servicos']);

export function localFit(lead: Pick<CompanyData, 'name' | 'category'>, niche: string): Fit {
  const tokens = new Set(normalized(niche).split(' ').filter((t) => t && !NICHE_STOP_WORDS.has(t)));
  const haystack = normalized(`${lead.name || ''} ${lead.category || ''}`);
  const match = tokens.size > 0 && [...tokens].every((t) => haystack.includes(t));
  return { choice: match ? 'match' : 'unknown', confidence: null, method: 'rules', model: null };
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const pairKey = (query: string, location: string) => JSON.stringify([query, location]);

/** Aparições sobre as buscas concluídas: a ausência é contada, nunca vira posição. */
export function coverage(observations: Observation[], searches: SearchDone[]): Analysis['coverage'] {
  if (!searches.length) return null;
  const done = new Set(searches.map((s) => pairKey(s.query, s.location)));
  const seen = new Set(
    observations
      .filter((o) => typeof o.rank === 'number' && o.rank > 0)
      .map((o) => pairKey(o.query, o.location))
      .filter((key) => done.has(key)),
  );
  return { appeared: seen.size, searched: done.size, depth: Math.min(...searches.map((s) => s.depth)) };
}

/** Arredondamento do Python (metade vai para o par), para a completude bater com a do LeadHunter. */
function roundHalfEven(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

const COMPLETENESS_FIELDS = ['name', 'category', 'address', 'phone', 'website', 'rating', 'reviews', 'instagram'] as const;

export function scoreLead(
  lead: CompanyData,
  observations: Observation[],
  fit: Fit,
  service: Service,
  peerMedian: number | null = null,
  searches: SearchDone[] = [],
): Analysis {
  fit = fit || { choice: 'unknown', method: 'rules', confidence: null, model: null };
  const matched = fit.choice === 'match' && (fit.method === 'rules' || (fit.confidence || 0) >= 0.8);
  const excluded = fit.choice === 'no_match' && (fit.confidence || 0) >= 0.8;
  const reasons: Analysis['reasons'] = [];
  let score = 0;
  const add = (points: number, reason: string) => {
    score += points;
    reasons.push({ points, text: reason });
  };

  const ranks = observations.map((o) => o.rank).filter((r): r is number => typeof r === 'number' && r > 0);
  const rankMedian = median(ranks);
  if (matched) add(25, 'Categoria compatível com o nicho solicitado.');
  if (lead.phone || lead.instagramStatus === 'confirmed') {
    add(15, 'Há um contato comercial informado ou Instagram confirmado.');
  }
  if (service === 'website') {
    if (lead.websiteChecked && !lead.website) {
      add(35, 'A fonte não informou site; verificar se há oportunidade de criação.');
    }
  } else if (rankMedian !== null) {
    const points = rankMedian > 10 ? 35 : rankMedian > 3 ? 20 : 0;
    if (points) add(points, `Posição mediana ${rankMedian} nas buscas observadas; avaliar descoberta local.`);
  }
  const reviews = lead.reviews;
  if (peerMedian !== null && reviews != null && reviews < peerMedian) {
    add(15, `${reviews} avaliações, abaixo da mediana ${peerMedian} da amostra comparável.`);
  }
  if (lead.rating != null && lead.rating >= 4 && reviews != null && reviews >= 5) {
    add(10, 'Nota de pelo menos 4 com cinco ou mais avaliações.');
  }

  const visibility =
    rankMedian === null ? 'not_measured' : rankMedian <= 3 ? 'top' : rankMedian <= 10 ? 'middle' : 'low';
  const priority: Priority = excluded
    ? 'excluded'
    : !matched
      ? 'review'
      : score >= 70
        ? 'high'
        : score >= 40
          ? 'medium'
          : 'low';
  const filled = COMPLETENESS_FIELDS.filter((k) => lead[k] != null && lead[k] !== '').length;

  return {
    score,
    priority,
    reasons,
    rankMedian,
    rankSamples: ranks.length,
    visibility,
    completeness: roundHalfEven((100 * filled) / COMPLETENESS_FIELDS.length),
    coverage: coverage(observations, searches),
    fit,
    version: 'v1',
    peerMedian,
  };
}
