import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sparkline } from './Sparkline';

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  /** KPI principal da tela — recebe um brilho verde discreto */
  highlight?: boolean;
  /** Série dos últimos meses (o atual por último): linha de tendência + variação vs mês anterior */
  trend?: number[];
  /** true quando subir é ruim (ex.: ciclo de venda) — inverte a cor da variação */
  lowerIsBetter?: boolean;
  /** Variação já calculada (%) — substitui a do `trend`; null = sem base ("novo") */
  change?: number | null;
  /** Texto do title da etiqueta de variação */
  changeLabel?: string;
  /** false = só a etiqueta de variação, sem a linha de tendência (Relatórios) */
  sparkline?: boolean;
}

/** Variação do último ponto vs o anterior, em %. null = sem base (mês anterior zerado). */
function variation(trend?: number[]) {
  if (!trend || trend.length < 2) return undefined;
  const last = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  if (prev === 0) return last === 0 ? 0 : null;
  return Math.round(((last - prev) / prev) * 100);
}

/**
 * Card de indicador: ícone num quadrado arredondado à esquerda, e ao lado rótulo, valor e descrição.
 * Celular (2 colunas estreitas): o ícone sobe e o texto usa a largura toda.
 */
export function KpiCard({ label, value, sub, icon: Icon, highlight, trend, lowerIsBetter, change, changeLabel, sparkline = true }: KpiCardProps) {
  const delta = change !== undefined ? change : variation(trend);
  const up = (delta ?? 0) >= 0;
  const good = lowerIsBetter ? !up || delta === 0 : up;
  return (
    <div className={cn('card card-interactive relative flex gap-4 overflow-hidden p-4 max-sm:flex-col max-sm:gap-3 sm:items-center sm:p-5', highlight && 'kpi-highlight')}>
      {/* Variação vs mês anterior — seta colorida pelo que é bom/ruim; o número em tinta de texto */}
      {delta !== undefined && (
        <span
          className="absolute right-3 top-3 flex items-center gap-0.5 rounded-md border border-fg/[0.08] bg-fg/[0.04] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-text-primary"
          title={changeLabel ?? 'Variação em relação ao mês anterior'}
        >
          {up ? (
            <ArrowUpRight size={12} strokeWidth={2.4} className={good ? 'text-accent-green' : 'text-status-lost'} />
          ) : (
            <ArrowDownRight size={12} strokeWidth={2.4} className={good ? 'text-accent-green' : 'text-status-lost'} />
          )}
          {delta === null ? 'novo' : `${Math.abs(delta)}%`}
        </span>
      )}
      {Icon && (
        <span
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] border border-accent-green/20 bg-gradient-to-br from-accent-green/[0.22] to-accent-green/[0.06] text-accent-green shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:h-12 sm:w-12 sm:rounded-[14px]"
        >
          <Icon size={20} strokeWidth={1.9} className="sm:h-[22px] sm:w-[22px]" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        {/* pr no rótulo: só ele divide a linha com a etiqueta de variação */}
        <p className={cn('truncate text-[12.5px] font-medium leading-snug text-text-secondary max-sm:line-clamp-2 max-sm:whitespace-normal', delta !== undefined && 'pr-14')}>
          {label}
        </p>
        {/* Número e linha de tendência na mesma linha */}
        <div className="mt-1.5 flex items-end justify-between gap-2">
          <p className="truncate text-[24px] font-semibold leading-none tracking-[-0.02em] text-text-primary sm:text-[28px]">
            {value}
          </p>
          {trend && sparkline && (
            <div className="pointer-events-none -mb-1 flex-shrink-0 max-sm:hidden">
              <Sparkline data={trend} width={76} height={28} />
            </div>
          )}
        </div>
        <p className="mt-1.5 truncate text-[12px] leading-snug text-text-muted max-sm:line-clamp-2 max-sm:whitespace-normal sm:h-4">
          {sub ?? ''}
        </p>
      </div>
    </div>
  );
}
