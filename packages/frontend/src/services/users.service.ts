import { api } from './api';
import type { UserRole } from '@/store/authStore';

/** Membro da equipe = conta da pessoa + vínculo (papel, ativo) com este workspace */
export interface TeamMember {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  job_title: string | null;
  role: UserRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

/** Convida pelo e-mail: a pessoa aceita ou recusa na caixa de entrada dela */
export interface InviteUserInput {
  email: string;
  role: UserRole;
}

/** Convite criado (has_account: o e-mail já tem conta no TitanFlow) */
export interface SentInvite {
  id: string;
  email: string;
  role: UserRole;
  has_account: boolean;
  full_name: string | null;
  avatar_url: string | null;
}

export interface UpdateUserInput {
  role?: UserRole;
  isActive?: boolean;
}

export const usersService = {
  async list(page = 1, limit = 100): Promise<{ data: TeamMember[]; meta: { total: number } }> {
    const { data } = await api.get('/users', { params: { page, limit } });
    return data;
  },

  async invite(input: InviteUserInput): Promise<SentInvite> {
    const { data } = await api.post<{ data: SentInvite }>('/users/invite', input);
    return data.data;
  },

  async update(id: string, input: UpdateUserInput): Promise<TeamMember> {
    const { data } = await api.patch<{ data: TeamMember }>(`/users/${id}`, input);
    return data.data;
  },

  /** Tira a pessoa do workspace — a conta dela continua existindo */
  async delete(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  },
};
