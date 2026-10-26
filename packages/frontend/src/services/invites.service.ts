import { api } from './api';
import type { UserRole } from '@/store/authStore';

/** Convite recebido pela pessoa logada */
export interface WorkspaceInvite {
  id: string;
  role: UserRole;
  created_at: string;
  tenant_id: string;
  tenant_name: string;
  tenant_logo_url: string | null;
  invited_by_name: string | null;
}

/** Convite enviado pelo workspace e ainda sem resposta */
export interface PendingInvite {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  /** Preenchidos quando o e-mail já tem conta */
  full_name: string | null;
  avatar_url: string | null;
}

export const invitesService = {
  mine: (): Promise<WorkspaceInvite[]> => api.get('/invites').then((r) => r.data.data),
  accept: (id: string): Promise<{ tenantId: string; tenantName: string; role: UserRole }> =>
    api.post(`/invites/${id}/accept`).then((r) => r.data.data),
  decline: (id: string) => api.post(`/invites/${id}/decline`),
  listTenant: (): Promise<PendingInvite[]> => api.get('/users/invites').then((r) => r.data.data),
  cancel: (id: string) => api.delete(`/users/invites/${id}`),
};
