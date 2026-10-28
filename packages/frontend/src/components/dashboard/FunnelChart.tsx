import { motion } from 'framer-motion';
import type { FunnelStage } from '@/services/reports.service';
import { cn } from '@/lib/utils';

interface FunnelChartProps {
  data: FunnelStage[];
}

const BAR_MAX = 120; // px — altura da coluna mais cheia
const BAR_MIN = 52; // px — etapas vazias ainda aparecem como bloco

const compact = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v);

/**
 * Funil do pipeline em colunas, na ordem das etapas: número em cima, bloco proporcional,
 * nome e % do total embaixo. A etapa com mais negócios ganha o verde; as outras ficam em
 * blocos neutros — o olho vai direto pra onde está o volume.
 */
export function FunnelChart({ data }: FunnelChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-[230px] flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium text-text-secondary">Nenhuma etapa no pipeline</p>
        <p className="text-[12.5px] text-text-muted">Crie um pipeline para ver o funil.</p>
      </div>
    );
  }

  const stages = [...data].sort((a, b) => a.position - b.position);
  const total = stages.reduce((s, x) => s + Number(x.deal_count), 0);
  const max = Math.max(0, ...stages.map((s) => Number(s.deal_count)));

  return (
    // Painel interno (card dentro do card), como no visual de referência
    <div className="flex min-h-[232px] flex-1 items-end justify-around gap-3 rounded-[14px] border border-fg/[0.04] bg-fg/[0.015] px-4 pb-4 pt-5">
      {stages.map((s, i) => {
        const count = Number(s.deal_count);
        const pct = total ? Math.round((count / total) * 100) : 0;
        const leader = count > 0 && count === max;
        const h = max ? BAR_MIN + (count / max) * (BAR_MAX - BAR_MIN) : BAR_MIN;
        return (
          <div
            key={s.stage_id}
            className="group flex min-w-0 max-w-[96px] flex-1 flex-col items-center"
            title={`${s.name}: ${count} ${count === 1 ? 'negócio' : 'negócios'} · ${compact(Number(s.total_value))}`}
          >
            <motion.span
              className="mb-2 text-[22px] font-semibold leading-none text-text-primary"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.07, duration: 0.3 }}
            >
              {count}
            </motion.span>
            <motion.div
              className={cn(
                'w-full origin-bottom rounded-[12px] transition-[filter] duration-200 group-hover:brightness-110',
                leader
                  ? 'bg-gradient-to-b from-accent-green to-accent-green/40 shadow-[0_10px_30px_-12px_rgb(var(--accent-green)/0.7),inset_0_1px_0_rgba(255,255,255,0.25)]'
                  : 'bg-gradient-to-b from-fg/[0.1] to-fg/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
              )}
              style={{ height: h }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ type: 'spring', visualDuration: 0.6, bounce: 0.15, delay: 0.1 + i * 0.07 }}
            />
            <span className="mt-2.5 w-full truncate text-center text-[12.5px] font-medium text-text-secondary">{s.name}</span>
            <span className={cn('mt-0.5 text-[12px] font-semibold tabular-nums', leader ? 'text-accent-green' : 'text-text-muted')}>
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
