import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  /** Painel de notas aberto à direita da pasta */
  notesOpen: boolean;
  toggleNotes: () => void;
  setNotesOpen: (v: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      notesOpen: false,
      toggleNotes: () => set((s) => ({ notesOpen: !s.notesOpen })),
      setNotesOpen: (v) => set({ notesOpen: v }),
    }),
    { name: 'titanflow-ui' },
  ),
);
