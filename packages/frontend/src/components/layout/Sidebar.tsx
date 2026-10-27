import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Kanban,
  Users,
  Briefcase,
  Calendar,
  BarChart3,
  Settings,
  PanelLeftClose,
  Menu,
  Inbox,
  NotebookPen,
  PhoneCall,
  Headset,
  CalendarCheck,
  Wallet,
  Building2,
  SearchCheck,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationPanel } from '@/components/notifications/NotificationPanel';
import { motion } from 'framer-motion';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import {
  DesktopSidebar,
  MobileSidebar,
  SidebarLink,
  SidebarSection,
  SidebarTooltip,
  useSidebar,
  SIDEBAR_FOOTER_HEIGHT,
} from '@/components/ui/AnimatedSidebar';

const ICON = { size: 20, strokeWidth: 1.75 };

// end: só ativo na rota exata (sem isso, /meus-leads acenderia em /meus-leads/reunioes)
type NavSection = { title: string; items: { to: string; icon: LucideIcon; label: string; end?: boolean }[] };

const sections: NavSection[] = [
  {
    title: 'Visão geral',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/reports', icon: BarChart3, label: 'Relatórios' },
      { to: '/empresa', icon: Building2, label: 'Sobre a empresa' },
    ],
  },
  {
    title: 'Vendas',
    items: [
      { to: '/pipeline', icon: Kanban, label: 'Pipeline' },
      { to: '/deals', icon: Briefcase, label: 'Negócios' },
      { to: '/contacts', icon: Users, label: 'Contatos' },
      { to: '/solicitacoes', icon: SearchCheck, label: 'Solicitações de leads' },
    ],
  },
  {
    title: 'Agenda',
    items: [{ to: '/calendar', icon: Calendar, label: 'Calendário' }],
  },
];

// Admin/gerente: operação de captação (distribuir leads, acompanhar, comissões)
const managerSections: NavSection[] = [
  ...sections,
  {
    title: 'Captação',
    items: [{ to: '/captacao', icon: Headset, label: 'Captação' }],
  },
];

// Captador: só os próprios leads (cada item é uma visão deles)
const captadorSections: NavSection[] = [
  {
    title: 'Visão geral',
    items: [
      // Painel = o dashboard de quem liga (semana/mês, gráficos)
      { to: '/meu-painel', icon: LayoutDashboard, label: 'Painel' },
      // Quem acabou de entrar começa entendendo o que vai vender
      { to: '/empresa', icon: Building2, label: 'Sobre a empresa' },
    ],
  },
  {
    title: 'Captação',
    items: [
      { to: '/meus-leads', icon: PhoneCall, label: 'Meus leads', end: true },
      { to: '/meus-leads/reunioes', icon: CalendarCheck, label: 'Reuniões' },
      { to: '/solicitacoes', icon: SearchCheck, label: 'Solicitações de leads' },
    ],
  },
  {
    title: 'Ganhos',
    items: [{ to: '/minhas-comissoes', icon: Wallet, label: 'Minhas comissões' }],
  },
];

// "Sobre a empresa" é pra quem foi convidado; o admin escreve o perfil em Configurações
const adminSections: NavSection[] = managerSections.map((s) => ({
  ...s,
  items: s.items.filter((i) => i.to !== '/empresa'),
}));

export function sectionsFor(role: string | undefined) {
  if (role === 'captador') return captadorSections;
  if (role === 'admin') return adminSections;
  if (role === 'manager') return managerSections;
  return sections;
}

const headerIconClass =
  'relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] text-text-secondary transition-colors duration-200 hover:bg-fg/[0.06] hover:text-text-primary';

/**
 * Topo do menu: recolher/expandir à esquerda (hambúrguer quando recolhido),
 * caixa de entrada e notas à direita (somem no modo recolhido — não cabem em 72px).
 */
