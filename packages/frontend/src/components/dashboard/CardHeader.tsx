import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/** Cabeçalho dos cards do dashboard: ícone no mesmo quadrado verde dos KPIs + título + ação à direita. */
export function CardHeader({ icon: Icon, title, action }: { icon: LucideIcon; title: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px] border border-accent-green/20 bg-gradient-to-br from-accent-green/[0.22] to-accent-green/[0.06] text-accent-green shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <Icon size={17} strokeWidth={1.9} />
        </span>
        <p className="truncate text-[15.5px] font-semibold text-text-primary">{title}</p>
      </div>
      {action}
    </div>
  );
}

/** Botão discreto de ação no canto do card (ex.: "Ver todas"). */
export function CardAction({ children }: { children: ReactNode }) {
  return (
    <span className="flex-shrink-0 rounded-lg border border-fg/[0.1] bg-fg/[0.03] px-3 py-1.5 text-[12.5px] font-medium text-text-secondary transition-colors hover:border-fg/[0.18] hover:text-text-primary">
      {children}
    </span>
  );
}
