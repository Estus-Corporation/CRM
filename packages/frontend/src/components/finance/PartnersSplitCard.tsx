import { AlertTriangle, Users } from 'lucide-react';
import { CardHeader } from '@/components/dashboard/CardHeader';
import { formatBRL } from '@/lib/finance';
import type { MonthSummaryDto } from '@/services/finance.service';

/** Divisão do lucro líquido entre os sócios (pró-labore já saiu como custo; aqui é o que sobra pelos percentuais) */
export function PartnersSplitCard({ summary, onOpenSettings }: { summary: MonthSummaryDto; onOpenSettings: () => void }) {
  const { distribution, warnings, netProfit } = summary;

  return (
    <div className="card h-full p-5">
      <CardHeader icon={Users} title="Divisão do lucro" />

      {distribution.length === 0 ? (
        <p className="text-[13.5px] text-text-secondary">
          Nenhum sócio cadastrado.{' '}
          <button type="button" onClick={onOpenSettings} className="font-medium text-accent-green hover:underline">
            Cadastrar sócios
          </button>
        </p>
      ) : (
        <>
          {warnings.partnersShareInvalid && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-3 py-2 text-[12.5px] text-accent-amber">
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
              <span>Os percentuais dos sócios não somam 100%. A divisão fica zerada até corrigir.</span>
            </div>
          )}
          {!warnings.partnersShareInvalid && netProfit <= 0 && <p className="mb-4 text-[13px] text-text-muted">Sem lucro a distribuir neste mês.</p>}
          <ul className="divide-y divide-fg/[0.07]">
            {distribution.map((d) => (
              <li key={d.partnerId} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-text-primary">{d.name}</p>
                  <p className="truncate text-[12px] text-text-muted">
                    {d.sharePercent}% do lucro · pró-labore {formatBRL(d.proLabore)}
                  </p>
                </div>
                <span className="flex-shrink-0 text-[15px] font-semibold tabular-nums text-text-primary">{formatBRL(d.profitShare)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
