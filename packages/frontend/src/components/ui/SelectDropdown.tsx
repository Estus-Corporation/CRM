import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { dropdownMotion } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface Props<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  /** Título do painel (ex.: "Tipo") */
  title?: string;
  /** Texto do botão enquanto o valor não é uma das opções */
  placeholder?: string;
  className?: string;
}

/** Botão único que abre a lista de opções (substitui o SegmentedControl onde não cabe) */
export function SelectDropdown<T extends string>({ value, options, onChange, title, placeholder, className }: Props<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number }>({ left: 0, width: 0 });
  const current = options.find((o) => o.value === value) ?? (placeholder ? undefined : options[0]);

  // Posição do painel a partir do botão; perto do fim da tela abre pra cima
  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    const panelHeight = 56 + options.length * 40;
    const fitsBelow = r.bottom + 8 + panelHeight < window.innerHeight;
    setPos(
      fitsBelow
        ? { left: r.left, width: r.width, top: r.bottom + 8 }
        : { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 8 },
    );
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (!rootRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    // Painel é fixo na tela: ao rolar a página ele ficaria solto, então fecha
    const onScroll = (e: Event) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-xl border bg-field px-3.5 text-[13.5px] font-medium text-text-primary shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-colors duration-200',
          open ? 'border-accent-green/60' : 'border-fg/[0.1] hover:border-fg/[0.18]',
        )}
      >
        <span className={cn('truncate', !current && 'text-text-muted')}>{current?.label ?? placeholder}</span>
        <ChevronDown size={16} className={cn('flex-shrink-0 text-text-muted transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            data-floating
            {...dropdownMotion}
            style={{
              transformOrigin: pos.bottom !== undefined ? 'bottom left' : 'top left',
              left: pos.left,
              minWidth: pos.width,
              top: pos.top,
              bottom: pos.bottom,
            }}
            className="glass-panel fixed z-[80] w-max overflow-hidden p-1.5"
          >
            {title && (
              <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{title}</p>
            )}
            {options.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors duration-150',
                    active ? 'bg-accent-green/10 font-medium text-accent-green' : 'text-text-primary hover:bg-fg/[0.05]',
                  )}
                >
                  {o.label}
                  {active && <Check size={15} strokeWidth={2.25} className="flex-shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
      )}
    </div>
  );
}
