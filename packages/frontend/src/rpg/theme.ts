import { useLayoutEffect } from 'react';
import { applyTheme } from '@/store/themeStore';

/** Silk em azul-marinho: quase preto → marinho → cobalto → azul-gelo (RGB 0–1) */
export const SILK_NAVY = new Float32Array([
  0.012, 0.02, 0.045,
  0.05, 0.1, 0.25,
  0.16, 0.29, 0.66,
  0.78, 0.85, 1.0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]);

/** Liga a identidade "Núcleo" (html.rpg-theme, sempre escuro) enquanto a tela estiver montada */
export function useRpgTheme() {
  useLayoutEffect(() => {
    applyTheme('dark');
    document.documentElement.classList.add('rpg-theme');
    return () => document.documentElement.classList.remove('rpg-theme');
  }, []);
}
