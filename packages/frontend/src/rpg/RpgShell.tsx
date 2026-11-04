import { useLayoutEffect } from 'react';
import { NavLink, useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Compass, Heart, History, Home, Layers, ListChecks, Settings, Target, Trophy, type LucideIcon } from 'lucide-react';
import { SilkShader } from '@/components/ui/SilkShader';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { pageMotion } from '@/lib/motion';
import { applyTheme } from '@/store/themeStore';
import { cn } from '@/lib/utils';
import { useRpg, useStats } from './store';
import { titleFor } from './data';
import { ProgressBar } from './ui';

export const NAV: { to: string; label: string; icon: LucideIcon; short?: string }[] = [
  { to: '/', label: 'Visão geral', icon: Home, short: 'Início' },
  { to: '/areas', label: 'Áreas da vida', icon: Layers, short: 'Áreas' },
  { to: '/autocuidado', label: 'Autocuidado', icon: Heart, short: 'Cuidado' },
  { to: '/metas', label: 'Metas', icon: Target },
  { to: '/missoes', label: 'Missões', icon: ListChecks },
  { to: '/conquistas', label: 'Conquistas', icon: Trophy },
  { to: '/historico', label: 'Histórico', icon: History },
];

// Celular: 5 atalhos embaixo (o resto fica nos cards da Visão geral)
const MOBILE_NAV = ['/', '/missoes', '/metas', '/autocuidado', '/conquistas'];

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-green/15 text-accent-green shadow-[inset_0_0_0_1px_rgb(var(--accent-green)/0.3)]">
        <Compass size={22} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="font-display text-[17px] font-semibold leading-tight tracking-[0.04em] text-text-primary">LIFE RPG</p>
        <p className="truncate text-[11.5px] text-text-muted">Sistema de evolução pessoal</p>
      </div>
    </div>
  );
}

function SideLink({ to, label, icon: Icon }: (typeof NAV)[number]) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-medium transition-colors',
          isActive ? 'bg-fg/[0.08] text-text-primary' : 'text-text-secondary hover:bg-fg/[0.04] hover:text-text-primary',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="rpg-nav" className="brand-bar absolute inset-y-2 left-0 w-[3px] rounded-full" />}
          <Icon size={18} strokeWidth={2} />
          {label}
        </>
      )}
    </NavLink>
  );
}

/** Topo: quem é você, nível, título e a barra de XP */
function Topbar() {
  const name = useRpg((s) => s.name);
  const { level, inLevel, needed } = useStats();
  const { pathname } = useLocation();
  const current = NAV.find((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)))?.label ?? 'Configurações';
  return (
    <div className="folder-surface flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[22px] px-5 py-3 max-md:rounded-2xl">
      <div className="min-w-0 max-md:hidden">
        <p className="text-sm text-text-muted">
          Life RPG <span className="mx-1.5">›</span> <span className="font-semibold text-text-primary">{current}</span>
        </p>
      </div>
      <div className="min-w-0 md:hidden">
        <p className="truncate font-semibold text-text-primary">{name}</p>
        <p className="text-xs text-text-muted">Nível {level} · {titleFor(level)}</p>
      </div>
      <div className="ml-auto flex min-w-[180px] flex-1 items-center gap-3 md:max-w-sm">
        <span className="flex h-7 flex-shrink-0 items-center rounded-full bg-accent-green/15 px-2.5 text-xs font-semibold text-accent-green">Nv. {level}</span>
        <div className="min-w-0 flex-1">
          <ProgressBar value={inLevel} max={needed} tone="white" />
          <p className="mt-1 text-right text-[11px] tabular-nums text-text-muted">
            {inLevel.toLocaleString('pt-BR')} / {needed.toLocaleString('pt-BR')} XP
          </p>
        </div>
      </div>
      {/* Celular: Histórico e Áreas não cabem na barra de baixo */}
      <NavLink to="/historico" aria-label="Histórico" className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-fg/[0.06] hover:text-text-primary md:hidden">
        <History size={19} />
      </NavLink>
      <NavLink to="/config" aria-label="Configurações" className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-fg/[0.06] hover:text-text-primary">
        <Settings size={19} />
      </NavLink>
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
  useLayoutEffect(() => applyTheme('dark'), []);

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#03120E] md:py-3">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <SilkShader resolution={0.5} className="absolute inset-[-16px] h-[calc(100%+32px)] w-[calc(100%+32px)] blur-[6px]" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#03120E]/60 via-[#03120E]/40 to-[#03120E]/55" />
      </div>

      {/* Menu lateral (computador) */}
      <aside className="force-dark sidebar-ink relative z-10 hidden w-60 flex-shrink-0 flex-col gap-6 py-3 pl-3 md:flex">
        <Brand />
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <SideLink key={n.to} {...n} />
          ))}
        </nav>
        <div className="mt-auto px-2">
          <SideLink to="/config" label="Configurações" icon={Settings} />
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-3 overflow-hidden p-3 md:ml-3 md:py-0 md:pl-0">
        <Topbar />
        <div className="folder-surface relative min-h-0 flex-1 overflow-hidden rounded-[22px]" style={{ boxShadow: '0 24px 48px -24px rgba(0,0,0,0.55)' }}>
          <main className="h-full overflow-y-auto overflow-x-hidden p-4 max-md:pb-28 md:p-6">
            <ErrorBoundary>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={pathname} {...pageMotion} className="flex min-h-full flex-col">
                  {outlet}
                </motion.div>
              </AnimatePresence>
            </ErrorBoundary>
          </main>
        </div>
      </div>

      {/* Barra inferior (celular) */}
      <nav className="folder-surface fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-2xl p-1.5 md:hidden">
        {NAV.filter((n) => MOBILE_NAV.includes(n.to)).map(({ to, icon: Icon, label, short }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn('flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium', isActive ? 'bg-fg/[0.08] text-text-primary' : 'text-text-muted')
            }
          >
            <Icon size={19} />
            {short ?? label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
