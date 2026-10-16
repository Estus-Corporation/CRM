import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { RevenuePoint } from '@/services/reports.service';
import { useChartColors } from '@/hooks/useChartColors';

interface RevenueChartProps {
  data: RevenuePoint[];
  period?: 'month' | 'week';
}

function fmt(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function fmtFull(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface TooltipPayload {
  value: number;
  dataKey: string;
  payload: { label: string; totalValue: number; dealCount: number };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="glass-panel px-4 py-3 text-sm min-w-[160px]">
      <p className="text-text-secondary text-xs font-medium mb-2 uppercase tracking-wide">{d.label}</p>
      <p className="text-text-primary font-semibold text-base">{fmtFull(d.totalValue)}</p>
      <p className="text-text-muted text-xs mt-1">
        {d.dealCount} {d.dealCount === 1 ? 'negócio' : 'negócios'} fechados
      </p>
    </div>
  );
}

export function RevenueChart({ data, period = 'month' }: RevenueChartProps) {
  const c = useChartColors();
  if (!data.length) {
    return (
      <div className="h-52 flex items-center justify-center text-text-muted text-sm">
        Nenhum dado de receita ainda
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.totalValue));

  const formatted = data.map((d) => ({
    ...d,
    label: period === 'week'
      ? format(new Date(d.period), 'dd/MM', { locale: ptBR })
      : format(new Date(d.period), 'MMM/yy', { locale: ptBR }),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={formatted} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tick={{ fill: c.axis, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis
          tickFormatter={fmt}
          tick={{ fill: c.axisMuted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={64}
          domain={[0, (max: number) => Math.ceil(max * 1.15)]}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: c.cursor }} />
        <Bar dataKey="totalValue" radius={[8, 8, 2, 2]} maxBarSize={48}>
          {formatted.map((entry, idx) => (
            <Cell
              key={idx}
              fill={entry.totalValue === maxVal ? c.brand : c.brandDim}
              fillOpacity={entry.totalValue === maxVal ? 1 : 0.65}
            />
          ))}
        </Bar>
        <Line
          type="monotone"
          dataKey="totalValue"
          stroke={c.amber}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
          activeDot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
