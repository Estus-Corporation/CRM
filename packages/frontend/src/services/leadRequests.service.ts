import { api } from './api';
import type { CampaignInput, LeadHunterService } from './leadhunter.service';

export type LeadRequestStatus = 'queued' | 'running' | 'done' | 'partial' | 'failed' | 'cancelled';

/** Pedido de leads: o admin executa pelo LeadHunter (na hora, se foi ele que pediu) */
export interface LeadRequest {
  id: string;
  niche: string;
  city: string;
  quantity: number;
  notes: string | null;
  service: LeadHunterService;
  keywords: string[];
  coordinates: string[];
  enrich: boolean;
  use_jev: boolean;
  force_refresh: boolean;
  campaign_id: string | null;
  decided_by: string | null;
  status: LeadRequestStatus;
  message: string | null;
  delivered_count: number;
  requested_by: string | null;
  requester_name: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveredContact {
  id: string;
  full_name: string;
  company_name: string | null;
  phone: string | null;
  niche: string | null;
}

export type LeadRequestDetail = LeadRequest & { contacts: DeliveredContact[] };

export interface LeadRequestListParams {
  userId?: string;
  status?: LeadRequestStatus;
}

/** Corpo em camelCase, os mesmos campos da campanha do LeadHunter (a quantidade vai em `limit`) + observações */
export type LeadRequestBody = CampaignInput & { notes?: string };

export const leadRequestsService = {
  list: (params: LeadRequestListParams = {}): Promise<LeadRequest[]> =>
    api.get('/lead-requests', { params }).then((r) => r.data.data),
  get: (id: string): Promise<LeadRequestDetail> => api.get(`/lead-requests/${id}`).then((r) => r.data.data),
  create: (input: LeadRequestBody): Promise<LeadRequest> =>
    api.post('/lead-requests', input).then((r) => r.data.data),
  /** Executa um pedido na fila; `edits` são os campos que o admin ajustou */
  execute: (id: string, edits: Partial<LeadRequestBody>): Promise<LeadRequest> =>
    api.post(`/lead-requests/${id}/execute`, edits).then((r) => r.data.data),
  reject: (id: string, message: string): Promise<LeadRequest> =>
    api.post(`/lead-requests/${id}/reject`, { message }).then((r) => r.data.data),
  cancel: (id: string): Promise<LeadRequest> => api.post(`/lead-requests/${id}/cancel`).then((r) => r.data.data),
};
