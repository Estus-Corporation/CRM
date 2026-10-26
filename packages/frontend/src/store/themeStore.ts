import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore } from './authStore';

export type Theme = 'dark' | 'light';

interface ThemeState {
  /** Tema escolhido por usuário (id). Quem nunca escolheu fica no escuro. */
  themes: Record<string, Theme>;
  setTheme: (userId: string, theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themes: {},
      setTheme: (userId, theme) => set((s) => ({ themes: { ...s.themes, [userId]: theme } })),
    }),
    { name: 'titanflow-theme', version: 1, migrate: () => ({ themes: {} }) as unknown as ThemeState },
  ),
);

/** Tema do usuário logado — escuro por padrão */
export function useTheme(): Theme {
  const userId = useAuthStore((s) => s.user?.id);
  return useThemeStore((s) => (userId && s.themes[userId]) || 'dark');
}

/**
 * Aplica o tema no <html>. Com `animate`, liga por um instante a classe `theme-transition`
 * pra todas as cores atravessarem juntas em vez de trocarem de uma vez.
 */
export function applyTheme(theme: Theme, animate = false) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add('theme-transition');
    window.setTimeout(() => root.classList.remove('theme-transition'), 500);
  }
  if (theme === 'light') root.dataset.theme = 'light';
  else delete root.dataset.theme;
}
