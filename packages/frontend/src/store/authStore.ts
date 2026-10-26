import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// captador: só acessa os próprios leads (ver AppShell e requireAuth no backend)
export type UserRole = 'admin' | 'manager' | 'seller' | 'captador';

/**
 * A conta é da pessoa; tenant_id/role são do workspace em que ela está agora
 * (mudam ao trocar de workspace — o papel vem do vínculo com aquele workspace).
 */
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  tenant_id: string;
  must_change_password?: boolean;
  avatar_url?: string | null;
  job_title?: string | null;
  phone?: string | null;
  bio?: string | null;
  password_hash?: never;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  /** Atualiza só os campos do perfil/sessão informados (ex.: depois de editar Minha conta) */
  patchUser: (partial: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist<AuthState>(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user: User, accessToken: string, refreshToken: string) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),
      setTokens: (accessToken: string, refreshToken: string) =>
        set({ accessToken, refreshToken }),
      patchUser: (partial: Partial<User>) =>
        set((s) => (s.user ? { user: { ...s.user, ...partial } } : {})),
      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
    }),
    {
      name: 'titan-auth',
      partialize: (state: AuthState) =>
        ({
          user: state.user,
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
          isAuthenticated: state.isAuthenticated,
        }) as AuthState,
    },
  ),
);
