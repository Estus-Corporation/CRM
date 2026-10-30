import { BarChart3 } from 'lucide-react';
import { CardHeader } from '@/components/dashboard/CardHeader';
import { cn } from '@/lib/utils';
import { formatBRL } from '@/lib/finance';
import type { MonthSummaryDto, SummaryLine } from '@/services/finance.service';

const BAR_COLOR: Record<SummaryLine['kind'], string> = {
  revenue: 'bg-accent-green',
  tax: 'bg-accent-amber',
  expense: 'bg-fg/45',
  payroll: 'bg-status-open',
};

/** Largura da barra em % da receita (receita zero = barra vazia, sem divisão por zero) */
const widthOf = (amount: number, revenue: number) => (revenue > 0 ? Math.min(100, Math.max(0, (amount / revenue) * 100)) : 0);

function Row({ label, amount, width, barClass, strong }: { label: string; amount: number; width: number; barClass: string; strong?: boolean }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13.5px]">
        <span className={cn('truncate', strong ? 'font-semibold text-text-primary' : 'text-text-secondary')}>{label}</span>
        <span className={cn('flex-shrink-0 tabular-nums', strong ? 'font-semibold text-text-primary' : 'text-text-primary')}>{formatBRL(amount)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-fg/[0.06]">
        <div className={cn('h-full rounded-full transition-all', barClass)} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

/** "Para onde vai a receita": cada linha do resumo com barra proporcional à receita, fechando no lucro líquido */
export function ProfitFlowCard({ summary }: { summary: MonthSummaryDto }) {
  const loss = summary.netProfit < 0;
  return (
    <div className="card h-full p-5">
      <CardHeader icon={BarChart3} title="Para onde vai a receita" />
      <div className="space-y-4">
        {summary.lines.map((line) => (
          <Row key={line.key} label={line.label} amount={line.amount} width={widthOf(line.amount, summary.revenue)} barClass={BAR_COLOR[line.kind]} />
        ))}
        <div className="border-t border-fg/[0.08] pt-4">
          <Row
            label={loss ? 'Prejuízo' : 'Lucro líquido'}
            amount={summary.netProfit}
            width={widthOf(summary.netProfit, summary.revenue)}
            barClass={loss ? 'bg-status-lost' : 'bg-accent-green'}
            strong
          />
        </div>
      </div>
    </div>
  );
}
