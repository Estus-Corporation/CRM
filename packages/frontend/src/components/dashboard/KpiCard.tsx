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
    <div className={cn('card card-interactive overflow-hidden p-5', highlight && 'kpi-highlight')}>
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[13px] font-medium text-text-secondary">{label}</p>
        {Icon && (
          <span
            className={cn(
              'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] border',
              highlight
                ? 'border-accent-green/25 bg-accent-green/10 text-accent-green'
                : 'border-fg/[0.06] bg-fg/[0.03] text-text-secondary',
            )}
          >
            <Icon size={16} strokeWidth={1.75} />
          </span>
        )}
      </div>
      <p className="mt-3 truncate text-[34px] font-semibold leading-none tracking-[-0.02em] text-text-primary tabular-nums">
        {value}
      </p>
      <p className="mt-2 h-4 truncate text-[12.5px] text-text-muted">{sub ?? ''}</p>
    </div>
  );
}