function SidebarHeader({ onToggle, onNavigate }: { onToggle?: () => void; onNavigate?: () => void }) {
  const { expanded } = useSidebar();
  const mobile = !!onNavigate;
  const { unreadCount } = useNotifications();
  const notesOpen = useUIStore((s) => s.notesOpen);
  const toggleNotes = useUIStore((s) => s.toggleNotes);
  const [inboxOpen, setInboxOpen] = useState(false);
  const inboxRef = useRef<HTMLButtonElement>(null);
  const closeInbox = useCallback(() => setInboxOpen(false), []);

  return (
    // Mobile: o X de fechar a gaveta fica na ponta esquerda; notas vão pra direita
    <div className={cn('relative flex h-16 flex-shrink-0 items-center pr-3', mobile ? 'pl-16' : 'pl-4')}>
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? 'Recolher menu' : 'Expandir menu'}
          title={expanded ? 'Recolher menu (Ctrl+B)' : 'Expandir menu (Ctrl+B)'}
          // pl-4 + w-10: centro em 36px, o mesmo eixo dos ícones do menu recolhido
          className={headerIconClass}
        >
          {expanded ? <PanelLeftClose size={19} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.9} />}
          {/* Recolhido, a caixa de entrada some: o ponto avisa que há novidade */}
          {!expanded && unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-green ring-2 ring-[#03120E]" />
          )}
        </button>
      )}

      <motion.div
        className="ml-auto flex items-center gap-1"
        initial={false}
        animate={{ opacity: expanded ? 1 : 0 }}
        transition={{ duration: expanded ? 0.3 : 0.12, delay: expanded ? 0.08 : 0 }}
        style={{ pointerEvents: expanded ? 'auto' : 'none' }}
        aria-hidden={!expanded}
      >
        {/* Celular: caixa de entrada fica na barra de cima (Topbar), não no menu */}
        {!mobile && (
        <button
          ref={inboxRef}
          type="button"
          onClick={() => setInboxOpen((v) => !v)}
          tabIndex={expanded ? 0 : -1}
          aria-label="Caixa de entrada"
          title="Caixa de entrada"
          className={cn(headerIconClass, inboxOpen && 'bg-fg/[0.06] text-text-primary')}
        >
          <Inbox size={19} strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-accent-green px-1 text-[10px] font-bold text-bg-darker ring-2 ring-[#03120E]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
        )}
        <button
          type="button"
          onClick={() => {
            toggleNotes();
            onNavigate?.();
          }}
          tabIndex={expanded ? 0 : -1}
          aria-label="Notas"
          aria-pressed={notesOpen}
          title={notesOpen ? 'Fechar notas' : 'Notas'}
          className={cn(headerIconClass, notesOpen && 'bg-accent-green/15 text-accent-green hover:text-accent-green')}
        >
          <NotebookPen size={18} strokeWidth={1.75} />
        </button>
      </motion.div>

      {!mobile && <NotificationPanel open={inboxOpen} onClose={closeInbox} anchorRef={inboxRef} />}
    </div>
  );
}

/** Rodapé: workspace atual; recolhido vira só o ícone (com tooltip) */
function SidebarWorkspace() {
  const { expanded } = useSidebar();
  if (expanded) return <WorkspaceSwitcher />;
  return (
    <SidebarTooltip label="Trocar workspace">
      <div className="w-12">
        <WorkspaceSwitcher compact />
      </div>
    </SidebarTooltip>
  );
}

function SidebarContent({ onNavigate, onToggle }: { onNavigate?: () => void; onToggle?: () => void }) {
  const role = useAuthStore((s) => s.user?.role);

  return (
    <>
      {/* Gaveta mobile chega com onNavigate e sem onToggle */}
      <SidebarHeader onToggle={onToggle} onNavigate={onNavigate} />

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-3 py-4">
        {sectionsFor(role).map((section) => (
          <SidebarSection key={section.title} title={section.title}>
            {section.items.map(({ to, icon: Icon, label, end }) => (
              <SidebarLink key={to} to={to} end={end} label={label} icon={<Icon {...ICON} />} onNavigate={onNavigate} />
            ))}
          </SidebarSection>
        ))}
      </nav>

      {/* Altura fixa: a faixa de vidro do AppShell (SIDEBAR_FOOTER_HEIGHT) se alinha a este rodapé */}
      <div className="flex flex-shrink-0 flex-col justify-center gap-1 p-3" style={{ height: SIDEBAR_FOOTER_HEIGHT }}>
        {/* Admin/gerente: configurações do workspace. Vendedor/captador: as da própria conta */}
        <SidebarLink
          to={role === 'admin' || role === 'manager' ? '/settings' : '/conta'}
          label="Configurações"
          icon={<Settings {...ICON} />}
          onNavigate={onNavigate}
        />
        <SidebarWorkspace />
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
