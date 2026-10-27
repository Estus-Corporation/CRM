import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Inbox, PhoneCall, Wallet } from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMyStats } from '@/hooks/useCaptacao';
import { useChartColors } from '@/hooks/useChartColors';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { CALL_STATUS, CALL_STATUS_ORDER, formatBRL } from '@/lib/captacao';
import type { CallStatus, CaptadorPeriodTotals } from '@/services/captacao.service';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

type Period = 'week' | 'month';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
];

/** "+3 vs. semana anterior" — o sinal e a cor dizem se melhorou */
function delta(current: number, previous: number, period: Period, money = false) {
  const diff = current - previous;
  const label = period === 'week' ? 'semana anterior' : 'mês anterior';
  if (diff === 0) return `Igual à ${label}`;
  const amount = money ? formatBRL(Math.abs(diff)) : Math.abs(diff);
  return `${diff > 0 ? '+' : '−'}${amount} vs. ${label}`;
}

const rate = (t: CaptadorPeriodTotals) => (t.called ? Math.round((t.meetings / t.called) * 100) : 0);

function ChartCard({
  title,
  subtitle,
  aside,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('card p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[17px] font-semibold text-text-primary sm:text-[15px] sm:font-medium">{title}</p>
          {subtitle && <p className="mt-0.5 text-[13px] text-text-muted sm:text-xs">{subtitle}</p>}
        </div>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

/** Legenda com o total do período de cada série */
function SeriesTotal({ color, label, value, line }: { color: string; label: string; value: number; line?: boolean }) {
  return (
    <div className="rounded-xl border border-fg/[0.06] bg-fg/[0.03] px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
        <span className={cn(line ? 'h-0.5 w-3 rounded-full' : 'h-2 w-2 rounded-[3px]')} style={{ background: color }} />
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-text-primary">{value}</p>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string; payload?: { label?: string } }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel min-w-[150px] px-3.5 py-2.5 text-xs">
      {/* Rótulo completo ("ter 20") mesmo quando o eixo do celular mostra só o dia */}
      <p className="mb-1.5 font-medium uppercase tracking-wide text-text-secondary">{payload[0]?.payload?.label ?? label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center justify-between gap-4 text-text-primary">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Funil afunilando de verdade: faixas centralizadas, largura relativa ao 1º passo, número dentro
 * da faixa e a conversão entre um passo e o próximo num selo no meio.
 */
function Funnel({ steps }: { steps: { stage: string; value: number }[] }) {
  const top = steps[0]?.value || 0;
  if (!top) return <p className="py-10 text-center text-sm text-text-muted">Nenhum lead recebido no período</p>;
  const total = Math.round(((steps[steps.length - 1]?.value ?? 0) / top) * 100);
  return (
    <div>
      <ul className="space-y-1">
        {steps.map((s, i) => {
          const prev = steps[i - 1]?.value;
          const conv = i > 0 && prev ? Math.round((s.value / prev) * 100) : null;
          // Mínimo de 28% pra caber o número mesmo em passos pequenos
          const width = Math.max((s.value / top) * 100, 28);
          return (
            <li key={s.stage}>
              {conv !== null && (
                <div className="flex justify-center py-1">
                  <span className="rounded-full bg-fg/[0.05] px-2 py-0.5 text-[10.5px] font-medium tabular-nums text-text-muted">
                    ↓ {conv}%
                  </span>
                </div>
              )}
              <div className="grid grid-cols-[88px_1fr] items-center gap-3">
                <span className="text-sm text-text-secondary">{s.stage}</span>
                <div
                  className="mx-auto flex h-10 items-center justify-center rounded-xl text-sm font-semibold tabular-nums transition-[width] duration-700 ease-out"
                  style={{
                    width: `${width}%`,
                    background: `linear-gradient(90deg, rgb(var(--accent-green) / ${0.32 - i * 0.06}), rgb(var(--accent-green) / ${0.6 - i * 0.1}), rgb(var(--accent-green) / ${0.32 - i * 0.06}))`,
                    boxShadow: 'inset 0 0 0 1px rgb(var(--accent-green) / 0.25)',
                  }}
                >
                  <span className="text-text-primary">{s.value}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 border-t border-fg/[0.06] pt-3 text-center text-xs text-text-muted">
        <strong className="font-semibold text-accent-green">{total}%</strong> dos leads recebidos viraram negócio fechado
      </p>
    </div>
  );
}

/** Painel do captador: produção da semana/mês, com gráficos — o "dashboard" de quem liga */
export function MyDashboardPage() {
  const [period, setPeriod] = useState<Period>('week');
  const { data: stats, isLoading } = useMyStats(period);
  const firstName = useAuthStore((s) => s.user?.full_name?.split(' ')[0]);
  const c = useChartColors();

  // Cores SVG por resultado (Recharts não resolve var(--x))
  const STATUS_COLOR: Record<CallStatus, string> = {
    pending: c.axisMuted,
    no_answer: c.axis,
    callback: c.amber,
    meeting: c.brand,
    lost: '#E5484D',
  };

  const cur = stats?.current;
  const prev = stats?.previous;
  const isMobile = useIsMobile();
  const daily = (stats?.daily ?? []).map((d) => ({
    ...d,
    label: format(parseISO(d.day), period === 'week' ? 'EEE dd' : 'dd/MM', { locale: ptBR }),
    // Eixo do celular: só o dia ("20"), pra 7 rótulos caberem sem encavalar
    short: format(parseISO(d.day), 'dd'),
  }));
  const statusData = stats
    ? CALL_STATUS_ORDER.map((s) => ({ key: s, name: CALL_STATUS[s].label, value: stats.byStatus[s] })).filter((d) => d.value > 0)
    : [];
  const statusTotal = statusData.reduce((sum, d) => sum + d.value, 0);

  return (
    // mobile-sections: no celular cada bloco vira um card translúcido separado (ver globals.css)
    <div className="mobile-sections space-y-5 max-md:space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">Olá{firstName ? `, ${firstName}` : ''}</p>
          <h1 className="page-title mt-1">Seu desempenho</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            {period === 'week' ? 'Últimos 7 dias' : 'Últimos 30 dias'}, comparado ao período anterior
          </p>
        </div>
        <SegmentedControl layoutId="my-dashboard-period" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      </div>

      {isLoading || !cur || !prev ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <KpiCard
            label="Reuniões"
            icon={CalendarCheck}
            highlight
            value={cur.meetings}
            sub={delta(cur.meetings, prev.meetings, period)}
          />
          <KpiCard label="Ligações feitas" icon={PhoneCall} value={cur.called} sub={`${rate(cur)}% viraram reunião`} />
          <KpiCard label="Leads recebidos" icon={Inbox} value={cur.received} sub={delta(cur.received, prev.received, period)} />
          <KpiCard
            label="Comissão"
            icon={Wallet}
            value={formatBRL(cur.commission)}
            sub={`${cur.won} negócio${cur.won !== 1 ? 's' : ''} fechado${cur.won !== 1 ? 's' : ''}`}
          />
        </div>
      )}

      {/* div: no celular vira o bloco translúcido e o card fica dentro (ver .mobile-sections) */}
      <div>
        <ChartCard
          title="Atividade por dia"
          subtitle="Leads recebidos, ligações feitas e reuniões marcadas"
          aside={
            cur && (
              <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">
                <SeriesTotal color={c.axisMuted} label="Recebidos" value={cur.received} />
                <SeriesTotal color={c.brand} label="Ligações" value={cur.called} />
                <SeriesTotal color={c.amber} label="Reuniões" value={cur.meetings} line />
              </div>
            )
          }
        >
          {isLoading ? (
            <Skeleton className="h-[260px] rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={isMobile ? 220 : 260}>
              <ComposedChart data={daily} margin={{ top: 8, right: 4, left: isMobile ? -28 : -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="calledFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.brand} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={c.brand} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="receivedBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.axisMuted} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={c.axisMuted} stopOpacity={0.12} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis
                  dataKey={isMobile ? 'short' : 'label'}
                  tick={{ fill: c.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                  interval={period === 'month' ? (isMobile ? 6 : 4) : 0}
                />
                <YAxis allowDecimals={false} tick={{ fill: c.axisMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: c.cursor, radius: 8 }} />
                <Bar dataKey="received" name="Recebidos" fill="url(#receivedBar)" radius={[6, 6, 2, 2]} maxBarSize={28} />
                <Area
                  dataKey="called"
                  name="Ligações"
                  type="monotone"
                  stroke={c.brand}
                  strokeWidth={2.5}
                  fill="url(#calledFill)"
                  dot={false}
                  activeDot={{ r: 5, fill: c.brand, stroke: 'rgb(0 0 0 / 0.35)', strokeWidth: 2 }}
                />
                <Line
                  dataKey="meetings"
                  name="Reuniões"
                  type="monotone"
                  stroke={c.amber}
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  dot={{ r: 3.5, fill: c.amber, strokeWidth: 0 }}
                  activeDot={{ r: 5.5, fill: c.amber, stroke: 'rgb(0 0 0 / 0.35)', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* mobile-split: no celular cada gráfico tem o próprio bloco (cada div = bloco, card dentro) */}
      <div className="mobile-split grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
        <div>
          <ChartCard
            title="Funil do período"
            subtitle="Dos leads que você recebeu, até onde cada um chegou e quanto passou de uma etapa para a outra"
            className="h-full"
          >
            {isLoading || !stats ? <Skeleton className="h-[180px] rounded-xl" /> : <Funnel steps={stats.funnel} />}
          </ChartCard>
        </div>

        <div>
          <ChartCard className="h-full" title="Resultado das ligações" subtitle="Situação atual dos leads recebidos no período">
            {isLoading ? (
              <Skeleton className="h-[180px] rounded-xl" />
            ) : statusTotal === 0 ? (
              <p className="py-10 text-center text-sm text-text-muted">Nenhum lead recebido no período</p>
            ) : (
              // Celular: rosca centralizada e a legenda embaixo na largura toda; desktop: lado a lado
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:flex-wrap sm:gap-6">
                <div className="relative h-[180px] w-[180px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={84}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {statusData.map((d) => (
                          <Cell key={d.key} fill={STATUS_COLOR[d.key]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-semibold tabular-nums text-text-primary">{statusTotal}</span>
                    <span className="text-[11px] text-text-muted">leads</span>
                  </div>
                </div>
                <ul className="w-full space-y-2 text-sm sm:w-auto sm:min-w-[160px] sm:flex-1">
                  {statusData.map((d) => (
                    <li key={d.key} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-text-secondary">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[d.key] }} />
                        {d.name}
                      </span>
                      <span className="tabular-nums text-text-primary">
                        {d.value} <span className="text-xs text-text-muted">({Math.round((d.value / statusTotal) * 100)}%)</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </ChartCard>
        </div>
      </div>

      <p className="text-center text-xs text-text-muted">
        Os leads do dia ficam em{' '}
        <Link to="/meus-leads" className="font-medium text-accent-green hover:underline">
          Meus leads
        </Link>
        .
      </p>
    </div>
  );
}
