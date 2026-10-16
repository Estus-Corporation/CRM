import { useLayoutEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SilkShader } from '@/components/ui/SilkShader';
import { SIDEBAR_FOOTER_HEIGHT } from '@/components/ui/AnimatedSidebar';
import { useTenant } from '@/hooks/useTenant';
import { applyTheme, useThemeStore } from '@/store/themeStore';
import { useUIStore } from '@/store/uiStore';

export function AppShell() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  useTenant();
  const theme = useThemeStore((s) => s.theme);

  // Tema vale só dentro do app: landing e telas de login seguem sempre escuras
  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);
  useLayoutEffect(() => () => applyTheme('dark'), []);

  // Pasta translúcida: classe no <html> troca --folder-alpha (ver .folder-surface em globals.css)
  const folderGlass = useUIStore((s) => s.folderGlass);
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('folder-glass', folderGlass);
    return () => document.documentElement.classList.remove('folder-glass');
  }, [folderGlass]);

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#03120E]">
      {/* Fundo único do app: shader "Silk" com blur leve + película escura.
          Passa contínuo por trás do menu, da aba e do espaço vazio do cabeçalho. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <SilkShader resolution={0.5} className="absolute inset-[-16px] h-[calc(100%+32px)] w-[calc(100%+32px)] blur-[6px]" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#03120E]/55 via-[#03120E]/36 to-[#03120E]/46" />
      </div>
      {/* Faixa de vidro na base: começa no rodapé do menu e atravessa até a borda direita,
          passando por trás da base da pasta */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] hidden border-t border-white/[0.08] bg-[#03120E]/55 backdrop-blur-md md:block"
        style={{ height: SIDEBAR_FOOTER_HEIGHT }}
      />
      <Sidebar mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />

      {/* Área da direita como uma pasta: aba (cabeçalho) + corpo arredondado */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden pb-3 pr-3 pt-2 max-md:pl-3">
        {/* Mobile hamburger prepended inside the topbar area */}
        <div className="md:hidden absolute left-5 top-2 z-50 flex h-[52px] items-center">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-1.5 rounded text-text-muted hover:text-text-primary"
          >
            <Menu size={18} />
          </button>
        </div>

        <Topbar />
        <div
          className="folder-surface relative min-h-0 flex-1 overflow-hidden rounded-[22px] rounded-tl-none"
          style={{ boxShadow: '0 24px 48px -24px rgba(0, 0, 0, 0.55)' }}
        >
          <main className="h-full overflow-y-auto p-4 md:p-6">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>

      <ChangePasswordModal />
      <UpgradeModal />
    </div>
  );
}
