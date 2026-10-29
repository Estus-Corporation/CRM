import { useCallback } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface StickyState {
  values: Record<string, unknown>;
  set: (key: string, value: unknown) => void;
}

// Filtros das telas guardados na sessão: sair pra outra tela (ou abrir um lead) e voltar não reseta
const useStickyStore = create<StickyState>()(
  persist(
    (set) => ({
      values: {},
      set: (key, value) => set((s) => ({ values: { ...s.values, [key]: value } })),
    }),
    { name: 'titanflow-filters', storage: createJSONStorage(() => sessionStorage) },
  ),
);

/** useState que sobrevive à troca de tela (guardado por chave na sessão do navegador) */
export function useStickyState<T>(key: string, initial: T): [T, (value: T) => void] {
  const stored = useStickyStore((s) => s.values[key]) as T | undefined;
  const setValue = useStickyStore((s) => s.set);
  const update = useCallback((value: T) => setValue(key, value), [key, setValue]);
  return [stored === undefined ? initial : stored, update];
}
