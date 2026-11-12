import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Menu, Orbit, Settings, X } from 'lucide-react';
import { SilkShader } from '@/components/ui/SilkShader';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { pageMotion } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useHydrated, useRpg, useStats } from './store';
import { brl } from './data';
import { NAV_SECTIONS, type NavItem } from './nav';
import { SILK_NAVY, useRpgTheme } from './theme';

const ALL_ITEMS = NAV_SECTIONS.flatMap((x) => x.items);
const CONFIG_ITEM: NavItem = { id: 'config', to: '/config', label: 'Configurações', icon: Settings, match: (p) => p === '/config' };

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffffff_0%,#9db7ff_22%,#2f5bd8_55%,#0b1838_100%)] text-white shadow-[0_0_22px_-4px_rgba(90,130,255,0.8)]">
        <Orbit size={20} strokeWidth={1.8} className="drop-shadow" />
      </div>
      <div className="min-w-0">
        <p className="font-display text-[15px] leading-tight tracking-[0.06em] text-text-primary">LIFE RPG</p>
        <p className="truncate text-[11.5px] text-text-muted">Inventário da sua vida</p>
      </div>
    </div>
  );
}

function SideLink({ item, badge }: { item: NavItem; badge?: number }) {
  const { pathname, search } = useLocation();
  const active = item.match(pathname, search);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex items-center gap-3 rounded-xl px-3 py-[7px] text-[13.5px] font-medium transition-colors',
        active ? 'bg-fg/[0.08] text-text-primary' : 'text-text-secondary hover:bg-fg/[0.04] hover:text-text-primary',
      )}
    >
      {active && <motion.span layoutId="rpg-nav" className="brand-bar absolute inset-y-2 left-0 w-[3px] rounded-full" />}
      <Icon size={17} strokeWidth={2} className="flex-shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {!!badge && <span className="rounded-full bg-fg/[0.08] px-1.5 text-[11px] tabular-nums text-text-secondary">{badge}</span>}
    </Link>
  );
}

const COLLAPSE_KEY = 'life-rpg.nav-collapsed';
const readCollapsed = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

