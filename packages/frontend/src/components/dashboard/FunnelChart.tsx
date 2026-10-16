import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { FunnelStage } from '@/services/reports.service';
import { useChartColors } from '@/hooks/useChartColors';

interface FunnelChartProps {
  data: FunnelStage[];
}

export function FunnelChart({ data }: FunnelChartProps) {
  const c = useChartColors();
  if (!data.length) {
    return (
      <div className="h-44 flex items-center justify-center text-text-muted text-sm">
        Nenhum dado disponível
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={176}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barCategoryGap="22%">
        <defs>
          {data.map((entry) => (
            <linearGradient key={entry.stage_id} id={`funnel-${entry.stage_id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={entry.color || c.brand} stopOpacity={0.9} />
              <stop offset="100%" stopColor={entry.color || c.brand} stopOpacity={0.25} />
            </linearGradient>
          ))}
        </defs>
        <XAxis
          dataKey="name"
          tick={{ fill: c.axis, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip
          contentStyle={{
            backgroundColor: c.tooltipBg,
            border: `1px solid ${c.tooltipBorder}`,
            borderRadius: 10,
            fontSize: 12,
          }}
          labelStyle={{ color: c.tooltipText }}
          itemStyle={{ color: c.brand }}
          formatter={(v: number) => [v, 'Negócios']}
          cursor={{ fill: c.cursor }}
        />
        <Bar dataKey="deal_count" radius={[8, 8, 2, 2]}>
          {data.map((entry) => (
            <Cell key={entry.stage_id} fill={`url(#funnel-${entry.stage_id})`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
