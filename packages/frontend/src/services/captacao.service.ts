import { api } from './api';

export type CallStatus = 'pending' | 'no_answer' | 'callback' | 'meeting' | 'lost';
/** Plano B (WhatsApp): situação da mensagem */
export type WhatsappStatus = 'waiting' | 'replied' | 'no_reply';
/** Pessoa de contato conseguida na ligação (ex.: o dono, passado pelo atendente) */
export interface LeadPerson {
  name: string;
  title?: string;
  phone?: string;
  email?: string;
}
export type Outcome = 'won' | 'lost' | null;
/** won: só os que fecharam negócio (Minhas comissões) */
export type MyLeadsScope = 'today' | 'open' | 'all' | 'won';

/** Lead como o captador enxerga: dados de contato + resultado da ligação, sem valor do negócio */
export interface MyLead {
  id: string;
  call_status: CallStatus;
  call_notes: string | null;
  call_updated_at: string | null;
  assigned_for: string;
  outcome: Outcome;
  closed_at: string | null;
  /** Captador clicou em "Concluir lead" (null = ainda a fazer / reaberto pelo Editar) */
  concluded_at: string | null;
  commission_value: number | null;
  commission_paid_at: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  company_name: string | null;
  job_title: string | null;
  niche: string | null;
  // Dados de prospecção (LeadHunter / planilha)
  address: string | null;
  maps_url: string | null;
  instagram: string | null;
  website: string | null;
  google_rating: number | null;
  google_reviews: number | null;
  /** Contexto da empresa escrito por quem cadastrou/importou */
  lead_context: string | null;
  meeting_at: string | null;
  meeting_mode: MeetingMode | null;
  meeting_location: string | null;
  /** Detalhes da reunião (vão pro evento do calendário dos admins) */
  meeting_duration: number | null;
  meeting_attendee_ids: string[];
  meeting_guests: MeetingGuest[];
  /** Plano B: última vez que abriu o WhatsApp do lead e quantas vezes */
  whatsapp_at: string | null;
  whatsapp_count: number;
  whatsapp_status: WhatsappStatus | null;
  lead_people: LeadPerson[];
}

export interface MeetingGuest {
  name: string;
  title?: string;
}

export type MeetingMode = 'online' | 'presencial';

export interface UpdateMyLeadInput {
  callStatus?: CallStatus;
  callNotes?: string | null;
  concluded?: boolean;
  meetingAt?: string | null;
  meetingMode?: MeetingMode | null;
  meetingLocation?: string | null;
  meetingDuration?: number | null;
  meetingAttendeeIds?: string[];
  meetingGuests?: MeetingGuest[];
  whatsappStatus?: WhatsappStatus | null;
  leadPeople?: LeadPerson[];
}

export interface MySummary {
  today_total: number;
  today_pending: number;
  today_concluded: number;
  open_pending: number;
  meetings: number;
  won: number;
  commission_pending: number;
  commission_paid: number;
}

export interface CaptadorPeriodTotals {
  received: number;
  called: number;
  meetings: number;
  won: number;
  commission: number;
}

export interface CaptadorStats {
  days: number;
  current: CaptadorPeriodTotals;
  previous: CaptadorPeriodTotals;
  daily: { day: string; received: number; called: number; meetings: number }[];
  funnel: { stage: string; value: number }[];
  byStatus: Record<CallStatus, number>;
}

export interface Captador {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  is_active: boolean;
  last_login_at: string | null;
  total: number;
  today: number;
  pending: number;
  no_answer: number;
  callback: number;
  meetings: number;
  lost: number;
  won: number;
  won_value: number;
  commission_pending: number;
  commission_paid: number;
}

export interface AvailableContact {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  company_name: string | null;
  niche: string | null;
  created_at: string;
  google_rating: number | null;
  google_reviews: number | null;
}

/** Ficha de um lead vista pelo admin/gerente (página aberta pela aba Distribuir) */
export interface ManagerLead {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  company_name: string | null;
  job_title: string | null;
  niche: string | null;
  created_at: string;
  address: string | null;
  maps_url: string | null;
  instagram: string | null;
  website: string | null;
  google_rating: number | null;
  google_reviews: number | null;
  lead_context: string | null;
  lead_people: LeadPerson[];
  /** Já atribuído: id da atribuição e nome do captador */
  assignment_id: string | null;
  captador_name: string | null;
}

export interface Assignment {
  id: string;
  contact_id: string;
  captador_id: string | null;
  captador_name: string | null;
  assigned_for: string;
  call_status: CallStatus;
  call_notes: string | null;
  call_updated_at: string | null;
  outcome: Outcome;
  closed_at: string | null;
  deal_value: number | null;
  commission_rate: number | null;
  commission_value: number | null;
  commission_paid_at: string | null;
  /** Plano B: o captador abriu o WhatsApp do lead */
  whatsapp_at: string | null;
  whatsapp_count: number;
  whatsapp_status: WhatsappStatus | null;
  full_name: string;
  phone: string | null;
  company_name: string | null;
  niche: string | null;
}

interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

/** Engrenagem da Captação: comissão (%) e cota diária da distribuição automática (0 = desligada) */
export interface CaptacaoSettings {
  commissionRate: number;
  leadsPerDay: number;
}