/** Menu lateral em blocos; os blocos de universos recolhem (lembrado neste navegador) */
function SideNav() {
  const { pathname, search } = useLocation();
  const wishes = useStats().wishes;
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed);
  const toggle = (id: string) => {
    const next = collapsed.includes(id) ? collapsed.filter((x) => x !== id) : [...collapsed, id];
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
    } catch {
      /* sem armazenamento: só não lembra */
    }
  };

  return (
    <nav className="flex flex-col gap-5">
      {NAV_SECTIONS.map((sec) => {
        // O bloco da página aberta nunca fica escondido
        const shut = !!sec.collapsible && collapsed.includes(sec.id) && !sec.items.some((i) => i.match(pathname, search));
        return (
          <div key={sec.id}>
            {sec.label &&
              (sec.collapsible ? (
                <button type="button" onClick={() => toggle(sec.id)} aria-expanded={!shut}
                  className="mb-1.5 flex w-full items-center gap-2 px-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors hover:text-text-secondary">
                  <span className="flex-1 text-left">{sec.label}</span>
                  <ChevronDown size={13} className={cn('transition-transform duration-200', shut && '-rotate-90')} />
                </button>
              ) : (
                <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">{sec.label}</p>
              ))}
            <AnimatePresence initial={false}>
              {!shut && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-0.5 overflow-hidden"
                >
                  {sec.items.map((n) => <SideLink key={n.id} item={n} badge={n.id === 'wishlist' ? wishes : undefined} />)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
}

function Topbar() {
  const name = useRpg((s) => s.name);
  const st = useStats();
  const { pathname, search } = useLocation();
  const item = [...ALL_ITEMS, CONFIG_ITEM].find((n) => n.match(pathname, search));
  const section = NAV_SECTIONS.find((sec) => item && sec.items.includes(item))?.label;
  const chips = [
    { label: 'em andamento', value: st.doing },
    { label: 'na wishlist', value: st.wishes },
    { label: 'gastos no mês', value: brl(st.monthSpent) },
  ];
  return (
    <div className="folder-surface flex items-center gap-x-6 gap-y-3 rounded-[22px] px-5 py-3 max-md:rounded-2xl">
      <p className="min-w-0 truncate text-sm text-text-muted">
        <span className="max-md:hidden">{section || name} <span className="mx-1.5">›</span> </span>
        <span className="font-semibold text-text-primary">{item?.label ?? 'Visão geral'}</span>
      </p>
      <div className="ml-auto flex items-center gap-4 text-xs text-text-muted">
        {chips.map((c, i) => (
          <span key={c.label} className={cn('whitespace-nowrap', i < 2 && 'max-sm:hidden')}>
            <span className="font-semibold tabular-nums text-text-primary">{c.value}</span> {c.label}
          </span>
        ))}
      </div>
      <NavLink to="/config" aria-label="Configurações" className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-fg/[0.06] hover:text-text-primary md:hidden">
        <Settings size={19} />
      </NavLink>
    </div>
  );
}

/** Celular: Início, Financeiro, Wishlist e Menu (folha com os mesmos blocos do menu lateral; sem rolagem lateral) */
function MobileNav() {
  const [open, setOpen] = useState(false);
  const { pathname, search } = useLocation();
  useEffect(() => setOpen(false), [pathname, search]);
  const quick = ['home', 'finance', 'wishlist'].map((id) => ALL_ITEMS.find((n) => n.id === id)!);
  const quickActive = quick.some((n) => n.match(pathname, search));
  const item = 'flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium';
  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="folder-surface fixed inset-x-3 bottom-[84px] z-30 max-h-[calc(100dvh-120px)] space-y-4 overflow-y-auto rounded-2xl p-3 md:hidden"
          >
            {NAV_SECTIONS.map((sec) => (
              <div key={sec.id}>
                <p className="mb-1.5 px-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">{sec.label || 'Início'}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {sec.items.map((n) => (
                    <Link key={n.id} to={n.to}
                      className={cn('flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 text-center text-[11px] font-medium leading-tight',
                        n.match(pathname, search) ? 'bg-fg/[0.1] text-text-primary' : 'bg-fg/[0.03] text-text-secondary')}>
                      <n.icon size={19} />
                      {n.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <nav className="folder-surface fixed inset-x-3 bottom-3 z-30 grid grid-cols-4 rounded-2xl p-1.5 md:hidden">
        {quick.map((n) => (
          <Link key={n.id} to={n.to} className={cn(item, n.match(pathname, search) && !open ? 'bg-fg/[0.08] text-text-primary' : 'text-text-muted')}>
            <n.icon size={19} /> {n.short ?? n.label}
          </Link>
        ))}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
          className={cn(item, open || (!quickActive && pathname !== '/config') ? 'bg-fg/[0.08] text-text-primary' : 'text-text-muted')}>
          {open ? <X size={19} /> : <Menu size={19} />} Menu
        </button>
      </nav>
    </>
  );
}

/** Fundo do app (shader Silk) */
function SilkBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <SilkShader resolution={0.5} colors={SILK_NAVY} className="absolute inset-[-16px] h-[calc(100%+32px)] w-[calc(100%+32px)] blur-[6px]" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#02040A]/70 via-[#02040A]/45 to-[#02040A]/65" />
    </div>
  );
}

/**
 * Casca do Life RPG: o mesmo visual do CRM (shader Silk ao fundo, menu lateral claro sobre ele,
 * topo e corpo em "pasta" translúcida). Sempre no tema escuro.
 */
export function RpgShell() {
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const hydrated = useHydrated();
  useRpgTheme();

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#02040A] md:py-3">
      <SilkBackdrop />

      {/* Menu lateral (computador) */}
      <aside className="force-dark sidebar-ink relative z-10 hidden w-64 flex-shrink-0 flex-col gap-6 overflow-y-auto py-3 pl-3 md:flex">
        <Brand />
        <SideNav />
        <div className="mt-auto border-t border-fg/[0.08] pt-3">
          <SideLink item={CONFIG_ITEM} />
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-3 overflow-hidden p-3 md:ml-3 md:py-0 md:pl-0">
        <Topbar />
        <div className="folder-surface relative min-h-0 flex-1 overflow-hidden rounded-[22px]" style={{ boxShadow: '0 24px 48px -24px rgba(0,0,0,0.55)' }}>
          <main className="h-full overflow-y-auto overflow-x-hidden p-4 max-md:pb-28 md:p-6">
            <ErrorBoundary>
              {hydrated ? (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={pathname} {...pageMotion} className="flex min-h-full flex-col">
                    {outlet}
                  </motion.div>
                </AnimatePresence>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-text-muted">Carregando seu inventário…</div>
              )}
            </ErrorBoundary>
          </main>
        </div>
      </div>

      <MobileNav />
    </div>
  );
}
