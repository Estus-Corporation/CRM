import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Inbox, LogOut, Menu, NotebookPen, UserCog } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { authService } from '@/services/auth.service';
import { useNotifications } from '@/hooks/useNotifications';
import { useTenant } from '@/hooks/useTenant';
import { Avatar } from '@/components/ui/Avatar';
import { useLocation, useNavigate } from 'react-router-dom';
import { NotificationPanel } from '@/components/notifications/NotificationPanel';
import { ThemeToggle } from './ThemeToggle';
import { OnlineMembers } from './OnlineMembers';
import { cn, shortName } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { dropdownMotion } from '@/lib/motion';

const iconButton =
  'relative flex h-10 w-10 items-center justify-center rounded-[10px] text-text-secondary transition-colors duration-200 hover:bg-fg/[0.06] hover:text-text-primary';

/** Nome da tela atual no header (o mais específico primeiro) */
const PAGE_TITLES: [string, string][] = [
  ['/meus-leads/reunioes', 'Reuniões'],
  ['/meus-leads', 'Meus leads'],
  ['/meu-painel', 'Painel'],
  ['/minhas-comissoes', 'Minhas comissões'],
  ['/dashboard', 'Dashboard'],
  ['/pipeline', 'Pipeline'],
  ['/deals', 'Negócios'],
  ['/contacts', 'Contatos'],
  ['/calendar', 'Calendário'],
  ['/reports', 'Relatórios'],
  ['/captacao', 'Captação'],
  ['/leadhunter/locais', 'Locais pesquisados'],
  ['/leadhunter/integracoes', 'Integrações'],
  ['/leadhunter', 'LeadHunter'],
  ['/settings', 'Configurações'],
  ['/conta', 'Minha conta'],
  ['/empresa', 'Sobre a empresa'],
];

function pageTitle(pathname: string) {
  return PAGE_TITLES.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] ?? '';
}

/**
 * Header do app: barra translúcida colada no topo (espaço › tela atual à esquerda;
 * notas/caixa de entrada e a foto com o menu da conta à direita).
 */
export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { user, refreshToken, logout } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: tenant } = useTenant();
  const { unreadCount } = useNotifications();
  const [inboxOpen, setInboxOpen] = useState(false);
  const inboxRef = useRef<HTMLButtonElement>(null);
  const closeInbox = useCallback(() => setInboxOpen(false), []);
  // A foto abre o menu da conta (Minha conta, Tema, Sair) no celular e no computador
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notesOpen = useUIStore((s) => s.notesOpen);
  const toggleNotes = useUIStore((s) => s.toggleNotes);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    if (refreshToken) {
      try {
        await authService.logout(refreshToken);
      } catch {
        // token already expired — proceed with local logout
      }
    }
    logout();
    navigate('/login');
  };

  const title = pageTitle(pathname);

  return (
    <>
      {/* Celular: colado no topo e nas laterais. Computador: solto do topo e da direita
          (alinhado com a pasta) e as pontas arredondadas */}
      <header className="relative z-30 flex h-16 flex-shrink-0 items-center gap-2 border-b border-fg/[0.06] bg-bg-primary/[0.55] pl-2 pr-3 backdrop-blur-xl md:mr-3 md:rounded-[18px] md:border md:pl-5 md:pr-4">
        {/* Celular: hambúrguer abre o menu lateral */}
        <button type="button" onClick={onOpenMenu} aria-label="Abrir menu" className={cn(iconButton, 'h-11 w-11 text-text-primary md:hidden')}>
          <Menu size={23} strokeWidth={1.75} />
        </button>

        {/* Onde a pessoa está: espaço › tela */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
          {tenant?.name && (
            <>
              <span className="truncate text-text-muted max-md:hidden">{tenant.name}</span>
              {title && <ChevronRight size={14} className="flex-shrink-0 text-text-muted max-md:hidden" />}
            </>
          )}
          {title && <span className="truncate font-semibold text-text-primary">{title}</span>}
        </div>

        {user && (
          <div className="flex flex-shrink-0 items-center gap-1.5">
            {/* Computador: notas ao lado da foto (no celular ficam no menu lateral) */}
            <button
              type="button"
              onClick={toggleNotes}
              aria-label="Notas"
              aria-pressed={notesOpen}
              title={notesOpen ? 'Fechar notas' : 'Notas'}
              className={cn(iconButton, 'max-md:hidden', notesOpen && 'bg-fg/[0.12] text-text-primary')}
            >
              <NotebookPen size={19} strokeWidth={1.75} />
            </button>
            {/* Caixa de entrada à esquerda da foto */}
            <button
              ref={inboxRef}
              type="button"
              onClick={() => setInboxOpen((v) => !v)}
              aria-label="Caixa de entrada"
              className={cn(iconButton, 'max-md:h-11 max-md:w-11', inboxOpen && 'bg-fg/[0.06] text-text-primary')}
            >
              <Inbox size={22} strokeWidth={1.75} className="max-md:h-6 max-md:w-6" />
              {unreadCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-accent-green px-1 text-[10px] font-bold text-bg-darker ring-2 ring-bg-primary">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Quem do espaço está online agora */}
            <OnlineMembers />

            {/* Separador entre os ícones e a foto */}
            <span aria-hidden className="mx-1.5 h-7 w-px bg-fg/[0.12]" />

            <div ref={menuRef} className="relative">
              {/* Foto (anel esmeralda → âmbar) + nome à direita; os dois abrem o menu da conta */}
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="group flex items-center gap-2.5 rounded-full outline-none md:pr-2"
                title={`${user.full_name} — Minha conta`}
                aria-label="Minha conta"
                aria-expanded={menuOpen}
              >
                <span
                  className="block rounded-full p-[1.5px] transition-[filter] duration-200 group-hover:brightness-110"
                  style={{
                    background:
                      'conic-gradient(from 200deg, rgb(var(--accent-green)), rgb(var(--accent-green)) 55%, rgb(var(--accent-amber)) 80%, rgb(var(--accent-green)))',
                  }}
                >
                  <Avatar name={user.full_name} src={user.avatar_url} online className="h-10 w-10 bg-bg-surface text-sm ring-2 ring-bg-primary" />
                </span>
                <span className="max-w-[180px] truncate text-sm font-medium text-text-primary max-md:hidden">{shortName(user.full_name)}</span>
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    {...dropdownMotion}
                    style={{ transformOrigin: 'top right' }}
                    className="glass-panel absolute right-0 top-full z-50 mt-2 w-60 rounded-xl p-1.5 shadow-2xl"
                  >
                    <div className="border-b border-fg/[0.06] px-2.5 pb-2.5 pt-1.5">
                      <p className="truncate text-sm font-semibold text-text-primary">{user.full_name}</p>
                      <p className="truncate text-xs text-text-muted">{user.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/conta');
                      }}
                      className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm text-text-primary hover:bg-fg/[0.06]"
                    >
                      <UserCog size={16} />
                      Minha conta
                    </button>
                    <div className="flex items-center justify-between rounded-lg px-2.5 py-1 text-sm text-text-primary">
                      Tema
                      <ThemeToggle />
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm text-status-lost hover:bg-status-lost/10"
                    >
                      <LogOut size={16} />
                      Sair
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </header>

      <NotificationPanel open={inboxOpen} onClose={closeInbox} anchorRef={inboxRef} />
    </>
  );
}
