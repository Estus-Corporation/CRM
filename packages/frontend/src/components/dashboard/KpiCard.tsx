import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  /** KPI principal da tela — recebe um brilho verde discreto */
  highlight?: boolean;
}

/**
 * Card de indicador: ícone num quadrado arredondado à esquerda, e ao lado rótulo, valor e descrição.
 * Celular (2 colunas estreitas): o ícone sobe e o texto usa a largura toda.
 */
export function KpiCard({ label, value, sub, icon: Icon, highlight }: KpiCardProps) {
  return (
    <div className={cn('card card-interactive flex gap-4 overflow-hidden p-4 max-sm:flex-col max-sm:gap-3 sm:items-center sm:p-5', highlight && 'kpi-highlight')}>
      {Icon && (
        <span
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] border border-accent-green/20 bg-gradient-to-br from-accent-green/[0.22] to-accent-green/[0.06] text-accent-green shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:h-12 sm:w-12 sm:rounded-[14px]"
        >
          <Icon size={20} strokeWidth={1.9} className="sm:h-[22px] sm:w-[22px]" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium leading-snug text-text-secondary max-sm:line-clamp-2 max-sm:whitespace-normal">
          {label}
        </p>
        <p className="mt-1.5 truncate text-[24px] font-semibold leading-none tracking-[-0.02em] text-text-primary tabular-nums sm:text-[28px]">
          {value}
        </p>
        <p className="mt-1.5 truncate text-[12px] leading-snug text-text-muted max-sm:line-clamp-2 max-sm:whitespace-normal sm:h-4">
          {sub ?? ''}
        </p>
      </div>
    </div>
  );
}
