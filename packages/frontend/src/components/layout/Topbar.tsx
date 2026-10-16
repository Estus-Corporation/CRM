import { useState } from 'react';
import { LogOut, Bell } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/auth.service';
import { Avatar } from '@/components/ui/Avatar';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationPanel } from '@/components/notifications/NotificationPanel';
import { TopbarSearch } from '@/components/search/TopbarSearch';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { FolderGlassToggle } from './FolderGlassToggle';
import { cn } from '@/lib/utils';

export function Topbar() {
  const { user, refreshToken, logout } = useAuthStore();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);

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

  return (
    <>
      <header className="relative z-30 flex h-[64px] flex-shrink-0 items-end gap-4">
        {/* Aba da pasta: mesma cor do corpo, encaixada nele por uma curva côncava */}
        {/* Largura do conteúdo; respiro lateral de 24px = padding do <main> (alinha o seletor com a página).
            items-end: a base da busca cai na mesma linha do topo do corpo da pasta, à direita da curva */}
        <div
          className="relative flex h-[60px] min-w-0 flex-shrink items-end gap-2 rounded-t-[18px] px-6 max-md:pl-12 folder-surface">
          <WorkspaceSwitcher />
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

        <div className="min-w-[24px] flex-1" />

        {/* Ícones flutuando sobre o fundo do app — sempre em tinta clara */}
        {/* -translate-y-1: centraliza na faixa de fundo entre o topo da tela e o corpo da pasta */}
        <div className="force-dark sidebar-ink flex h-[52px] flex-shrink-0 -translate-y-1 items-center gap-1.5 self-center">
          <FolderGlassToggle />
          <ThemeToggle />
          <div className="relative">
            <button
              title="Notificações"
              onClick={() => setNotifOpen((v) => !v)}
              className={cn(
                'relative flex h-10 w-10 items-center justify-center rounded-[10px] text-text-secondary transition-colors duration-200 hover:bg-fg/[0.05] hover:text-text-primary',
                notifOpen && 'bg-fg/[0.05] text-text-primary',
              )}
            >
              <Bell size={20} strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-green px-1 text-[10px] font-bold text-bg-darker ring-2 ring-bg-primary">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
          </div>

          {user && (
            <div className="ml-1.5 flex items-center gap-1.5 border-l border-fg/[0.07] pl-3">
              {/* Anel esmeralda → âmbar em volta do avatar */}
              <span
                className="rounded-full p-[1.5px]"
                style={{ background: 'conic-gradient(from 200deg, rgb(var(--accent-green)), rgb(var(--accent-green)) 55%, rgb(var(--accent-amber)) 80%, rgb(var(--accent-green)))' }}
                title={user.full_name}
              >
                <Avatar name={user.full_name} className="h-9 w-9 bg-bg-surface text-[13px] ring-2 ring-bg-primary" />
              </span>
              <button
                onClick={handleLogout}
                title="Sair"
                className="flex h-10 w-10 items-center justify-center rounded-[10px] text-text-secondary transition-colors duration-200 hover:bg-fg/[0.05] hover:text-text-primary"
              >
                <LogOut size={19} strokeWidth={1.75} />
              </button>
            </div>
          )}
        </div>
      </header>

    </>
  );
}
