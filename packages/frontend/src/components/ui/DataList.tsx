import type { ReactNode } from 'react';
import { AnimatePresence, motion, type Transition } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';

/**
 * Lista em card único — o estilo da tela de Contatos, reutilizado em Negócios, Relatórios, Equipe...
 * - Cabeçalho verde (mesmo verde do botão principal) com faixa inferior mais escura
 * - Linhas divididas por traço de 1,5px; entrada em cascata saindo do blur
 * - Ao filtrar: linhas que saem deslizam e somem, as que ficam se reorganizam, o card ajusta a altura
 *
 * `grid` é a classe de grade (grid-cols-...) compartilhada por cabeçalho e linhas, pra alinhar colunas.
 */

export const listSpring: Transition = { type: 'spring', visualDuration: 0.45, bounce: 0.12 };

export function DataList({
  children,
  className,
  outlined = true,
}: {
  children: ReactNode;
  className?: string;
  /** false: sem o contorno verde externo (telas de Captação) */
  outlined?: boolean;
}) {
  return (
    // layout + borderRadius no style: altura anima suave e o framer corrige a distorção dos cantos
    <motion.div
      layout
      className={cn('card data-list-glass overflow-hidden', outlined ? 'data-list-card' : 'data-list-plain', className)}
      style={{ borderRadius: 16 }}
      transition={listSpring}
    >
      {children}
    </motion.div>
  );
}

export function DataListHead({ grid, children }: { grid: string; children: ReactNode }) {
  return (
    <motion.div
      layout="position"
      className={cn(
        // data-list-head: gancho pra variações da lista (ex.: .data-list-glass em Contatos)
        'data-list-head grid items-center gap-4 border-b-[6px] border-accent-green-dim bg-accent-green px-4 py-3',
        'text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgb(var(--on-accent))]',
        grid,
      )}
    >
      {children}
    </motion.div>
  );
}

export function DataListBody({ children }: { children: ReactNode }) {
  return (
    <ul className="relative">
      <AnimatePresence mode="popLayout" initial>
        {children}
      </AnimatePresence>
    </ul>
  );
}

interface DataListRowProps {
  grid: string;
  index: number;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}

export function DataListRow({ grid, index, onClick, className, children }: DataListRowProps) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
      animate={{
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        // Cascata na entrada; teto pra listas longas não demorarem
        transition: { ...listSpring, delay: Math.min(index * 0.045, 0.4) },
      }}
      exit={{ opacity: 0, x: -12, filter: 'blur(4px)', transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
      transition={listSpring}
      onClick={onClick}
      className={cn(
        'group grid items-center gap-4 border-b-[1.5px] border-fg/[0.14] px-4 py-3.5 transition-colors duration-200 last:border-0',
        onClick && 'cursor-pointer hover:bg-fg/[0.03]',
        grid,
        className,
      )}
    >
      {children}
    </motion.li>
  );
}

/** Esqueleto de carregamento no mesmo formato (card + linhas divididas). `cells` = nº de colunas. */
export function DataListSkeleton({ grid, cells, rows = 6 }: { grid: string; cells: number; rows?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="h-[46px] border-b-[6px] border-accent-green-dim/40 bg-accent-green/40" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={cn('grid items-center gap-4 border-b-[1.5px] border-fg/[0.14] px-4 py-4 last:border-0', grid)}>
          {Array.from({ length: cells }).map((__, c) =>
            c === 0 ? (
              <div key={c} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 flex-shrink-0 rounded-full" />
                <Skeleton className="h-3.5 w-36" />
              </div>
            ) : (
              <Skeleton key={c} className="h-3.5 w-20" />
            ),
          )}
        </div>
      ))}
    </div>
  );
}
