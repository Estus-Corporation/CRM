import { api } from './api';
import type { User, UserRole } from '@/store/authStore';

export interface RegisterInput {
  workspaceName?: string;
  slug?: string;
  fullName: string;
  email: string;
  password: string;
}

export interface CreateWorkspaceInput {
  name: string;
  email?: string;
  keyPeople?: { name: string; title: string; email?: string }[];
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: UserRole;
  logo_url: string | null;
}

/** Perfil pessoal (Minha conta). avatar: data URL recortada, ou null pra remover */
export interface UpdateMeInput {
  fullName?: string;
  jobTitle?: string | null;
  phone?: string | null;
  bio?: string | null;
  avatar?: string | null;
  password?: string;
  currentPassword?: string;
}

/** Sessão num workspace: tokens + usuário já com tenant_id/role daquele workspace */
export interface WorkspaceSession {
  accessToken: string;
  refreshToken: string;
  user: User;
  tenantId: string;
  tenantName: string;
  role: UserRole;
}

export const authService = {
  register: (input: RegisterInput) => api.post('/auth/register', input).then((r) => r.data.data),
  login: (input: LoginInput) => api.post('/auth/login', input).then((r) => r.data.data),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }).then((r) => r.data.data),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  getMe: (): Promise<User> => api.get('/auth/me').then((r) => r.data.data),
  updateMe: (input: UpdateMeInput): Promise<User> => api.patch('/auth/me', input).then((r) => r.data.data),
  listWorkspaces: (): Promise<Workspace[]> =>
    api.get('/auth/workspaces').then((r) => r.data.data),
  switchWorkspace: (tenantId: string): Promise<WorkspaceSession> =>
    api.post('/auth/switch-workspace', { tenantId }).then((r) => r.data.data),
  /** Cria um workspace próprio (a pessoa vira admin) e já entra nele */
  createWorkspace: (input: CreateWorkspaceInput): Promise<WorkspaceSession> =>
    api.post('/auth/workspaces', input).then((r) => r.data.data),
  leaveWorkspace: (tenantId: string) => api.delete(`/auth/workspaces/${tenantId}/membership`),
};
