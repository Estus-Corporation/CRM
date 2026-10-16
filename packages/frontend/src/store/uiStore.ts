import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  /** Pasta (área da direita) translúcida, deixando o shader de fundo aparecer */
  folderGlass: boolean;
  toggleFolderGlass: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      folderGlass: false,
      toggleFolderGlass: () => set((s) => ({ folderGlass: !s.folderGlass })),
    }),
    { name: 'titanflow-ui' },
  ),
);
