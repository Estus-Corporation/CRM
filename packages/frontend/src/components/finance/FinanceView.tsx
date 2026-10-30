import { Landmark, PiggyBank, Receipt, Wallet } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { useFinanceSummary } from '@/hooks/useFinance';
import { formatBRL } from '@/lib/finance';
import { PartnersSplitCard } from './PartnersSplitCard';
import { PayablesCard } from './PayablesCard';
import { ProfitFlowCard } from './ProfitFlowCard';

/**
 * Painel financeiro do mês. Devolve um fragmento: os blocos ficam como filhos diretos do contêiner
 * da página (`.mobile-sections` vira um bloco por filho no celular).
 */
export function FinanceView({ month, onOpenSettings }: { month: string; onOpenSettings: () => void }) {
  const { data: summary, isLoading, isError } = useFinanceSummary(month);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }
  if (isError || !summary) {
    return <p className="py-12 text-center text-[14px] text-text-secondary">Não foi possível carregar o financeiro. Tente novamente.</p>;
  }

  if (summary.warnings.noConfig && summary.revenue === 0) {
    return (
      <EmptyState
        icon={Landmark}
        title="Financeiro ainda não configurado"
        description="Cadastre gastos, impostos e sócios para ver o lucro líquido do mês e a divisão entre os sócios."
        action={{ label: 'Configurar', onClick: onOpenSettings }}
      />
    );
  }

  const loss = summary.netProfit < 0;
  const taxPct = summary.revenue > 0 ? ((summary.taxesTotal / summary.revenue) * 100).toFixed(1).replace('.', ',') : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Receita" icon={Wallet} value={formatBRL(summary.revenue)} sub="Negócios ganhos no mês" />
        <KpiCard label="Impostos" icon={Landmark} value={formatBRL(summary.taxesTotal)} sub={taxPct ? `${taxPct}% da receita` : 'Sem receita no mês'} />
        <KpiCard
          label="Gastos + pró-labore"
          icon={Receipt}
          value={formatBRL(summary.expensesTotal + summary.proLaboreTotal)}
          sub={`A pagar: ${formatBRL(summary.pendingTotal)}`}
        />
        <KpiCard
          label="Lucro líquido"
          icon={PiggyBank}
          highlight
          value={formatBRL(summary.netProfit)}
          valueClassName={loss ? 'text-status-lost' : undefined}
          sub={loss ? 'Prejuízo no mês' : 'Depois de impostos e custos'}
        />
      </div>

      <div className="mobile-split grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
        <div>
          <ProfitFlowCard summary={summary} />
        </div>
        <div>
          <PartnersSplitCard summary={summary} onOpenSettings={onOpenSettings} />
        </div>
      </div>

      <div>
        <PayablesCard summary={summary} />
      </div>
    </>
  );
}