export interface NewLeadInput {
  fullName: string;
  phone?: string;
  email?: string;
  companyName?: string;
  jobTitle?: string;
  niche?: string;
  address?: string;
  mapsUrl?: string;
  instagram?: string;
  website?: string;
  leadContext?: string;
  captadorId?: string;
}

export interface AssignmentFilters {
  captadorId?: string;
  status?: CallStatus;
  outcome?: 'open' | 'won' | 'lost';
  search?: string;
  page?: number;
  limit?: number;
}

export interface AdminBusySlot {
  start: string;
  end: string;
  kind: 'event' | 'lead_meeting';
  /** Primeiro nome dos admins envolvidos (vazio em reunião de captação) */
  admins: string[];
}

export const captacaoService = {
  // ── Captador ──
  async myLeads(params: { scope: MyLeadsScope; status?: CallStatus }): Promise<MyLead[]> {
    const { data } = await api.get<{ data: MyLead[] }>('/captacao/me/leads', { params });
    return data.data;
  },

  /** Horários ocupados dos admins (hoje + 14 dias), sem detalhes dos compromissos */
  async adminBusy(from: Date, to: Date): Promise<AdminBusySlot[]> {
    const { data } = await api.get<{ data: AdminBusySlot[] }>('/captacao/me/admin-busy', {
      params: { from: from.toISOString(), to: to.toISOString() },
    });
    return data.data;
  },

  async myLead(id: string): Promise<MyLead> {
    const { data } = await api.get<{ data: MyLead }>(`/captacao/me/leads/${id}`);
    return data.data;
  },

  /** Registra que o captador abriu o WhatsApp do lead (plano B) */
  async recordWhatsapp(id: string): Promise<MyLead> {
    const { data } = await api.post<{ data: MyLead }>(`/captacao/me/leads/${id}/whatsapp`);
    return data.data;
  },

  async updateMyLead(id: string, input: UpdateMyLeadInput): Promise<MyLead> {
    const { data } = await api.patch<{ data: MyLead }>(`/captacao/me/leads/${id}`, input);
    return data.data;
  },

  /** Painel do captador: últimos 7 (week) ou 30 (month) dias, com comparação ao período anterior */
  async myStats(period: 'week' | 'month'): Promise<CaptadorStats> {
    const { data } = await api.get<{ data: CaptadorStats }>('/captacao/me/stats', { params: { period } });
    return data.data;
  },

  async mySummary(): Promise<MySummary> {
    const { data } = await api.get<{ data: MySummary }>('/captacao/me/summary');
    return data.data;
  },

  // ── Admin / gerente ──
  async captadores(): Promise<Captador[]> {
    const { data } = await api.get<{ data: Captador[] }>('/captacao/captadores');
    return data.data;
  },

  async managerLead(id: string): Promise<ManagerLead> {
    const { data } = await api.get<{ data: ManagerLead }>(`/captacao/leads/${id}`);
    return data.data;
  },

  async availableContacts(params: { search?: string; niche?: string; page?: number; limit?: number }) {
    const { data } = await api.get<Paginated<AvailableContact>>('/captacao/available-contacts', { params });
    return data;
  },

  /** Lead digitado à mão; com captadorId já sai atribuído. 409 duplicate_lead se já existir */
  async createLead(input: NewLeadInput): Promise<{ id: string; full_name: string; assigned: boolean }> {
    const { data } = await api.post('/captacao/leads', input);
    return data.data;
  },

  /** Lead cadastrado pelo próprio captador — já entra nos leads dele. 409 duplicate_lead se já existir */
  async createMyLead(input: Omit<NewLeadInput, 'captadorId'>): Promise<{ id: string; full_name: string; assigned: boolean }> {
    const { data } = await api.post('/captacao/me/leads', input);
    return data.data;
  },

  async assign(captadorId: string, contactIds: string[]): Promise<{ assigned: number; skipped: number }> {
    const { data } = await api.post('/captacao/assignments', { captadorId, contactIds });
    return data.data;
  },

  async assignments(params: AssignmentFilters) {
    const { data } = await api.get<Paginated<Assignment>>('/captacao/assignments', { params });
    return data;
  },

  async close(id: string, input: { outcome: 'won'; dealValue: number } | { outcome: 'lost' } | { outcome: null }) {
    const { data } = await api.patch(`/captacao/assignments/${id}/close`, input);
    return data.data;
  },

  async setPaid(id: string, paid: boolean) {
    const { data } = await api.patch(`/captacao/assignments/${id}/payment`, { paid });
    return data.data;
  },

  async payAll(captadorId: string): Promise<{ paid: number }> {
    const { data } = await api.post(`/captacao/captadores/${captadorId}/pay-all`);
    return data.data;
  },

  async unassign(id: string): Promise<void> {
    await api.delete(`/captacao/assignments/${id}`);
  },

  async settings(): Promise<CaptacaoSettings> {
    const { data } = await api.get('/captacao/settings');
    return data.data;
  },

  async updateSettings(input: Partial<CaptacaoSettings>): Promise<CaptacaoSettings> {
    const { data } = await api.patch('/captacao/settings', input);
    return data.data;
  },
};
