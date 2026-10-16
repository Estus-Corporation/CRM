import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
    }),
    { name: 'titanflow-theme' },
  ),
);

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
