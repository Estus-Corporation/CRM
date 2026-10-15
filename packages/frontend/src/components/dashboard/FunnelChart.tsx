import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { FunnelStage } from '@/services/reports.service';

interface FunnelChartProps {
  data: FunnelStage[];
}

export function FunnelChart({ data }: FunnelChartProps) {
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
              <stop offset="0%" stopColor={entry.color || '#72d296'} stopOpacity={0.9} />
              <stop offset="100%" stopColor={entry.color || '#72d296'} stopOpacity={0.25} />
            </linearGradient>
          ))}
        </defs>
        <XAxis
          dataKey="name"
          tick={{ fill: '#98a3b8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(16,21,33,0.92)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            fontSize: 12,
          }}
          labelStyle={{ color: '#eef1f7' }}
          itemStyle={{ color: '#72d296' }}
          formatter={(v: number) => [v, 'Negócios']}
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
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
