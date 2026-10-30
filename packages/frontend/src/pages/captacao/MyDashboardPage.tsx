import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  CalendarCheck,
  Filter,
  Inbox,
  PhoneCall,
  PieChart as PieIcon,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Area,
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
import { FunnelChart } from '@/components/dashboard/FunnelChart';
import { CardAction, CardHeader } from '@/components/dashboard/CardHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { usePageSubtitle } from '@/store/pageStore';

type Period = 'week' | 'month';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
];

type DailyPoint = { label: string; short: string; received: number; called: number; meetings: number };

/** Variação % do período atual vs o anterior (null = anterior zerado: "novo") */
function change(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

const rate = (t: CaptadorPeriodTotals) => (t.called ? Math.round((t.meetings / t.called) * 100) : 0);

/** Divisões inteiras redondas pra 3 faixas acima de zero (mesma ideia do RevenueChart) */
function countTicks(max: number) {
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500].find((st) => st * 3 >= max) ?? Math.ceil(max / 3);
  return [0, step, step * 2, step * 3];
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
    <div className="glass-panel min-w-[150px] px-3.5 py-2.5">
      {/* Rótulo completo ("ter 20") mesmo quando o eixo do celular mostra só o dia */}
      <p className="text-[11px] font-medium capitalize text-text-muted">{payload[0]?.payload?.label ?? label}</p>
      {payload.map((p) => (
        <p key={p.name} className="mt-1 flex items-center justify-between gap-4 text-[12.5px] text-text-primary">
          <span className="flex items-center gap-1.5 text-text-secondary">
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
 * Atividade por dia no estilo da "Receita ao longo do tempo": número em destaque + variação,
 * grade completa, área verde com brilho (recebidos) e linhas discretas (ligações, reuniões).
 */
function ActivityChart({
  daily,
  cur,
  prev,
  period,
}: {
  daily: DailyPoint[];
  cur: CaptadorPeriodTotals;
  prev: CaptadorPeriodTotals;
  period: Period;
}) {
  const c = useChartColors();
  const isMobile = useIsMobile();
  const id = useId().replace(/:/g, '');
  const delta = change(cur.received, prev.received);
  const ticks = countTicks(Math.max(0, ...daily.flatMap((d) => [d.received, d.called, d.meetings])));
  const axisTick = { fill: c.axisMuted, fontSize: 11 };
  const ringDot = (color: string, r = 3.5) => ({ r, fill: color, stroke: c.surface, strokeWidth: 2 });
  const glow = `url(#${id}-glow)`;

  return (
    <div>
      {/* Número principal */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <p className="text-[32px] font-semibold leading-none tracking-[-0.02em] text-text-primary">{cur.received}</p>
          <p className="mt-1.5 text-[12.5px] text-text-muted">
            {cur.received === 1 ? 'lead recebido' : 'leads recebidos'} · {cur.called} {cur.called === 1 ? 'ligação' : 'ligações'} ·{' '}
            {cur.meetings} {cur.meetings === 1 ? 'reunião' : 'reuniões'}
          </p>
        </div>
        {delta !== null && delta !== 0 && (
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium text-text-primary',
              delta > 0 ? 'bg-accent-green/10' : 'bg-status-lost/10',
            )}
          >
            {delta > 0 ? <TrendingUp size={13} className="text-accent-green" /> : <TrendingDown size={13} className="text-status-lost" />}
            {delta > 0 ? '+' : ''}
            {delta}% vs {period === 'week' ? 'semana anterior' : 'mês anterior'}
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={isMobile ? 200 : 220}>
        <ComposedChart data={daily} margin={{ top: 8, right: 8, left: isMobile ? -20 : -12, bottom: 0 }}>
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.brand} stopOpacity={0.45} />
              <stop offset="90%" stopColor={c.brand} stopOpacity={0} />
            </linearGradient>
            {/* Brilho da linha: cópia desfocada por baixo do traço */}
            <filter id={`${id}-glow`} x="-5%" y="-30%" width="110%" height="160%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid stroke={c.grid} />
          <XAxis
            dataKey={isMobile ? 'short' : 'label'}
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickMargin={10}
            interval={period === 'month' ? (isMobile ? 6 : 4) : 0}
          />
          <YAxis
            allowDecimals={false}
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            width={40}
            ticks={ticks}
            domain={[0, ticks[ticks.length - 1]]}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: c.axisMuted, strokeWidth: 1, strokeOpacity: 0.5 }} />
          {/* Recebidos = série principal: área verde com brilho (mesmo traço da Receita) */}
          <Area
            dataKey="received"
            name="Recebidos"
            type="monotone"
            stroke={c.brand}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={glow}
            fill={`url(#${id}-fill)`}
            dot={ringDot(c.brand)}
            activeDot={ringDot(c.brand, 5)}
            animationDuration={900}
            animationEasing="ease-out"
          />
          {/* Ligações e reuniões: linhas discretas, ponto só no hover. Sobem 3px/6px pra não sumirem
              uma embaixo da outra quando os valores são iguais (ex.: tudo no zero) */}
          <Line
            className="[transform:translateY(-3px)]"
            dataKey="called"
            name="Ligações"
            type="monotone"
            stroke={c.axis}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={ringDot(c.axis, 4)}
            animationDuration={900}
            animationEasing="ease-out"
          />
          <Line
            className="[transform:translateY(-6px)]"
            dataKey="meetings"
            name="Reuniões"
            type="monotone"
            stroke={c.amber}
            strokeWidth={2}
            strokeOpacity={0.85}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={ringDot(c.amber, 4)}
            animationDuration={900}
            animationEasing="ease-out"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legenda: bolinha na cor da série + nome + total do período */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-fg/[0.06] pt-3">
        {[
          { color: c.brand, label: 'Recebidos', value: cur.received },
          { color: c.axis, label: 'Ligações', value: cur.called },
          { color: c.amber, label: 'Reuniões', value: cur.meetings },
        ].map((it) => (
          <span key={it.label} className="flex items-center gap-1.5 text-[12px] text-text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: it.color }} />
            {it.label}
            <span className="font-semibold tabular-nums text-text-primary">{it.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Painel do captador: mesmo molde do Dashboard dos admins, com a produção da semana/mês */
export function MyDashboardPage() {
  const [period, setPeriod] = useState<Period>('week');
  const { data: stats, isLoading } = useMyStats(period);
  const firstName = useAuthStore((s) => s.user?.full_name?.split(' ')[0]);
  const c = useChartColors();

  // Cores SVG por resultado (Recharts não resolve var(--x))
  const STATUS_COLOR: Record<CallStatus, string> = {
    pending: c.axisMuted,
    no_answer: c.axis,
    answered: '#5FB3D9',
    wrong_number: '#E5484D',
    callback: c.amber,
    meeting: c.brand,
    lost: '#E5484D',
  };

  const cur = stats?.current;
  const prev = stats?.previous;
  const daily: DailyPoint[] = (stats?.daily ?? []).map((d) => ({
    ...d,
    label: format(parseISO(d.day), period === 'week' ? 'EEE dd' : 'dd/MM', { locale: ptBR }),
    // Eixo do celular: só o dia ("20"), pra 7 rótulos caberem sem encavalar
    short: format(parseISO(d.day), 'dd'),
  }));
  const statusData = stats
    ? CALL_STATUS_ORDER.map((s) => ({ key: s, name: CALL_STATUS[s].label, value: stats.byStatus[s] })).filter((d) => d.value > 0)
    : [];
  const statusTotal = statusData.reduce((sum, d) => sum + d.value, 0);

  // Funil do captador no mesmo componente do funil do pipeline (colunas, líder em verde)
  const funnelSteps = stats?.funnel ?? [];
  const funnel = funnelSteps.map((f, i) => ({
    stage_id: f.stage,
    name: f.stage,
    color: '',
    position: i,
    deal_count: f.value,
    total_value: 0,
  }));
  const funnelTop = funnelSteps[0]?.value ?? 0;
  const funnelWon = funnelTop ? Math.round(((funnelSteps[funnelSteps.length - 1]?.value ?? 0) / funnelTop) * 100) : 0;

  const changeLabel = period === 'week' ? 'Variação em relação à semana anterior' : 'Variação em relação ao mês anterior';
  const periodLabel = period === 'week' ? 'Últimos 7 dias' : 'Últimos 30 dias';
  usePageSubtitle(`Seu desempenho nos ${periodLabel.toLowerCase()}, comparado ao período anterior`);

  return (
    // mobile-sections: no celular cada bloco vira um card translúcido separado (ver globals.css)
    <div className="mobile-sections space-y-5 max-md:space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-4 pt-1">
        <div>
          <h1 className="page-title">Olá{firstName ? `, ${firstName}` : ''}</h1>
        </div>
        <SegmentedControl layoutId="my-dashboard-period" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      </div>

      {isLoading || !cur || !prev ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[112px] rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <KpiCard
            label="Reuniões"
            icon={CalendarCheck}
            highlight
            value={cur.meetings}
            trend={daily.map((d) => d.meetings)}
            change={change(cur.meetings, prev.meetings)}
            changeLabel={changeLabel}
            sub={`${rate(cur)}% das ligações`}
          />
          <KpiCard
            label="Ligações feitas"
            icon={PhoneCall}
            value={cur.called}
            trend={daily.map((d) => d.called)}
            change={change(cur.called, prev.called)}
            changeLabel={changeLabel}
            sub="No período"
          />
          <KpiCard
            label="Leads recebidos"
            icon={Inbox}
            value={cur.received}
            trend={daily.map((d) => d.received)}
            change={change(cur.received, prev.received)}
            changeLabel={changeLabel}
            sub="Na sua fila no período"
          />
          <KpiCard
            label="Comissão"
            icon={Wallet}
            value={formatBRL(cur.commission)}
            change={change(cur.commission, prev.commission)}
            changeLabel={changeLabel}
            sub={`${cur.won} negócio${cur.won !== 1 ? 's' : ''} fechado${cur.won !== 1 ? 's' : ''}`}
          />
        </div>
      )}

      {/* mobile-split: no celular cada gráfico tem o próprio bloco (cada div = bloco, card dentro) */}
      <div className="mobile-split grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
        <div>
          <div className="card h-full p-5">
            <CardHeader icon={Activity} title="Atividade por dia" action={<CardAction>{periodLabel}</CardAction>} />
            {isLoading || !cur || !prev ? (
              <Skeleton className="h-[260px] rounded-xl" />
            ) : (
              <ActivityChart daily={daily} cur={cur} prev={prev} period={period} />
            )}
          </div>
        </div>
        <div>
          <div className="card flex h-full flex-col p-5">
            <CardHeader
              icon={Filter}
              title="Funil do período"
              action={
                <Link to="/meus-leads">
                  <CardAction>Ver leads</CardAction>
                </Link>
              }
            />
            {isLoading || !stats ? (
              <Skeleton className="h-[232px] rounded-xl" />
            ) : funnelTop === 0 ? (
              <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-text-muted">
                Nenhum lead recebido no período
              </p>
            ) : (
              <>
                <FunnelChart data={funnel} unit={{ one: 'lead', many: 'leads' }} showValue={false} />
                <p className="mt-3 text-center text-xs text-text-muted">
                  <strong className="font-semibold text-accent-green">{funnelWon}%</strong> dos leads recebidos viraram negócio fechado
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* div: no celular vira o bloco translúcido e o card fica dentro (ver .mobile-sections) */}
      <div>
        <div className="card p-5">
          <CardHeader icon={PieIcon} title="Resultado das ligações" action={<CardAction>Situação atual</CardAction>} />
          {isLoading ? (
            <Skeleton className="h-[180px] rounded-xl" />
          ) : statusTotal === 0 ? (
            <p className="py-10 text-center text-sm text-text-muted">Nenhum lead recebido no período</p>
          ) : (
            // Rosca à esquerda + um bloco por status (todos, mesmo zerados) preenchendo a largura;
            // no celular a rosca fica em cima e os blocos em 2 colunas
            <div className="flex flex-col items-center gap-6 md:flex-row md:items-stretch">
              <div className="relative h-[164px] w-[164px] flex-shrink-0 self-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    {/* Trilho de fundo */}
                    <Pie
                      data={[{ value: 1 }]}
                      dataKey="value"
                      innerRadius={56}
                      outerRadius={76}
                      stroke="none"
                      fill={c.grid}
                      isAnimationActive={false}
                    />
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={56}
                      outerRadius={76}
                      startAngle={90}
                      endAngle={-270}
                      // Um status só = anel inteiro, sem a "fresta" do espaçamento
                      paddingAngle={statusData.length > 1 ? 3 : 0}
                      cornerRadius={statusData.length > 1 ? 6 : 0}
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
                  <span className="text-[26px] font-semibold leading-none tabular-nums text-text-primary">{statusTotal}</span>
                  <span className="mt-1 text-[11px] text-text-muted">leads</span>
                </div>
              </div>

              <ul className="grid w-full flex-1 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {CALL_STATUS_ORDER.map((key) => {
                  const value = stats?.byStatus[key] ?? 0;
                  const pct = statusTotal ? Math.round((value / statusTotal) * 100) : 0;
                  return (
                    <li
                      key={key}
                      className={cn(
                        'flex flex-col justify-between rounded-[14px] border border-fg/[0.06] bg-fg/[0.025] p-4 transition-opacity',
                        value === 0 && 'opacity-55',
                      )}
                    >
                      <span className="flex items-center gap-2 text-[12.5px] font-medium text-text-secondary">
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: STATUS_COLOR[key] }} />
                        <span className="truncate">{CALL_STATUS[key].label}</span>
                      </span>
                      <div className="mt-4">
                        <p className="flex items-baseline gap-1.5">
                          <span className="text-[24px] font-semibold leading-none tabular-nums text-text-primary">{value}</span>
                          <span className="text-[12px] tabular-nums text-text-muted">{pct}%</span>
                        </p>
                        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-fg/[0.06]">
                          <div
                            className="h-full rounded-full transition-[width] duration-700 ease-out"
                            style={{ width: `${pct}%`, background: STATUS_COLOR[key] }}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
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
