import { api } from './api';

export interface Pipeline {
  id: string;
  name: string;
  is_default: boolean;
  tenant_id: string;
  created_at: string;
}

export interface Stage {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color: string;
  probability: number;
}

export interface StageMeta extends Stage {
  dealCount: number;
  totalValue: number;
}

export interface StageWithDeals extends Stage {
  deals: Deal[];
  totalValue: number;
}

export interface StageDealsPage {
  deals: Deal[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  currency: string;
  status: 'open' | 'won' | 'lost';
  stage_id: string;
  pipeline_id: string;
  contact_id?: string;
  contact_name?: string;
  owner_id?: string;
  owner_name?: string;
  expected_close?: string;
  position: number;
  created_at: string;
}

export const pipelineService = {
  listPipelines: () => api.get('/pipelines').then((r) => r.data.data as Pipeline[]),
  getPipeline: (id: string) => api.get(`/pipelines/${id}`).then((r) => r.data.data),
  createPipeline: (input: { name: string; isDefault?: boolean }) =>
    api.post('/pipelines', input).then((r) => r.data.data as Pipeline),
  updatePipeline: (id: string, input: { name?: string }) =>
    api.patch(`/pipelines/${id}`, input).then((r) => r.data.data as Pipeline),
  deletePipeline: (id: string) => api.delete(`/pipelines/${id}`),

  listStages: (pipelineId: string) =>
    api.get(`/pipelines/${pipelineId}/stages`).then((r) => r.data.data as Stage[]),
  createStage: (pipelineId: string, input: { name: string; color?: string; probability?: number }) =>
    api.post(`/pipelines/${pipelineId}/stages`, input).then((r) => r.data.data as Stage),
  updateStage: (pipelineId: string, stageId: string, input: Partial<{ name: string; color: string; probability: number }>) =>
    api.patch(`/pipelines/${pipelineId}/stages/${stageId}`, input).then((r) => r.data.data as Stage),
  deleteStage: (pipelineId: string, stageId: string) =>
    api.delete(`/pipelines/${pipelineId}/stages/${stageId}`),
  reorderStages: (pipelineId: string, stageIds: string[]) =>
    api.post(`/pipelines/${pipelineId}/stages/reorder`, { stageIds }),

  getKanban: (pipelineId: string) =>
    api.get('/deals/kanban', { params: { pipeline: pipelineId } }).then((r) => r.data.data as StageMeta[]),

  getStageDeals: (stageId: string, page: number) =>
    api.get(`/deals/kanban-stage/${stageId}`, { params: { page } }).then((r) => r.data.data as StageDealsPage),
};

export interface DealsListParams {
  status?: 'open' | 'won' | 'lost';
  pipeline?: string;
  contact?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export const dealsService = {
  list: (params?: DealsListParams) =>
    api.get('/deals', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/deals/${id}`).then((r) => r.data.data as Deal),
  create: (input: {
    title: string; pipelineId: string; stageId: string;
    contactId?: string; ownerId?: string; value?: number; expectedClose?: string;
  }) => api.post('/deals', input).then((r) => r.data.data as Deal),
  update: (id: string, input: Partial<{ title: string; value: number; expectedClose: string; ownerId: string | null; contactId: string | null }>) =>
    api.patch(`/deals/${id}`, input).then((r) => r.data.data as Deal),
  move: (id: string, stageId: string, position?: number) =>
    api.patch(`/deals/${id}/stage`, { stageId, position }).then((r) => r.data.data as Deal),
  markWon: (id: string) => api.patch(`/deals/${id}/won`).then((r) => r.data.data as Deal),
  markLost: (id: string, lostReason?: string) =>
    api.patch(`/deals/${id}/lost`, { lostReason }).then((r) => r.data.data as Deal),
  markOpen: (id: string) => api.patch(`/deals/${id}/open`).then((r) => r.data.data as Deal),
  reorder: (stageId: string, dealIds: string[]) =>
    api.post('/deals/reorder', { stageId, dealIds }),
  delete: (id: string) => api.delete(`/deals/${id}`),
};
