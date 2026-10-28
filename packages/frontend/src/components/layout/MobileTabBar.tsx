import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useTenant } from '@/hooks/useTenant';
import { useLeadHunterEnabled } from '@/hooks/useLeadHunter';
import { CompanyLogo } from '@/components/company/CompanyLogo';
import { sectionsFor } from './Sidebar';
import { cn } from '@/lib/utils';

// Atalhos da barra inferior por papel; o resto fica no menu completo ("Mais")
const TABS: Record<string, string[]> = {
  captador: ['/meu-painel', '/meus-leads', '/meus-leads/reunioes', '/minhas-comissoes'],
  admin: ['/dashboard', '/pipeline', '/contacts', '/captacao'],
  manager: ['/dashboard', '/pipeline', '/contacts', '/captacao'],
  seller: ['/dashboard', '/pipeline', '/contacts', '/calendar'],
};

// Rótulos curtos pra caber em 5 colunas
const SHORT: Record<string, string> = {
  '/meus-leads': 'Leads',
  '/minhas-comissoes': 'Comissões',
  '/meus-leads/reunioes': 'Reuniões',
  '/meu-painel': 'Painel',
  '/dashboard': 'Início',
  '/calendar': 'Agenda',
};

/** Navegação fixa no rodapé do celular: 4 atalhos + logo do espaço (Sobre a empresa) */
export function MobileTabBar() {
  const role = useAuthStore((s) => s.user?.role);
  const { data: tenant } = useTenant();
  const leadhunterEnabled = useLeadHunterEnabled();
  const items = sectionsFor(role, leadhunterEnabled).flatMap((s) => s.items);
  const tabs = (TABS[role ?? 'seller'] ?? TABS.seller)
    .map((to) => items.find((i) => i.to === to))
    .filter((i): i is (typeof items)[number] => !!i);

  const tabClass = 'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[10.5px] font-medium transition-colors';

  return (
    <nav
      className="glass-panel fixed inset-x-3 bottom-3 z-40 flex items-stretch gap-1 rounded-2xl p-1.5 shadow-2xl md:hidden"
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
    >
      {tabs.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end ?? to === '/meus-leads'}
          className={({ isActive }) =>
            cn(tabClass, isActive ? 'bg-accent-green/15 text-accent-green' : 'text-text-secondary hover:text-text-primary')
          }
        >
          <Icon size={19} strokeWidth={1.9} />
          <span className="max-w-full truncate">{SHORT[to] ?? label}</span>
        </NavLink>
      ))}
      {/* Logo do espaço: leva para "Sobre a empresa" (o menu completo segue no hambúrguer do topo) */}
      <NavLink
        to="/empresa"
        aria-label="Sobre a empresa"
        className={({ isActive }) => cn(tabClass, isActive ? 'bg-accent-green/15 text-accent-green' : 'text-text-secondary hover:text-text-primary')}
      >
        {({ isActive }) => (
          <>
            <CompanyLogo
              name={tenant?.name}
              logoUrl={tenant?.logo_url}
              className={cn('h-[22px] w-[22px] rounded-md text-[10px]', isActive && 'ring-2 ring-accent-green/60')}
            />
            <span className="max-w-full truncate">Empresa</span>
          </>
        )}
      </NavLink>
    </nav>
  );
}
