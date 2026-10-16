import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Único por tela — a pílula desliza entre as opções via layoutId */
  layoutId: string;
  className?: string;
}

/** Controle segmentado: a pílula verde desliza até a opção escolhida (padrão dos filtros do app). */
export function SegmentedControl<T extends string>({ options, value, onChange, layoutId, className }: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        // Sem padding interno: a pílula ativa ocupa a altura toda do controle
        'flex h-10 items-stretch overflow-hidden rounded-xl border border-fg/[0.1] bg-field shadow-[0_1px_2px_rgb(0_0_0/0.04)]',
        className,
      )}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'relative whitespace-nowrap px-4 text-[13px] font-medium transition-colors duration-200',
              active ? 'text-[rgb(var(--on-accent))]' : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-[11px] bg-accent-green shadow-[0_4px_14px_-6px_rgb(var(--accent-green)/0.6)]"
                transition={{ type: 'spring', visualDuration: 0.35, bounce: 0.15 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
