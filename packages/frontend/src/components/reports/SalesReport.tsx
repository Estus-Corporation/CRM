import { format, startOfMonth, subMonths } from 'date-fns';
import { HeadLabel } from '@/components/ui/HeadLabel';
import { ptBR } from 'date-fns/locale';
import { ArrowDownRight, ArrowUpRight, CalendarCheck, CalendarRange, Layers, Receipt, Trophy, Wallet, Briefcase, CalendarDays, Percent, TrendingUp } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { useFunnel, useRevenue } from '@/hooks/useReports';
import { CardHeader } from '@/components/dashboard/CardHeader';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

/** Opções do seletor Mensal/Semanal (fica na linha das abas da página de Relatórios) */
export const SALES_PERIODS = [
  { value: 'month' as const, label: 'Mensal' },
  { value: 'week' as const, label: 'Semanal' },
];

/** Barra fina proporcional dentro da célula (o número fica do lado) */
function Bar({ pct, className }: { pct: number; className?: string }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-fg/[0.06]">
      <span className={cn('block h-full rounded-full bg-accent-green', className)} style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }} />
    </span>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-text-muted">—</span>;
  const up = value >= 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-medium tabular-nums', up ? 'text-accent-green' : 'text-status-lost')}>
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(value)}%
    </span>
  );
}

/**
 * Relatório de vendas — o que o Dashboard não mostra: a receita período a período (com ticket médio e
 * variação) e o pipeline quebrado por etapa (participação em negócios e em valor).
 */
