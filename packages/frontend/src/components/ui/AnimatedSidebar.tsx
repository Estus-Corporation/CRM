import { createContext, useContext, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion, type Transition } from 'framer-motion';
import * as Tooltip from '@radix-ui/react-tooltip';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SilkShader } from './SilkShader';

// Animações sempre ligadas: em máquinas com "efeitos de animação" do Windows desligados o navegador
// reporta prefers-reduced-motion e o framer-motion cortava hover, deslize e fades do menu.
export const SIDEBAR_COLLAPSED = 72;
export const SIDEBAR_EXPANDED = 264;
/** Altura do rodapé do menu — a faixa de vidro que atravessa a base do app usa a mesma */
export const SIDEBAR_FOOTER_HEIGHT = 128;

const EASE = [0.22, 1, 0.36, 1] as const;
// Mola física sem bounce: o painel e o conteúdo ao lado assentam juntos, sem tranco
const panelSpring: Transition = { type: 'spring', visualDuration: 0.45, bounce: 0 };
// Hover dos botões: mola macia, assenta devagar
const hoverSpring: Transition = { type: 'spring', stiffness: 260, damping: 26, mass: 0.8 };
// Fundo do item ativo deslizando entre itens
const pillSpring: Transition = { type: 'spring', visualDuration: 0.38, bounce: 0.12 };

interface SidebarContextProps {
  /** rótulos visíveis */
  expanded: boolean;
  /** id do grupo de layout — separa o indicador ativo do desktop e do mobile */
  layoutGroup: string;
}

const SidebarContext = createContext<SidebarContextProps>({ expanded: true, layoutGroup: 'desktop' });

export const useSidebar = () => useContext(SidebarContext);

/**
 * Fundo do menu: shader "Silk" com blur leve + película escura pra legibilidade.
 * Largura fixa (expandida) — recolher só recorta, não redimensiona nem reinicia o shader.
 */
function SidebarSurface() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden" style={{ width: SIDEBAR_EXPANDED }}>
      <SilkShader className="absolute inset-[-12px] h-[calc(100%+24px)] w-[calc(100%+24px)] blur-[6px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#03120E]/70 via-[#03120E]/58 to-[#03120E]/72" />
    </div>
  );
}

/**
 * Desktop: painel no fluxo do layout — ao recolher/expandir, o conteúdo ao lado acompanha.
 * Os filhos ficam num wrapper de largura fixa, então só a largura externa anima e nada
 * dentro do painel sofre relayout durante a transição.
 */
export function DesktopSidebar({
  children,
  expanded,
  className,
}: {
  children: ReactNode;
  expanded: boolean;
  className?: string;
}) {
  return (
    <MotionConfig reducedMotion="never">
      <Tooltip.Provider delayDuration={250} skipDelayDuration={100}>
        <SidebarContext.Provider value={{ expanded, layoutGroup: 'desktop' }}>
          <motion.aside
            className={cn(
              // Translúcido: o fundo ambiente do app aparece de leve através do menu
              // Transparente: o shader "Silk" de fundo é do AppShell e passa contínuo por trás do menu
              'force-dark sidebar-ink relative z-20 hidden h-full flex-shrink-0 overflow-hidden md:block',
              className,
            )}
            initial={false}
            animate={{ width: expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED }}
            transition={panelSpring}
          >
            <div className="relative flex h-full flex-col" style={{ width: SIDEBAR_EXPANDED }}>
              {children}
            </div>
          </motion.aside>
        </SidebarContext.Provider>
      </Tooltip.Provider>
    </MotionConfig>
  );
}

