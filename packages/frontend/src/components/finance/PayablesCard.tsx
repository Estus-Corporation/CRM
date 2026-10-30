import { CalendarClock, Check } from 'lucide-react';
import { CardHeader } from '@/components/dashboard/CardHeader';
import { Badge } from '@/components/ui/Badge';
import { useSetPayment } from '@/hooks/useFinance';
import { formatBRL } from '@/lib/finance';
import { cn } from '@/lib/utils';
import type { MonthSummaryDto, Payable } from '@/services/finance.service';

const STATUS: Record<Payable['status'], { label: string; variant: 'green' | 'manager' | 'red' }> = {
  paid: { label: 'Paga', variant: 'green' },
  pending: { label: 'Pendente', variant: 'manager' },
  overdue: { label: 'Atrasada', variant: 'red' },
};

/** '2026-10-05' → '05/10' */
const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Contas a pagar do mês: o check marca/desmarca a ocorrência como paga (não muda o lucro, só o saldo a pagar) */
export function PayablesCard({ summary }: { summary: MonthSummaryDto }) {
  const setPayment = useSetPayment();

  return (
    <div className="card p-5">
      <CardHeader icon={CalendarClock} title="Contas a pagar" />
      {summary.payables.length === 0 ? (
        <p className="py-4 text-center text-[13.5px] text-text-muted">Nenhuma conta neste mês</p>
      ) : (
        <ul className="divide-y divide-fg/[0.07]">
          {summary.payables.map((p) => {
            const paid = p.status === 'paid';
            const status = STATUS[p.status];
            return (
              <li key={p.expenseId} className="flex items-center gap-3 py-3">
                <button
                  type="button"
                  aria-label={paid ? 'Marcar como pendente' : 'Marcar como paga'}
                  aria-pressed={paid}
                  disabled={setPayment.isPending}
                  onClick={() => setPayment.mutate({ id: p.expenseId, month: summary.month, paid: !paid })}
                  className={cn(
                    'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-60',
                    paid ? 'border-accent-green bg-accent-green text-[rgb(var(--on-accent))]' : 'border-fg/[0.2] hover:border-accent-green/60',
                  )}
                >
                  {paid && <Check size={14} strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-[14px] font-medium', paid ? 'text-text-muted line-through' : 'text-text-primary')}>{p.description}</p>
                  <p className="truncate text-[12px] text-text-muted">
                    {p.category} · vence {shortDate(p.dueDate)}
                  </p>
                </div>
                <Badge variant={status.variant} className="max-sm:hidden">
                  {status.label}
                </Badge>
                <span className="flex-shrink-0 text-[14px] font-medium tabular-nums text-text-primary">{formatBRL(p.amount)}</span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-fg/[0.08] pt-3 text-[13.5px]">
        <span className="text-text-secondary">A pagar</span>
        <span className={cn('font-semibold tabular-nums', summary.pendingTotal > 0 ? 'text-accent-amber' : 'text-text-primary')}>{formatBRL(summary.pendingTotal)}</span>
      </div>
    </div>
  );
}
