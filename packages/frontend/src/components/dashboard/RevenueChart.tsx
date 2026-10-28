import { useId } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import type { RevenuePoint } from '@/services/reports.service';
import { useChartColors } from '@/hooks/useChartColors';
import { cn } from '@/lib/utils';

interface RevenueChartProps {
  data: RevenuePoint[];
  period?: 'month' | 'week';
}

const compact = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v);
// Eixo: número compacto sem moeda (o total em destaque já mostra R$)
const axisNum = (v: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

/** Divisões redondas (1-2-2,5-5 × 10^n) pra 3 faixas acima de zero */
function niceTicks(max: number) {
  if (max <= 0) return [0, 1000, 2000, 3000, 4000];
  const raw = max / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((st) => st >= raw) ?? 10 * pow;
  return [0, step, step * 2, step * 3, ...(step * 3 < max * 1.05 ? [step * 4] : [])];
}

const full = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

interface TooltipPayload {
  payload: { label: string; totalValue: number; dealCount: number };
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="glass-panel min-w-[150px] px-3.5 py-2.5">
      <p className="text-[11px] font-medium capitalize text-text-muted">{d.label}</p>
      <p className="mt-0.5 text-[15px] font-semibold text-text-primary">{full(d.totalValue)}</p>
      <p className="text-[12px] text-text-secondary">
        {d.dealCount} {d.dealCount === 1 ? 'negócio fechado' : 'negócios fechados'}
      </p>
    </div>
  );
}

/**
 * Receita ganha ao longo do tempo — uma série só (sem legenda; o título do card nomeia).
 * Topo: total do período em destaque + variação do último período vs o anterior.
 * Gráfico: área suave (linha 2px + véu de ~10%) com 4+ períodos; com poucos, colunas finas (≤24px).
 */
