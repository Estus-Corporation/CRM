import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useChartColors } from '@/hooks/useChartColors';
import { cn } from '@/lib/utils';

/** Card padrão do app: cabeçalho com ícone + título (+ subtítulo e ação à direita) */
export function Panel({
  icon: Icon, title, subtitle, action, className, bodyClassName, children,
}: {
  icon?: LucideIcon;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-[20px] border border-fg/[0.08] bg-bg-surface/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
        className,
      )}
    >
      {title && (
        <header className="flex items-start gap-3 px-5 pt-4">
          {Icon && <Icon size={19} strokeWidth={2.1} className="mt-0.5 flex-shrink-0 text-text-primary" />}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15.5px] font-semibold text-text-primary">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn('flex-1 p-5', title && 'pt-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Barra de progresso fina (XP, metas, atributos) */
export function ProgressBar({ value, max, tone = 'green', className }: { value: number; max: number; tone?: 'green' | 'amber' | 'white'; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-fg/[0.07]', className)}>
      <motion.div
        className={cn(
          'h-full rounded-full',
          tone === 'green' && 'bg-accent-green',
          tone === 'amber' && 'bg-accent-amber',
          tone === 'white' && 'bg-text-primary shadow-[0_0_12px_rgba(255,255,255,0.35)]',
        )}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', visualDuration: 0.6, bounce: 0.1 }}
      />
    </div>
  );
}

/** Anel com o número no meio (média geral) */
export function Ring({ value, tone = 'green', size = 96 }: { value: number; tone?: 'green' | 'amber'; size?: number }) {
  const c = useChartColors();
  const stroke = 9;
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.grid} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone === 'green' ? '#6E93F5' : '#C9D8FF'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={len}
          initial={{ strokeDashoffset: len }}
          animate={{ strokeDashoffset: len * (1 - Math.min(100, value) / 100) }}
          transition={{ type: 'spring', visualDuration: 0.8, bounce: 0.05 }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[22px] font-semibold tabular-nums text-text-primary">{value}%</span>
    </div>
  );
}

/** Radar de 6 eixos (uma série só: a cor vem do painel, os rótulos ficam na cor do texto) */
export function RadarPanelChart({ data, tone = 'green', height = 300 }: { data: { label: string; value: number }[]; tone?: 'green' | 'amber'; height?: number }) {
  const c = useChartColors();
  const color = tone === 'green' ? '#6E93F5' : '#C9D8FF';
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="82%" margin={{ top: 8, right: 48, bottom: 8, left: 48 }}>
          <PolarGrid stroke={c.grid} />
          <PolarAngleAxis dataKey="label" tick={{ fill: c.axis, fontSize: 12 }} />
          {/* Escala fixa 0–100: com todas as notas iguais a escala automática colapsava */}
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickCount={5} />
          <Tooltip
            cursor={false}
            contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 12, color: c.tooltipText, fontSize: 12 }}
            itemStyle={{ color: c.tooltipText }}
            formatter={(v: number) => [`${v}%`, 'Colecionado']}
          />
          <Radar
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={color}
            fillOpacity={0.18}
            dot={{ r: 4, fill: color, stroke: c.surface, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: color, stroke: c.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Lista "rótulo ........ 62%" ao lado dos anéis */
export function PercentList({ items }: { items: { label: string; value: number; icon?: LucideIcon }[] }) {
  return (
    <ul className="min-w-0 flex-1 space-y-1.5">
      {items.map(({ label, value, icon: Icon }) => (
        <li key={label} className="flex items-center gap-2 text-[13px]">
          {Icon && <Icon size={13} className="flex-shrink-0 text-text-muted" />}
          <span className="min-w-0 flex-1 truncate text-text-secondary">{label}</span>
          <span className="tabular-nums text-text-primary">{value}%</span>
        </li>
      ))}
    </ul>
  );
}

/** Título de página no padrão do CRM */
export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-3 text-sm text-text-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Slider 0–100 */
export function Slider({ value, onChange, tone = 'green' }: { value: number; onChange: (v: number) => void; tone?: 'green' | 'amber' }) {
  return (
    <input
      type="range"
      min={0}
      max={100}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn('h-2 w-full cursor-pointer', tone === 'green' ? 'accent-[rgb(var(--accent-green))]' : 'accent-[rgb(var(--accent-amber))]')}
    />
  );
}

// ── Itens ───────────────────────────────────────────────────────────────────

/** Foto do item (ou ícone do universo quando não tem foto) */
/** `contain`: foto recortada (sem fundo) aparece inteira, com respiro, em vez de cortada */
export function ItemImage({ src, icon: Icon, className, dim = false, contain = false }: { src: string | null; icon: LucideIcon; className?: string; dim?: boolean; contain?: boolean }) {
  return (
    <div className={cn('relative overflow-hidden bg-fg/[0.04]', className)}>
      {src ? (
        <img src={src} alt="" loading="lazy" className={cn('h-full w-full transition-[filter]', contain ? 'object-contain p-[8%] drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]' : 'object-cover', dim && 'grayscale-[0.85] brightness-[0.55]')} />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-text-muted">
          <Icon size={26} strokeWidth={1.6} />
        </div>
      )}
    </div>
  );
}
