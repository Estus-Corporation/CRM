import { api } from './api';

export interface KpiData {
  /** Últimos 6 meses, o atual por último */
  trends?: { wonMtd: number[]; openDeals: number[]; conversionRate: number[]; avgCycleDays: number[] };
  openDeals: number;
  wonMtd: number;
  wonMtdValue: number;
  conversionRate: number;
  avgCycleDays: number;
}

export interface FunnelStage {
  stage_id: string;
  name: string;
  color: string;
  position: number;
  deal_count: number;
  total_value: number;
}

export interface RevenuePoint {
  period: string;
  totalValue: number;
  dealCount: number;
}

export interface ActivitiesReport {
  byType: { type: string; total: number; done: number }[];
  byUser: { userId: string; name: string; total: number; done: number }[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  dealsWon: number;
  totalValue: number;
}

export const reportsService = {
  async getKpis(): Promise<KpiData> {
    const { data } = await api.get<{ data: KpiData }>('/reports/kpis');
    return data.data;
  },

  async getFunnel(pipelineId?: string): Promise<FunnelStage[]> {
    const { data } = await api.get<{ data: FunnelStage[] }>('/reports/funnel', {
      params: pipelineId ? { pipeline: pipelineId } : undefined,
    });
    return data.data;
  },

  async getRevenue(period: 'week' | 'month' = 'month'): Promise<RevenuePoint[]> {
    const { data } = await api.get<{ data: RevenuePoint[] }>('/reports/revenue', {
      params: { period },
    });
    return data.data;
  },

  async getActivities(filters?: { userId?: string; from?: string; to?: string }): Promise<ActivitiesReport> {
    const { data } = await api.get<{ data: ActivitiesReport }>('/reports/activities', { params: filters });
    return data.data;
  },

  async getLeaderboard(filters?: { pipelineId?: string; from?: string; to?: string }): Promise<LeaderboardEntry[]> {
    const { data } = await api.get<{ data: LeaderboardEntry[] }>('/reports/leaderboard', { params: filters });
    return data.data;
  },
};