/** Mobile: gaveta deslizante, sempre com rótulos visíveis. */
export function MobileSidebar({
  children,
  open,
  onClose,
}: {
  children: ReactNode;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <MotionConfig reducedMotion="never">
      <AnimatePresence>
        {open && (
          <SidebarContext.Provider value={{ expanded: true, layoutGroup: 'mobile' }}>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              onClick={onClose}
            />
            <motion.aside
              key="drawer"
              className="force-dark sidebar-ink fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden border-r border-fg/[0.08] bg-[#03120E] md:hidden"
              style={{ width: SIDEBAR_EXPANDED }}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', visualDuration: 0.45, bounce: 0 }}
            >
              <button
                onClick={onClose}
                className="absolute right-3 top-4 z-10 rounded-md p-1.5 text-text-muted transition-colors hover:bg-fg/[0.05] hover:text-text-primary"
                aria-label="Fechar menu"
              >
                <X size={18} />
              </button>
              <SidebarSurface />
              <div className="relative flex h-full flex-col">{children}</div>
            </motion.aside>
          </SidebarContext.Provider>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

/** Conteúdo que só aparece com o painel expandido. */
export function SidebarLabel({ children, className }: { children: ReactNode; className?: string }) {
  const { expanded } = useSidebar();
  return (
    <motion.span
      initial={false}
      animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -6 }}
      transition={expanded ? { duration: 0.35, delay: 0.1, ease: EASE } : { duration: 0.15, ease: EASE }}
      className={cn('whitespace-nowrap', className)}
      aria-hidden={!expanded}
    >
      {children}
    </motion.span>
  );
}

/** Título de grupo; no modo recolhido vira um divisor discreto. Mesma altura nos dois estados. */
export function SidebarSection({ title, children }: { title: string; children: ReactNode }) {
  const { expanded } = useSidebar();
  return (
    <div className="flex flex-col gap-0.5">
      <div className="relative flex h-8 items-center px-3.5">
        <SidebarLabel className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
          {title}
        </SidebarLabel>
        <motion.span
          className="absolute left-[10px] top-1/2 h-px w-7 bg-bg-border"
          initial={false}
          animate={{ opacity: expanded ? 0 : 1 }}
          transition={{ duration: 0.25, ease: EASE }}
        />
      </div>
      {children}
    </div>
  );
}

/** Tooltip lateral, só no modo recolhido. Renderizado em portal pra escapar do overflow do painel. */
export function SidebarTooltip({ label, children }: { label: string; children: ReactNode }) {
  const { expanded } = useSidebar();
  return (
    <Tooltip.Root open={expanded ? false : undefined}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={14}
          className="z-[60] rounded-md border border-bg-border bg-bg-surface px-2.5 py-1.5 text-[13px] font-medium text-text-primary shadow-lg shadow-black/40"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

interface SidebarLinkProps {
  to: string;
  label: string;
  icon: ReactNode;
  onNavigate?: () => void;
}

export function SidebarLink({ to, label, icon, onNavigate }: SidebarLinkProps) {
  const { layoutGroup } = useSidebar();
  return (
    <SidebarTooltip label={label}>
      <NavLink to={to} onClick={onNavigate} className="group/link block rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-accent-green/40">
        {({ isActive }) => (
          <motion.div
            className={cn(
              // origin no centro do ícone: no modo recolhido o ícone cresce no lugar, sem deslizar
              'relative flex h-11 origin-[24px_50%] items-center gap-3.5 rounded-[10px] px-3.5',
              'text-[14.5px] font-medium transition-colors duration-300 ease-out',
              isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={hoverSpring}
          >
            {!isActive && (
              <span className="absolute inset-0 rounded-[10px] bg-fg/[0.04] opacity-0 transition-opacity duration-300 ease-out group-hover/link:opacity-100" />
            )}
            {isActive && (
              <motion.span
                layoutId={`sidebar-active-${layoutGroup}`}
                className="absolute inset-0 rounded-[10px] bg-fg/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                transition={pillSpring}
              >
                <span className="brand-bar absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full" />
              </motion.span>
            )}
            <span
              className={cn(
                'relative flex h-5 w-5 flex-shrink-0 items-center justify-center transition-colors duration-300',
                isActive ? 'text-accent-green' : 'text-text-secondary group-hover/link:text-text-primary',
              )}
            >
              {icon}
            </span>
            <SidebarLabel className="relative">{label}</SidebarLabel>
          </motion.div>
        )}
      </NavLink>
    </SidebarTooltip>
  );
}