export function SalesReport({ period }: { period: 'month' | 'week' }) {
  const { data: revenue, isLoading } = useRevenue(period);
  const { data: funnel, isLoading: funnelLoading } = useFunnel();

  // Mensal: sempre os últimos 6 meses (meses sem venda = 0); semanal: o que o servidor manda
  const rows =
    period === 'month'
      ? Array.from({ length: 6 }, (_, k) => {
          const month = startOfMonth(subMonths(new Date(), 5 - k));
          const hit = revenue?.find((d) => format(new Date(d.period), 'yyyy-MM') === format(month, 'yyyy-MM'));
          return {
            label: format(month, "MMMM 'de' yyyy", { locale: ptBR }),
            short: format(month, 'MMM yyyy', { locale: ptBR }).replace('.', ''),
            value: Number(hit?.totalValue ?? 0),
            deals: Number(hit?.dealCount ?? 0),
          };
        })
      : (revenue ?? []).map((d) => ({
          label: `Semana de ${format(new Date(d.period), "dd 'de' MMM", { locale: ptBR })}`,
          short: format(new Date(d.period), "dd 'de' MMM", { locale: ptBR }).replace('.', ''),
          value: Number(d.totalValue),
          deals: Number(d.dealCount),
        }));

  const total = rows.reduce((s, r) => s + r.value, 0);
  const deals = rows.reduce((s, r) => s + r.deals, 0);
  const maxValue = Math.max(0, ...rows.map((r) => r.value));
  const best = rows.reduce<(typeof rows)[number] | null>((b, r) => (r.value > (b?.value ?? 0) ? r : b), null);

  const stages = [...(funnel ?? [])].sort((a, b) => a.position - b.position);
  const stageDeals = stages.reduce((s, x) => s + Number(x.deal_count), 0);
  const stageValue = stages.reduce((s, x) => s + Number(x.total_value), 0);

  return (
    <div className="space-y-5">
      {/* Resumo do intervalo: mesmos cards dos KPIs do Dashboard (sem linha de tendência) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Receita no intervalo" icon={Wallet} highlight value={brl(total)} sub={period === 'month' ? 'Últimos 6 meses' : 'Semanas com venda'} />
        <KpiCard label="Negócios ganhos" icon={Trophy} value={deals} sub={deals ? `${(deals / Math.max(rows.length, 1)).toFixed(1).replace('.', ',')} por ${period === 'month' ? 'mês' : 'semana'}` : 'Nenhum ganho ainda'} />
        <KpiCard label="Ticket médio" icon={Receipt} value={deals ? brl(total / deals) : '—'} sub="Receita por negócio ganho" />
        <KpiCard
          label={period === 'month' ? 'Melhor mês' : 'Melhor semana'}
          icon={CalendarCheck}
          value={best ? best.short : '—'}
          sub={best ? `${brl(best.value)} em receita` : 'Sem vendas no intervalo'}
        />
      </div>

      {/* Receita período a período */}
      <div className="card overflow-hidden">
        <div className="px-5 pt-5">
          <CardHeader icon={CalendarRange} title={period === 'month' ? 'Receita por mês' : 'Receita por semana'} />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : rows.length === 0 ? (
          <p className="px-5 pb-8 text-center text-sm text-text-muted">Nenhuma venda no período.</p>
        ) : (
          <div>
            <table className="data-table w-full text-sm">
              <thead>
                <tr className="border-b border-bg-border text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-5 py-3 text-left font-medium"><HeadLabel icon={CalendarDays}>Período</HeadLabel></th>
                  <th className="px-5 py-3 text-right font-medium"><HeadLabel icon={Trophy}>Ganhos</HeadLabel></th>
                  <th className="w-[34%] px-5 py-3 text-left font-medium"><HeadLabel icon={Wallet}>Receita</HeadLabel></th>
                  <th className="hidden px-5 py-3 text-right font-medium sm:table-cell"><HeadLabel icon={Receipt}>Ticket médio</HeadLabel></th>
                  <th className="hidden px-5 py-3 text-right font-medium sm:table-cell"><HeadLabel icon={TrendingUp}>vs anterior</HeadLabel></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const prev = rows[i - 1];
                  const delta = prev && prev.value > 0 ? Math.round(((r.value - prev.value) / prev.value) * 100) : null;
                  return (
                    <tr key={r.label} className="border-b border-bg-border last:border-0">
                      <td className="px-5 py-3 capitalize text-text-primary">{r.label}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-text-secondary">{r.deals}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-24 flex-shrink-0 tabular-nums font-medium text-text-primary">{brl(r.value)}</span>
                          <Bar pct={maxValue ? (r.value / maxValue) * 100 : 0} />
                        </div>
                      </td>
                      <td className="hidden px-5 py-3 text-right tabular-nums text-text-secondary sm:table-cell">{r.deals ? brl(r.value / r.deals) : '—'}</td>
                      <td className="hidden px-5 py-3 text-right text-xs sm:table-cell">{i === 0 ? <span className="text-text-muted">—</span> : <Delta value={delta} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pipeline por etapa: participação em quantidade e em valor */}
      <div className="card overflow-hidden">
        <div className="p-5 pb-0">
          <CardHeader icon={Layers} title="Pipeline por etapa" />
        </div>
        {funnelLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : stages.length === 0 ? (
          <p className="px-5 pb-8 text-center text-sm text-text-muted">Nenhuma etapa no pipeline.</p>
        ) : (
          <div>
            <table className="data-table w-full text-sm">
              <thead>
                <tr className="border-b border-bg-border text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-5 py-3 text-left font-medium"><HeadLabel icon={Layers}>Etapa</HeadLabel></th>
                  <th className="px-5 py-3 text-right font-medium"><HeadLabel icon={Briefcase}>Negócios</HeadLabel></th>
                  <th className="hidden w-[22%] px-5 py-3 text-left font-medium md:table-cell"><HeadLabel icon={Percent}>% dos negócios</HeadLabel></th>
                  <th className="px-5 py-3 text-right font-medium"><HeadLabel icon={Wallet}>Valor em jogo</HeadLabel></th>
                  <th className="w-[22%] px-5 py-3 text-left font-medium"><HeadLabel icon={Percent}>% do valor</HeadLabel></th>
                  <th className="hidden px-5 py-3 text-right font-medium md:table-cell"><HeadLabel icon={Receipt}>Ticket médio</HeadLabel></th>
                </tr>
              </thead>
              <tbody>
                {stages.map((s) => {
                  const n = Number(s.deal_count);
                  const v = Number(s.total_value);
                  const pn = stageDeals ? Math.round((n / stageDeals) * 100) : 0;
                  const pv = stageValue ? Math.round((v / stageValue) * 100) : 0;
                  return (
                    <tr key={s.stage_id} className="border-b border-bg-border last:border-0">
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2 text-text-primary">
                          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: s.color || 'rgb(var(--accent-green))' }} />
                          {s.name}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-text-secondary">{n}</td>
                      <td className="hidden px-5 py-3 md:table-cell">
                        <div className="flex items-center gap-2.5">
                          <span className="w-9 flex-shrink-0 text-xs tabular-nums text-text-muted">{pn}%</span>
                          <Bar pct={pn} className="bg-text-secondary/60" />
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-medium text-text-primary">{brl(v)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-9 flex-shrink-0 text-xs tabular-nums text-text-muted">{pv}%</span>
                          <Bar pct={pv} />
                        </div>
                      </td>
                      <td className="hidden px-5 py-3 text-right tabular-nums text-text-secondary md:table-cell">{n ? brl(v / n) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-fg/[0.1] text-text-primary">
                  <td className="px-5 py-3 font-semibold">Total</td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums">{stageDeals}</td>
                  <td className="hidden px-5 py-3 md:table-cell" />
                  <td className="px-5 py-3 text-right font-semibold tabular-nums">{brl(stageValue)}</td>
                  <td className="px-5 py-3" />
                  <td className="hidden px-5 py-3 text-right tabular-nums text-text-secondary md:table-cell">{stageDeals ? brl(stageValue / stageDeals) : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
