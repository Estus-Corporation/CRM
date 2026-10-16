import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Kanban,
  Users,
  Briefcase,
  Calendar,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useBilling } from '@/hooks/useBilling';
import { Avatar } from '@/components/ui/Avatar';
import { LogoIcon } from '@/components/ui/LogoIcon';
import {
  DesktopSidebar,
  MobileSidebar,
  SidebarLabel,
  SidebarLink,
  SidebarSection,
  SidebarTooltip,
  useSidebar,
  SIDEBAR_FOOTER_HEIGHT,
} from '@/components/ui/AnimatedSidebar';

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const ICON = { size: 20, strokeWidth: 1.75 };

const sections = [
  {
    title: 'Visão geral',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/reports', icon: BarChart3, label: 'Relatórios' },
    ],
  },
  {
    title: 'Vendas',
    items: [
      { to: '/pipeline', icon: Kanban, label: 'Pipeline' },
      { to: '/deals', icon: Briefcase, label: 'Negócios' },
      { to: '/contacts', icon: Users, label: 'Contatos' },
    ],
  },
  {
    title: 'Agenda',
    items: [{ to: '/calendar', icon: Calendar, label: 'Calendário' }],
  },
];

function SidebarHeader({ onToggle }: { onToggle?: () => void }) {
  const { expanded } = useSidebar();

  return (
    <div className="flex h-14 flex-shrink-0 items-center pl-6 pr-3">
      {/* Recolhido: o logo vira o botão de expandir no hover */}
      <button
        type="button"
        onClick={!expanded ? onToggle : undefined}
        tabIndex={expanded ? -1 : 0}
        aria-label={expanded ? undefined : 'Expandir menu'}
        className={cn(
          'group/logo relative flex h-6 w-6 flex-shrink-0 items-center justify-center',
          expanded ? 'cursor-default' : 'cursor-pointer',
        )}
      >
        <LogoIcon
          size={22}
          variant="brand"
          className={cn('text-accent-green transition-opacity duration-200', !expanded && 'group-hover/logo:opacity-0')}
        />
        {!expanded && (
          <PanelLeftOpen
            size={20}
            strokeWidth={1.75}
            className="absolute text-text-secondary opacity-0 transition-opacity duration-200 group-hover/logo:opacity-100"
          />
        )}
      </button>

      <SidebarLabel className="ml-3 text-[16px] font-semibold tracking-[-0.01em] text-text-primary">
        TitanFlow
      </SidebarLabel>

      {onToggle && (
        <SidebarLabel className="ml-auto">
          <button
            type="button"
            onClick={onToggle}
            tabIndex={expanded ? 0 : -1}
            aria-label="Recolher menu"
            title="Recolher menu (Ctrl+B)"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors duration-200 hover:bg-fg/[0.05] hover:text-text-primary"
          >
            <PanelLeftClose size={18} strokeWidth={1.75} />
          </button>
        </SidebarLabel>
      )}
    </div>
  );
}

function UserCard({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuthStore();
  const { data: billing } = useBilling();
  if (!user) return null;
  const plan = billing?.plan ?? 'free';

  return (
    <SidebarTooltip label={user.full_name}>
      <NavLink
        to="/settings"
        onClick={onNavigate}
        className="flex h-14 items-center gap-3 rounded-[10px] px-[6px] transition-colors duration-300 hover:bg-fg/[0.04]"
      >
        <Avatar name={user.full_name} className="h-9 w-9 flex-shrink-0 text-[13px]" />
        <SidebarLabel className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium leading-5 text-text-primary">{user.full_name}</span>
            <span className="block truncate text-[12.5px] leading-4 text-text-muted">{user.email}</span>
          </span>
          <span
            className={cn(
              'flex-shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
              plan === 'free' ? 'border-bg-border text-text-secondary' : 'border-accent-green/25 text-accent-green',
            )}
          >
            {PLAN_LABEL[plan] ?? plan}
          </span>
        </SidebarLabel>
      </NavLink>
    </SidebarTooltip>
  );
}

function SidebarContent({ onNavigate, onToggle }: { onNavigate?: () => void; onToggle?: () => void }) {
  return (
    <>
      <SidebarHeader onToggle={onToggle} />

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-3 py-4">
        {sections.map((section) => (
          <SidebarSection key={section.title} title={section.title}>
            {section.items.map(({ to, icon: Icon, label }) => (
              <SidebarLink key={to} to={to} label={label} icon={<Icon {...ICON} />} onNavigate={onNavigate} />
            ))}
          </SidebarSection>
        ))}
      </nav>

      {/* Altura fixa: a faixa de vidro do AppShell (SIDEBAR_FOOTER_HEIGHT) se alinha a este rodapé */}
      <div className="flex flex-shrink-0 flex-col justify-center gap-1 p-3" style={{ height: SIDEBAR_FOOTER_HEIGHT }}>
        <SidebarLink to="/settings" label="Configurações" icon={<Settings {...ICON} />} onNavigate={onNavigate} />
        <UserCard onNavigate={onNavigate} />
      </div>
    </>
  );
}

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  // Atalho: Ctrl/⌘ + B recolhe/expande o menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleSidebar]);

  return (
    <>
      <DesktopSidebar expanded={!sidebarCollapsed}>
        <SidebarContent onToggle={toggleSidebar} />
      </DesktopSidebar>
      <MobileSidebar open={mobileOpen} onClose={onMobileClose}>
        <SidebarContent onNavigate={onMobileClose} />
      </MobileSidebar>
    </>
  );
}