export function RevenueChart({ data, period = 'month' }: RevenueChartProps) {
  const c = useChartColors();
  const gradId = useId().replace(/:/g, '');

  if (!data.length && period === 'week') {
    return (
      <div className="flex h-[260px] flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium text-text-secondary">Nenhuma receita ainda</p>
        <p className="text-[12.5px] text-text-muted">Negócios ganhos aparecem aqui.</p>
      </div>
    );
  }

  // Mensal: sempre os últimos 6 meses — meses sem venda entram como zero, então a linha tem forma
  const points =
    period === 'month'
      ? Array.from({ length: 6 }, (_, k) => {
          const month = startOfMonth(subMonths(new Date(), 5 - k));
          const key = format(month, 'yyyy-MM');
          const hit = data.find((d) => format(new Date(d.period), 'yyyy-MM') === key);
          return {
            period: month.toISOString(),
            totalValue: Number(hit?.totalValue ?? 0),
            dealCount: Number(hit?.dealCount ?? 0),
            label: format(month, 'MMM', { locale: ptBR }).replace('.', ''),
          };
        })
      : data.map((d) => ({
          ...d,
          totalValue: Number(d.totalValue),
          label: format(new Date(d.period), "dd 'de' MMM", { locale: ptBR }),
        }));
  const empty = points.every((p) => p.totalValue === 0);
  const total = points.reduce((s, p) => s + p.totalValue, 0);
  const deals = points.reduce((s, p) => s + Number(p.dealCount), 0);
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const delta = prev && prev.totalValue > 0 ? ((last.totalValue - prev.totalValue) / prev.totalValue) * 100 : null;
  const asArea = points.length >= 4;
  const maxVal = Math.max(...points.map((p) => p.totalValue));
  const ticks = niceTicks(maxVal);

  const axisTick = { fill: c.axisMuted, fontSize: 11 };
  const commonAxes = (
    <>
      {/* Grade: hairline sólida, só horizontal, recessiva */}
      <CartesianGrid stroke={c.grid} />
      <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} tickMargin={10} interval="preserveStartEnd" />
      <YAxis
        tickFormatter={axisNum}
        tick={axisTick}
        axisLine={false}
        tickLine={false}
        width={48}
        ticks={ticks}
        domain={[0, ticks[ticks.length - 1]]}
      />
    </>
  );

  return (
    <div>
      {/* Número principal */}
      {!empty && <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-[32px] font-semibold leading-none tracking-[-0.02em] text-text-primary">{compact(total)}</p>
          <p className="mt-1.5 text-[12.5px] text-text-muted">
            {deals} {deals === 1 ? 'negócio ganho' : 'negócios ganhos'} no período
          </p>
        </div>
        {delta !== null && (
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium',
              delta >= 0 ? 'bg-accent-green/10 text-text-primary' : 'bg-status-lost/10 text-text-primary',
            )}
          >
            {delta >= 0 ? (
              <TrendingUp size={13} className="text-accent-green" />
            ) : (
              <TrendingDown size={13} className="text-status-lost" />
            )}
            {delta >= 0 ? '+' : ''}
            {delta.toFixed(0)}% vs mês anterior
          </span>
        )}
      </div>}

      <div className="relative">
      {empty && (
        <div className="pointer-events-none absolute inset-x-0 top-6 z-10 flex flex-col items-center text-center">
          <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-[10px] border border-fg/[0.1] bg-fg/[0.03] text-text-secondary">
            <BarChart3 size={17} strokeWidth={1.8} />
          </span>
          <p className="text-[13.5px] font-medium text-text-primary">Nenhum dado de receita ainda.</p>
          <p className="mt-0.5 max-w-[240px] text-[12px] text-text-muted">Quando você fechar seus primeiros negócios, eles aparecerão aqui.</p>
        </div>
      )}
      <ResponsiveContainer width="100%" height={200}>
        {asArea ? (
          <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.brand} stopOpacity={0.45} />
                <stop offset="90%" stopColor={c.brand} stopOpacity={0} />
              </linearGradient>
              {/* Brilho da linha: cópia desfocada por baixo do traço */}
              <filter id={`${gradId}-glow`} x="-5%" y="-30%" width="110%" height="160%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {commonAxes}
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: c.axisMuted, strokeWidth: 1, strokeOpacity: 0.5 }}
            />
            <Area
              type="monotone"
              dataKey="totalValue"
              stroke={c.brand}
              strokeWidth={3}
              filter={`url(#${gradId}-glow)`}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={`url(#${gradId})`}
              // Só o ponto final ganha marcador (r=4 + anel na cor da superfície)
              // Ponto em cada mês (anel na cor da superfície); o mês atual um pouco maior
              dot={(props: { cx?: number; cy?: number; index?: number }) => (
                <circle
                  key={props.index}
                  cx={props.cx}
                  cy={props.cy}
                  r={props.index === points.length - 1 ? 5 : 3.5}
                  fill={c.brand}
                  stroke={c.surface}
                  strokeWidth={2}
                />
              )}
              activeDot={{ r: 5, fill: c.brand, stroke: c.surface, strokeWidth: 2 }}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </AreaChart>
        ) : (
          <BarChart data={points} margin={{ top: 22, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
            {commonAxes}
            <Tooltip content={<ChartTooltip />} cursor={{ fill: c.cursor, radius: 8 }} />
            <Bar dataKey="totalValue" fill={c.brand} maxBarSize={24} radius={[4, 4, 0, 0]} animationDuration={800}>
              {/* Rótulo só no maior valor — nunca um número em cada coluna */}
              <LabelList
                dataKey="totalValue"
                position="top"
                offset={8}
                content={(props: { x?: number | string; y?: number | string; width?: number | string; value?: number | string }) =>
                  Number(props.value) === maxVal ? (
                    <text
                      x={Number(props.x) + Number(props.width) / 2}
                      y={Number(props.y) - 8}
                      textAnchor="middle"
                      fill={c.axis}
                      fontSize={11.5}
                      fontWeight={600}
                    >
                      {compact(Number(props.value))}
                    </text>
                  ) : null
                }
              />
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
      </div>
    </div>
  );
}
