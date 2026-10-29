import { useEffect } from 'react';
import {
  LayoutDashboard,
  Kanban,
  Users,
  Briefcase,
  Calendar,
  BarChart3,
  Settings,
  NotebookPen,
  PhoneCall,
  Headset,
  CalendarCheck,
  Wallet,
  Building2,
  type LucideIcon,
} from 'lucide-react';
import { cn, personName, shortName } from '@/lib/utils';
import { useOnlineMembers } from '@/hooks/usePresence';
import { Avatar } from '@/components/ui/Avatar';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useTenant } from '@/hooks/useTenant';
import { useLeadHunterEnabled } from '@/hooks/useLeadHunter';
import { CompanyLogo } from '@/components/company/CompanyLogo';
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

const dashboard = { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' };
const reports = { to: '/reports', icon: BarChart3, label: 'Relatórios' };
const calendar = { to: '/calendar', icon: Calendar, label: 'Calendário' };
const company = { to: '/empresa', icon: Building2, label: 'Sobre a empresa' };

const sales: NavSection = {
  title: 'Vendas',
  items: [
    { to: '/pipeline', icon: Kanban, label: 'Pipeline' },
    { to: '/deals', icon: Briefcase, label: 'Negócios' },
    { to: '/contacts', icon: Users, label: 'Contatos' },
  ],
};

// Nenhuma seção com um item só: o Calendário (de todos) fica na Visão geral
// Vendedor: "Sobre a empresa" junto da visão geral (não tem a parte de Empresa/Captação)
const sections: NavSection[] = [
  { title: 'Visão geral', items: [dashboard, reports, calendar, company] },
  sales,
];

// Admin/gerente: a operação da empresa (captação + perfil que a equipe consulta) numa seção só
const managerSections: NavSection[] = [
  { title: 'Visão geral', items: [dashboard, reports, calendar] },
  sales,
  {
    title: 'Empresa',
    items: [
      { to: '/captacao', icon: Headset, label: 'Captação' },
      company,
    ],
  },
];

// Captador: só os próprios leads (cada item é uma visão deles)
const captadorSections: NavSection[] = [
  {
    title: 'Visão geral',
    items: [
      // Painel = o dashboard de quem liga (semana/mês, gráficos)
      { to: '/meu-painel', icon: LayoutDashboard, label: 'Painel' },
      { to: '/minhas-comissoes', icon: Wallet, label: 'Minhas comissões' },
    ],
  },
  {
    title: 'Captação',
    items: [
      { to: '/meus-leads', icon: PhoneCall, label: 'Meus leads', end: true },
      { to: '/meus-leads/reunioes', icon: CalendarCheck, label: 'Reuniões' },
      // O material de venda que ele consulta antes de ligar
      company,
    ],
  },
];

// Admin vê o mesmo menu do gerente (inclusive "Sobre a empresa", como a equipe enxerga o perfil).
// Solicitações de leads é uma aba da Captação (só admin).
const adminSections: NavSection[] = managerSections;

// LeadHunter (Campanhas, Locais pesquisados, Integrações) virou abas da Captação, não tem seção no menu
export function sectionsFor(role: string | undefined, _leadhunterEnabled = false) {
  if (role === 'captador') return captadorSections;
  if (role === 'admin') return adminSections;
  if (role === 'manager') return managerSections;
  return sections;
}

const headerIconClass =
  'relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] text-text-secondary transition-colors duration-200 hover:bg-fg/[0.06] hover:text-text-primary';

/**
 * Topo do menu. Computador: o espaço atual — clicar no logo recolhe/expande o menu (Ctrl+B também);
 * o nome ao lado abre a troca de espaço. Celular: X de fechar à esquerda e notas à direita.
 */
function SidebarHeader({ onToggle, onNavigate }: { onToggle?: () => void; onNavigate?: () => void }) {
  const { expanded } = useSidebar();
  const mobile = !!onNavigate;
  const { data: tenant } = useTenant();
  const notesOpen = useUIStore((s) => s.notesOpen);
  const toggleNotes = useUIStore((s) => s.toggleNotes);

  if (mobile) {
    return (
      <div className="relative flex h-16 flex-shrink-0 items-center pl-16 pr-3">
        <button
          type="button"
          onClick={() => {
            toggleNotes();
            onNavigate?.();
          }}
          aria-label="Notas"
          aria-pressed={notesOpen}
          title={notesOpen ? 'Fechar notas' : 'Notas'}
          className={cn(headerIconClass, 'ml-auto', notesOpen && 'bg-accent-green/15 text-accent-green hover:text-accent-green')}
        >
          <NotebookPen size={18} strokeWidth={1.75} />
        </button>
      </div>
    );
  }

  return (
    // px-3 + card de 48px: no menu recolhido o card vira só o logo, centrado em 36px (eixo dos ícones)
    <div className="relative flex h-16 flex-shrink-0 items-center px-3">
      <div
        className={cn(
          // Esmeralda profundo fixo (não o token): branco sobre o verde claro do tema escuro perderia contraste
          'flex h-12 items-center gap-2 overflow-hidden rounded-[12px] bg-[#0E8F5A] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-[width] duration-300 ease-out',
          expanded ? 'w-full' : 'w-12',
        )}
      >
        <SidebarTooltip label="Expandir menu (Ctrl+B)">
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? 'Recolher menu' : 'Expandir menu'}
            title={expanded ? 'Recolher menu (Ctrl+B)' : undefined}
            className="flex-shrink-0 rounded-[9px] outline-none transition-transform duration-200 hover:scale-105 focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <CompanyLogo name={tenant?.name} logoUrl={tenant?.logo_url} className="h-9 w-9 rounded-[9px] text-sm" />
          </button>
        </SidebarTooltip>

        <motion.div
          className="min-w-0 flex-1"
          initial={false}
          animate={{ opacity: expanded ? 1 : 0 }}
          transition={{ duration: expanded ? 0.3 : 0.12, delay: expanded ? 0.08 : 0 }}
          style={{ pointerEvents: expanded ? 'auto' : 'none' }}
          aria-hidden={!expanded}
        >
          <WorkspaceSwitcher variant="name" />
        </motion.div>
      </div>
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

const ONLINE_ROLE_LABEL: Record<string, string> = { admin: 'Admin', manager: 'Gerente', seller: 'Vendedor', captador: 'Captador' };

/** Fim do menu: quem do espaço está online agora (sem contar você). Recolhido = só as fotos, com o nome no tooltip */
function SidebarOnline() {
  const { expanded } = useSidebar();
  const { data = [] } = useOnlineMembers();
  const userId = useAuthStore((s) => s.user?.id);
  const others = data.filter((m) => m.id !== userId);

  return (
    <div className="mt-auto pt-2">
      <SidebarSection title={`Online agora${others.length ? ` · ${others.length}` : ''}`}>
        {others.length === 0 ? (
          expanded && <p className="px-3.5 py-1.5 text-xs text-text-muted">Só você está online.</p>
        ) : (
          others.map((m) =>
            expanded ? (
              <div key={m.id} className="flex items-center gap-2.5 rounded-lg px-3 py-1.5">
                <Avatar name={m.full_name} src={m.avatar_url} online className="h-7 w-7 text-[10px]" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-text-primary">{shortName(m.full_name)}</span>
                  <span className="block text-[11px] text-text-muted">{ONLINE_ROLE_LABEL[m.role] ?? m.role}</span>
                </span>
              </div>
            ) : (
              <SidebarTooltip key={m.id} label={`${personName(m.full_name)} · online`}>
                <div className="flex w-12 justify-center py-1">
                  <Avatar name={m.full_name} src={m.avatar_url} online className="h-7 w-7 text-[10px]" />
                </div>
              </SidebarTooltip>
            ),
          )
        )}
      </SidebarSection>
    </div>
  );
}

function SidebarContent({ onNavigate, onToggle }: { onNavigate?: () => void; onToggle?: () => void }) {
  const role = useAuthStore((s) => s.user?.role);
  const leadhunterEnabled = useLeadHunterEnabled();

  return (
    <>
      {/* Gaveta mobile chega com onNavigate e sem onToggle */}
      <SidebarHeader onToggle={onToggle} onNavigate={onNavigate} />

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-3 py-4">
        {sectionsFor(role, leadhunterEnabled).map((section) => (
          <SidebarSection key={section.title} title={section.title}>
            {section.items.map(({ to, icon: Icon, label, end }) => (
              <SidebarLink key={to} to={to} end={end} label={label} icon={<Icon {...ICON} />} onNavigate={onNavigate} />
            ))}
          </SidebarSection>
        ))}
        <SidebarOnline />
      </nav>

      {/* Computador: altura fixa, a faixa de vidro (SIDEBAR_FOOTER_HEIGHT) se alinha a este rodapé.
          O espaço fica no topo do menu; no celular continua aqui embaixo */}
      <div className="flex flex-shrink-0 flex-col justify-center gap-1 p-3" style={{ height: onNavigate ? undefined : SIDEBAR_FOOTER_HEIGHT }}>
        {/* Admin/gerente: configurações do workspace. Vendedor/captador: as da própria conta */}
        <SidebarLink
          to={role === 'admin' || role === 'manager' ? '/settings' : '/conta'}
          label="Configurações"
          icon={<Settings {...ICON} />}
          onNavigate={onNavigate}
        />
        {onNavigate && <SidebarWorkspace />}
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
