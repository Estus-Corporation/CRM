import { ChevronLeft, ChevronRight } from 'lucide-react';
import { currentMonth, formatMonth, shiftMonth } from '@/lib/finance';

const ARROW =
  'flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-fg/[0.06] hover:text-text-primary disabled:pointer-events-none disabled:opacity-30';

/** `‹ Out/2026 ›` — o mês seguinte ao atual fica bloqueado (não há resultado a projetar) */
export function MonthNavigator({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  return (
    <div className="flex h-10 w-fit items-center gap-0.5 rounded-xl border border-fg/[0.12] bg-fg/[0.05] px-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <button type="button" aria-label="Mês anterior" className={ARROW} onClick={() => onChange(shiftMonth(month, -1))}>
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-[92px] text-center text-[13.5px] font-medium tabular-nums text-text-primary">{formatMonth(month)}</span>
      <button type="button" aria-label="Próximo mês" className={ARROW} disabled={month >= currentMonth()} onClick={() => onChange(shiftMonth(month, 1))}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
