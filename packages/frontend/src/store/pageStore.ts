import { useEffect } from 'react';
import { create } from 'zustand';

/** Descrição da tela atual: aparece no topo, ao lado de "espaço › tela" (não embaixo do título) */
interface PageState {
  subtitle: string | null;
  setSubtitle: (v: string | null) => void;
}

export const usePageStore = create<PageState>()((set) => ({
  subtitle: null,
  setSubtitle: (subtitle) => set({ subtitle }),
}));

/** A página informa a própria descrição; some ao sair da tela */
export function usePageSubtitle(subtitle?: string | null) {
  const setSubtitle = usePageStore((s) => s.setSubtitle);
  useEffect(() => {
    setSubtitle(subtitle || null);
    return () => setSubtitle(null);
  }, [subtitle, setSubtitle]);
}
