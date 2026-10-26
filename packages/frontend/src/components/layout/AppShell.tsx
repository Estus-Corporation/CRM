import { useLayoutEffect, useState } from 'react';
import { Navigate, useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { pageMotion } from '@/lib/motion';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileTabBar } from './MobileTabBar';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';
import { NotesPanel } from '@/components/notes/NotesPanel';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SilkShader } from '@/components/ui/SilkShader';
import { useTenant } from '@/hooks/useTenant';
import { applyTheme, useThemeStore } from '@/store/themeStore';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

const CAPTADOR_PATHS = ['/meu-painel', '/conta', '/empresa', '/meus-leads', '/meus-leads/reunioes','/minhas-comissoes'];

/** Para onde cada papel pode ir; fora disso redireciona (o backend também bloqueia) */
function roleRedirect(role: string | undefined, pathname: string) {
  // Captador cai no painel dele (o "dashboard" de quem liga)
  if (role === 'captador') return CAPTADOR_PATHS.includes(pathname) ? null : '/meu-painel';
  if (pathname.startsWith('/captacao') && role !== 'admin' && role !== 'manager') return '/dashboard';
  return null;
}

export function AppShell() {
  const role = useAuthStore((s) => s.user?.role);
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const redirectTo = roleRedirect(role, pathname);
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
      {/* Faixa de vidro da base: só sob o rodapé do menu (fica dentro do DesktopSidebar) */}
      <Sidebar mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />

      {/* Área da direita como uma pasta: aba (cabeçalho) + corpo que desce até a base da tela */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden pr-3 pt-2 max-md:pl-3">
        {/* Mobile hamburger prepended inside the topbar area */}
        <div className="md:hidden absolute left-5 top-2 z-50 flex h-[52px] items-center">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Abrir menu"
            className="flex h-10 w-10 items-center justify-center rounded-[10px] text-white transition-colors duration-200 hover:bg-fg/[0.05]"
          >
            <Menu size={19} strokeWidth={1.75} />
          </button>
        </div>

        <Topbar />
        <div
          // Cantos de baixo retos: encosta no limite inferior da tela.
          // Sem aba (captador não tem busca no topo): canto superior esquerdo arredondado também
          className={cn(
            'folder-surface relative min-h-0 flex-1 overflow-hidden rounded-t-[22px]',
            // Celular não tem a aba (busca vira botão): canto arredondado sempre
            role !== 'captador' && 'md:rounded-tl-none',
          )}
          style={{ boxShadow: '0 24px 48px -24px rgba(0, 0, 0, 0.55)' }}
        >
          {/* pb no celular: espaço para a barra de navegação inferior */}
          <main className="h-full overflow-y-auto overflow-x-hidden p-4 max-md:pb-28 md:p-6">
            <ErrorBoundary>
              {redirectTo ? (
                <Navigate to={redirectTo} replace />
              ) : (
                // Troca de tela animada; useOutlet congela a tela antiga enquanto ela sai
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={pathname} {...pageMotion} className="flex min-h-full flex-col">
                    {outlet}
                  </motion.div>
                </AnimatePresence>
              )}
            </ErrorBoundary>
          </main>
        </div>
      </div>

      <MobileTabBar />

      {/* Notas: abre à direita e a pasta encolhe (botão no topo do menu lateral) */}
      <NotesPanel />

      <ChangePasswordModal />
      <UpgradeModal />
    </div>
  );
}
