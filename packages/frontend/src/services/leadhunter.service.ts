import { api } from './api';

// Tipos espelham packages/backend/src/modules/leadhunter (domain.ts e store.ts); JSON em camelCase.

export type LeadHunterSource = 'demo' | 'live' | 'import';
export type LeadHunterService = 'google' | 'website' | 'marketing';
export type LeadHunterStage = 'new' | 'reviewing' | 'contacted' | 'interested' | 'discarded' | 'do_not_contact';
export type LeadHunterPriority = 'high' | 'medium' | 'low' | 'review' | 'excluded';
export type CampaignState =
  | 'importing'
  | 'queued'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled'
  | 'interrupted';
export type InstagramStatus = 'not_searched' | 'candidate' | 'not_found' | 'error' | 'confirmed' | 'rejected';

/** Configuração normalizada de uma campanha (já validada pelo backend) */
export interface CampaignConfig {
  niche: string;
  city: string;
  source: LeadHunterSource;
  service: LeadHunterService;
  limit: number;
  keywords: string[];
  coordinates: string[];
  enrich: boolean;
  useJev: boolean;
  forceRefresh: boolean;
  leadRequestId?: string;
}

/** Formulário de campanha: o backend valida e preenche os padrões */
export type CampaignInput = Partial<Omit<CampaignConfig, 'leadRequestId'>> & { niche: string; city: string };

