import { useLayoutEffect, useState } from 'react';
import { Navigate, useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { pageMotion } from '@/lib/motion';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileTabBar } from './MobileTabBar';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';
import { NotesPanel } from '@/components/notes/NotesPanel';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SilkShader } from '@/components/ui/SilkShader';
import { useTenant } from '@/hooks/useTenant';
import { useLeadHunterEnabled } from '@/hooks/useLeadHunter';
import { applyTheme, useTheme } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';

const CAPTADOR_PATHS = ['/meu-painel', '/conta', '/empresa', '/meus-leads', '/meus-leads/reunioes','/minhas-comissoes'];

/** Para onde cada papel pode ir; fora disso redireciona (o backend também bloqueia) */
function roleRedirect(role: string | undefined, pathname: string, leadhunterEnabled: boolean) {
  // Captador cai no painel dele (o "dashboard" de quem liga)
  if (role === 'captador') {
    return CAPTADOR_PATHS.includes(pathname) || pathname.startsWith('/meus-leads/lead/') ? null : '/meu-painel';
  }
  if (pathname.startsWith('/captacao') && role !== 'admin' && role !== 'manager') return '/dashboard';
  if (pathname.startsWith('/solicitacoes') && (role !== 'admin' || !leadhunterEnabled)) return '/dashboard';
  // LeadHunter: só admin e só com a flag do workspace ligada
  if (pathname.startsWith('/leadhunter') && (role !== 'admin' || !leadhunterEnabled)) return '/dashboard';
  return null;
}

export function AppShell() {
  const role = useAuthStore((s) => s.user?.role);
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const { isPending: tenantPending } = useTenant();
  const leadhunterEnabled = useLeadHunterEnabled();
  // A flag só é conhecida depois do GET /tenant: nas telas que dependem dela, espera em vez de decidir às cegas
  const waitingFlag = tenantPending && (pathname.startsWith('/leadhunter') || pathname.startsWith('/solicitacoes'));
  const redirectTo = waitingFlag ? null : roleRedirect(role, pathname, leadhunterEnabled);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const theme = useTheme();

  // Tema vale só dentro do app: landing e telas de login seguem sempre escuras
  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);
  useLayoutEffect(() => () => applyTheme('dark'), []);


  return (
    <div className="relative flex h-screen overflow-hidden bg-[#03120E] md:py-3">
      {/* Fundo único do app: shader "Silk" com blur leve + película escura.
          Passa contínuo por trás do menu, da aba e do espaço vazio do cabeçalho. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <SilkShader resolution={0.5} className="absolute inset-[-16px] h-[calc(100%+32px)] w-[calc(100%+32px)] blur-[6px]" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#03120E]/55 via-[#03120E]/36 to-[#03120E]/46" />
      </div>
      {/* Faixa de vidro da base: só sob o rodapé do menu (fica dentro do DesktopSidebar) */}
      <Sidebar mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />

      {/* Área da direita: header de ponta a ponta no topo; embaixo a pasta (e as notas, quando abertas) */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden md:ml-3">
        <Topbar onOpenMenu={() => setMobileSidebarOpen(true)} />

        <div className="flex min-h-0 flex-1 pr-3 pt-3 max-md:pl-3">
          <div
            // Computador: solta da base da tela, com os quatro cantos arredondados
            className="folder-surface relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-t-[22px] md:rounded-b-[22px]"
            style={{ boxShadow: '0 24px 48px -24px rgba(0, 0, 0, 0.55)' }}
          >
            {/* pb no celular: espaço para a barra de navegação inferior */}
            <main className="h-full overflow-y-auto overflow-x-hidden p-4 max-md:pb-28 md:p-6">
              <ErrorBoundary>
                {redirectTo ? (
                  <Navigate to={redirectTo} replace />
                ) : waitingFlag ? null : (
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

          {/* Notas: abrem à direita da pasta, abaixo do header (botão ao lado da foto) */}
          <NotesPanel />
        </div>
      </div>

      <MobileTabBar />

      <ChangePasswordModal />
      <UpgradeModal />
    </div>
  );
}
