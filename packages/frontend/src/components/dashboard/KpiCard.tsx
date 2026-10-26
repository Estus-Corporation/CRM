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

export function KpiCard({ label, value, sub, icon: Icon, highlight }: KpiCardProps) {
  return (
    <div className={cn('card card-interactive overflow-hidden py-4 pl-5 pr-4 sm:p-5', highlight && 'kpi-highlight')}>
      <div className="flex items-center justify-between gap-3">
        {/* Celular: sem o ícone, o rótulo usa a largura toda e quebra em 2 linhas se precisar */}
        <p className="text-[15.5px] font-semibold leading-tight text-text-primary max-sm:line-clamp-2 sm:truncate sm:text-[13px] sm:font-medium sm:leading-snug sm:text-text-secondary">
          {label}
        </p>
        {Icon && (
          <span
            className={cn(
              'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] border max-sm:hidden',
              highlight
                ? 'border-accent-green/25 bg-accent-green/10 text-accent-green'
                : 'border-fg/[0.06] bg-fg/[0.03] text-text-secondary',
            )}
          >
            <Icon size={16} strokeWidth={1.75} />
          </span>
        )}
      </div>
      <p className="mt-2.5 truncate text-[26px] font-semibold sm:mt-3 sm:text-[34px] leading-none tracking-[-0.02em] text-text-primary tabular-nums">
        {value}
      </p>
      <p className="mt-2 truncate text-[13px] leading-snug text-text-secondary max-sm:line-clamp-2 max-sm:whitespace-normal sm:h-4 sm:text-[12.5px] sm:text-text-muted">
        {sub ?? ''}
      </p>
    </div>
  );
}
