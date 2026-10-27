import { useCallback, useEffect, useRef, useState } from 'react';
import { Inbox, LogOut, NotebookPen, UserCog } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/auth.service';
import { useNotifications } from '@/hooks/useNotifications';
import { Avatar } from '@/components/ui/Avatar';
import { useNavigate } from 'react-router-dom';
import { TopbarSearch } from '@/components/search/TopbarSearch';
import { NotificationPanel } from '@/components/notifications/NotificationPanel';
import { ThemeToggle } from './ThemeToggle';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { dropdownMotion } from '@/lib/motion';

const iconButton =
  'relative flex h-10 w-10 items-center justify-center rounded-[10px] text-text-secondary transition-colors duration-200 hover:bg-fg/[0.05] hover:text-text-primary';

export function Topbar() {
  const { user, refreshToken, logout } = useAuthStore();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const [inboxOpen, setInboxOpen] = useState(false);
  const inboxRef = useRef<HTMLButtonElement>(null);
  const closeInbox = useCallback(() => setInboxOpen(false), []);
  // Celular: a foto abre um menu (Minha conta, tema, Sair); no desktop vai direto pra Minha conta
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Foto abre o menu da conta (Minha conta, Tema, Sair) no celular e no computador
  const openAccount = () => setMenuOpen((v) => !v);
  const notesOpen = useUIStore((s) => s.notesOpen);
  const toggleNotes = useUIStore((s) => s.toggleNotes);

  return (
    <>
      <header className="relative z-30 flex h-[64px] flex-shrink-0 items-end gap-2 md:gap-4">
        {/* Aba da pasta: mesma cor do corpo, encaixada nele por uma curva côncava */}
        {/* Largura do conteúdo; respiro lateral de 24px = padding do <main> (alinha a busca com a página).
            items-end: a base da busca cai na mesma linha do topo do corpo da pasta, à direita da curva.
            O seletor de workspace fica no topo do menu lateral. */}
        {/* Busca global varre contatos e negócios do workspace — o captador não tem aba (AppShell arredonda a pasta) */}
        {/* No celular a aba não cabe ao lado do hambúrguer: a busca vira um botão (lupa) */}
        {user?.role !== 'captador' && (
          <div className="relative flex h-[60px] min-w-0 flex-shrink items-end gap-2 rounded-t-[18px] px-6 folder-surface max-md:hidden">
            <div className="w-[480px] min-w-0 flex-shrink">
              <TopbarSearch />
            </div>
            <span
              aria-hidden
              // Curva côncava por máscara (não por gradiente): assim ela herda a cor/transparência/blur da pasta
              className="folder-surface pointer-events-none absolute bottom-0 left-full h-[18px] w-[18px]"
              style={{
                WebkitMaskImage: 'radial-gradient(circle at 100% 0, transparent 17.5px, #000 18px)',
                maskImage: 'radial-gradient(circle at 100% 0, transparent 17.5px, #000 18px)',
              }}
            />
          </div>
        )}

        <div className="min-w-[8px] flex-1 md:min-w-[24px]" />

        {/* Ícones flutuando sobre o fundo do app — sempre em tinta clara. Computador: fixos no canto
            da tela, pra não andarem junto com a pasta quando as notas abrem e ela encolhe */}
        {/* -translate-y-1: centraliza na faixa de fundo entre o topo da tela e o corpo da pasta */}
        <div className="force-dark sidebar-ink flex h-[52px] flex-shrink-0 -translate-y-1 items-center gap-1.5 self-center max-md:mr-2.5 md:fixed md:right-8 md:top-[10px] md:translate-y-0">
          {user && (
            <div className="flex items-center gap-1.5">
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
              {/* Celular: caixa de entrada ao lado da foto (no desktop ela fica no topo do menu lateral) */}
              <button
                ref={inboxRef}
                type="button"
                onClick={() => setInboxOpen((v) => !v)}
                aria-label="Caixa de entrada"
                className={cn(iconButton, 'h-11 w-11 md:hidden', inboxOpen && 'bg-fg/[0.06] text-text-primary')}
              >
                <Inbox size={25} strokeWidth={1.75} />
                {unreadCount > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-accent-green px-1 text-[10px] font-bold text-bg-darker ring-2 ring-[#03120E]">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              <div ref={menuRef} className="relative">
                {/* Anel esmeralda → âmbar em volta do avatar */}
                <button
                  type="button"
                  onClick={openAccount}
                  className="rounded-full p-[1.5px] transition-transform duration-200 hover:scale-105"
                  style={{
                    background:
                      'conic-gradient(from 200deg, rgb(var(--accent-green)), rgb(var(--accent-green)) 55%, rgb(var(--accent-amber)) 80%, rgb(var(--accent-green)))',
                  }}
                  title={`${user.full_name} — Minha conta`}
                  aria-label="Minha conta"
                  aria-expanded={menuOpen}
                >
                  <Avatar
                    name={user.full_name}
                    src={user.avatar_url}
                    className="h-11 w-11 bg-bg-surface text-sm ring-2 ring-bg-primary"
                  />
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
        </div>
      </header>

      <NotificationPanel open={inboxOpen} onClose={closeInbox} anchorRef={inboxRef} />

    </>
  );
}
