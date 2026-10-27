import { api } from './api';

export type LeadRequestStatus = 'queued' | 'claimed' | 'running' | 'done' | 'partial' | 'failed' | 'cancelled';

/** Pedido de leads feito no CRM e atendido pelo Radar Local */
export interface LeadRequest {
  id: string;
  niche: string;
  city: string;
  quantity: number;
  notes: string | null;
  status: LeadRequestStatus;
  message: string | null;
  delivered_count: number;
  requested_by: string | null;
  requester_name: string | null;
  claimed_at: string | null;
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

export interface CreateLeadRequestInput {
  niche: string;
  city: string;
  quantity: number;
  notes?: string;
}

export const leadRequestsService = {
  list: (params: LeadRequestListParams = {}): Promise<LeadRequest[]> =>
    api.get('/lead-requests', { params }).then((r) => r.data.data),
  get: (id: string): Promise<LeadRequestDetail> => api.get(`/lead-requests/${id}`).then((r) => r.data.data),
  create: (input: CreateLeadRequestInput): Promise<LeadRequest> =>
    api.post('/lead-requests', input).then((r) => r.data.data),
  cancel: (id: string): Promise<LeadRequest> => api.post(`/lead-requests/${id}/cancel`).then((r) => r.data.data),
};
