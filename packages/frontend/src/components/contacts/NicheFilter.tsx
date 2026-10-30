import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ListFilter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useContactNiches } from '@/hooks/useContacts';

interface NicheFilterProps {
  value: string;
  onChange: (niche: string) => void;
}

/** Botão "Filtro" que abre o painel "Filtrar por nicho" com os nichos usados no workspace. */
export function NicheFilter({ value, onChange }: NicheFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { data: niches = [], isLoading } = useContactNiches();

  // Fecha com clique fora ou Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (niche: string) => {
    onChange(niche);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <div
        className={cn(
          'flex h-10 items-center rounded-xl border bg-fg/[0.04] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors duration-200',
          value ? 'border-accent-green/60' : 'border-fg/[0.1] hover:border-fg/[0.18]',
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex h-full items-center gap-2 pl-3.5 pr-3.5 text-[13.5px] font-medium text-text-primary"
        >
          <ListFilter size={16} strokeWidth={1.9} className={value ? 'text-accent-green' : 'text-text-secondary'} />
          Filtro
          {value && (
            <span className="max-w-[140px] truncate rounded-md bg-accent-green/15 px-2 py-0.5 text-[12.5px] text-accent-green">
              {value}
            </span>
          )}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="mr-1.5 rounded-md p-1 text-text-muted transition-colors hover:bg-fg/[0.06] hover:text-text-primary"
            aria-label="Limpar filtro de nicho"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ type: 'spring', visualDuration: 0.25, bounce: 0.1 }}
            className="glass-panel absolute right-0 top-[calc(100%+8px)] z-40 w-64 origin-top-right overflow-hidden p-1.5"
          >
            <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
              Filtrar por nicho
            </p>

            <Option label="Todos os nichos" active={!value} onClick={() => choose('')} />
            <div className="my-1 h-px bg-fg/[0.06]" />

            <div className="max-h-64 overflow-y-auto">
              {isLoading && <p className="px-2.5 py-2 text-sm text-text-muted">Carregando…</p>}
              {!isLoading && niches.length === 0 && (
                <p className="px-2.5 py-2 text-[13px] leading-snug text-text-muted">
                  Nenhum nicho cadastrado ainda. Defina o nicho ao criar ou editar um contato.
                </p>
              )}
              {niches.map((n, i) => (
                <motion.div
                  key={n}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0, transition: { delay: Math.min(i * 0.03, 0.25) } }}
                >
                  <Option label={n} active={value === n} onClick={() => choose(n)} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Option({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors duration-150',
        active ? 'bg-accent-green/10 font-medium text-accent-green' : 'text-text-primary hover:bg-fg/[0.05]',
      )}
    >
      <span className="truncate">{label}</span>
      {active && <Check size={15} strokeWidth={2.25} className="flex-shrink-0" />}
    </button>
  );
}