export interface Campaign {
  id: string;
  createdAt: string;
  updatedAt: string;
  config: CampaignConfig;
  state: CampaignState;
  message: string;
  progress: number;
  cancelRequested: boolean;
  warnings: string[];
  createdBy: string | null;
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

export interface Analysis {
  score: number;
  priority: LeadHunterPriority;
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

export interface Observation {
  query: string;
  location: string;
  rank: number | null;
  depth: number;
  observedAt: string;
  sourceUrl: string | null;
}

export interface CrmResult {
  contactId: string | null;
  status: 'imported' | 'duplicate' | 'error';
  sentAt: string;
  ownerId: string | null;
  error?: string;
}

export interface Company {
  id: string;
  identity: string;
  source: LeadHunterSource;
  stage: LeadHunterStage;
  notes: string;
  crm: CrmResult | null;
  analysis?: Analysis;
  observations?: Observation[];
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
  instagramStatus: InstagramStatus;
  instagramSource: string | null;
  instagramCandidates: { url: string; title: string; description: string }[];
  instagramSearchedAt: string | null;
  instagramVerifiedAt: string | null;
  fieldSources: Record<string, { source: LeadHunterSource; url: string | null; observedAt: string }>;
}

export interface CampaignUsage {
  provider: string;
  calls: number;
  cost: number;
  tokens: number;
  incomplete: number;
}

export interface SearchCoverage {
  query: string;
  location: string;
  depth: number;
  observedAt: string;
}

export interface CampaignDetail {
  campaign: Campaign;
  companies: Company[];
  usage: CampaignUsage[];
  coverage: SearchCoverage[];
}

export interface CompanyFilters {
  q?: string;
  priority?: LeadHunterPriority | '';
  stage?: LeadHunterStage | '';
}

export interface Estimate {
  searches: number;
  reused: number;
  calls: number;
}

/** Credenciais configuradas e limites do servidor (nunca as chaves) */
export interface LeadHunterStatus {
  dataforseo: boolean;
  jev: boolean;
  jevModel: string;
  runLimit: number;
  dailyLimit: number;
  callsToday: number;
  searchCacheDays: number;
}

export interface SearchRow {
  id: string;
  provider: string;
  operation: string;
  cacheKey: string;
  keyword: string;
  location: string;
  depth: number;
  campaignId: string | null;
  executedAt: string;
  resultCount: number;
  cost: number | null;
  reuseCount: number;
  lastReusedAt: string | null;
  expired: boolean;
}

export interface FoundCompany {
  id: string;
  name: string | null;
  category: string | null;
  city: string | null;
  phone: string | null;
  rating: number | null;
  reviews: number | null;
  campaigns: number;
  firstSeen: string;
  crmStatus: CrmResult['status'] | null;
  demo: boolean;
}

export interface FoundCompanies {
  companies: FoundCompany[];
  truncated: boolean;
  limit: number;
}

export interface CompanyHistoryItem extends Observation {
  campaignId: string;
  niche: string;
}

export interface UpdateCompanyInput {
  stage?: LeadHunterStage;
  notes?: string;
  instagramStatus?: 'confirmed' | 'rejected' | 'candidate';
  instagram?: string | null;
}

/** Importação de arquivo: `csv` (texto) ou `leads` (de 1 a 100 empresas) */
export type ImportInput =
  | { config?: Partial<CampaignInput>; csv: string }
  | { config?: Partial<CampaignInput>; leads: Record<string, unknown>[] };

export interface SendToContactsInput {
  campaignId: string;
  /** Ausente = todas as empresas da campanha */
  companyIds?: string[];
  ownerId: string | null;
}

export interface SendSummary {
  imported: number;
  duplicate: number;
  error: number;
  excluded: number;
  skipped: number;
  items: { externalId: string | null; contactId: string | null; status: 'imported' | 'duplicate' | 'error'; error?: string }[];
}

const asBlob = (r: { data: unknown }) => r.data as Blob;

export const leadhunterService = {
  status: (): Promise<LeadHunterStatus> => api.get('/leadhunter/status').then((r) => r.data.data),

  listCampaigns: (): Promise<Campaign[]> => api.get('/leadhunter/campaigns').then((r) => r.data.data),
  getCampaign: (id: string, filters: CompanyFilters = {}): Promise<CampaignDetail> =>
    api.get(`/leadhunter/campaigns/${id}`, { params: filters }).then((r) => r.data.data),
  estimate: (config: CampaignInput): Promise<Estimate> =>
    api.post('/leadhunter/campaigns/estimate', config).then((r) => r.data.data),
  createCampaign: (config: CampaignInput): Promise<{ id: string }> =>
    api.post('/leadhunter/campaigns', config).then((r) => r.data.data),
  importCampaign: (input: ImportInput): Promise<{ id: string }> =>
    api.post('/leadhunter/import', input).then((r) => r.data.data),
  cancelCampaign: (id: string): Promise<{ ok: true }> => api.post(`/leadhunter/campaigns/${id}/cancel`).then((r) => r.data.data),
  exportCampaign: (id: string, filters: CompanyFilters = {}): Promise<Blob> =>
    api.get(`/leadhunter/campaigns/${id}/export`, { params: filters, responseType: 'blob' }).then(asBlob),
  sendToContacts: ({ campaignId, ...body }: SendToContactsInput): Promise<SendSummary> =>
    api.post(`/leadhunter/campaigns/${campaignId}/contacts`, body).then((r) => r.data.data),

  companyHistory: (id: string): Promise<CompanyHistoryItem[]> =>
    api.get(`/leadhunter/companies/${id}/history`).then((r) => r.data.data),
  updateCompany: (id: string, input: UpdateCompanyInput): Promise<{ ok: true }> =>
    api.patch(`/leadhunter/companies/${id}`, input).then((r) => r.data.data),
  deleteCompany: (id: string): Promise<{ ok: true }> => api.delete(`/leadhunter/companies/${id}`).then((r) => r.data.data),

  listSearches: (): Promise<SearchRow[]> => api.get('/leadhunter/searches').then((r) => r.data.data),
  foundCompanies: (demo: boolean): Promise<FoundCompanies> =>
    api.get('/leadhunter/found-companies', { params: { demo: demo ? '1' : '0' } }).then((r) => r.data.data),
  exportFound: (companyIds?: string[]): Promise<Blob> =>
    api.post('/leadhunter/found-companies/export', { companyIds }, { responseType: 'blob' }).then(asBlob),
};
