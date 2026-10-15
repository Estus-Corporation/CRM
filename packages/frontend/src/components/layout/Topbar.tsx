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
      <header className="relative z-30 flex h-14 items-center justify-between gap-4 border-b border-white/[0.06] bg-[#0a0d15]/50 px-5 backdrop-blur-xl">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <WorkspaceSwitcher />
          <TopbarSearch />
        </div>

        <div className="flex flex-shrink-0 items-center gap-1.5">
          <div className="relative">
            <button
              title="Notificações"
              onClick={() => setNotifOpen((v) => !v)}
              className={cn(
                'relative flex h-10 w-10 items-center justify-center rounded-[10px] text-text-secondary transition-colors duration-200 hover:bg-white/[0.05] hover:text-text-primary',
                notifOpen && 'bg-white/[0.05] text-text-primary',
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
            <div className="ml-1.5 flex items-center gap-1.5 border-l border-white/[0.07] pl-3">
              {/* Anel aurora em volta do avatar */}
              <span
                className="rounded-full p-[1.5px]"
                style={{ background: 'conic-gradient(from 210deg, #72d296, #4cc9c0, #6b8cff, #a27bff, #72d296)' }}
                title={user.full_name}
              >
                <Avatar name={user.full_name} className="h-9 w-9 bg-bg-surface text-[13px] ring-2 ring-bg-primary" />
              </span>
              <button
                onClick={handleLogout}
                title="Sair"
                className="flex h-10 w-10 items-center justify-center rounded-[10px] text-text-secondary transition-colors duration-200 hover:bg-white/[0.05] hover:text-text-primary"
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
