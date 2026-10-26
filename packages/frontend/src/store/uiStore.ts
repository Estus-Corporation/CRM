import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  /** Pasta (área da direita) translúcida, deixando o shader de fundo aparecer */
  folderGlass: boolean;
  toggleFolderGlass: () => void;
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
      folderGlass: false,
      toggleFolderGlass: () => set((s) => ({ folderGlass: !s.folderGlass })),
      notesOpen: false,
      toggleNotes: () => set((s) => ({ notesOpen: !s.notesOpen })),
      setNotesOpen: (v) => set({ notesOpen: v }),
    }),
    { name: 'titanflow-ui' },
  ),
);
