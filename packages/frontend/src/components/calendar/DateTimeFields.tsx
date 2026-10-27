import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { DayPicker } from 'react-day-picker';
import { ptBR } from 'react-day-picker/locale';
import { format } from 'date-fns';
import { ptBR as dateFnsPtBR } from 'date-fns/locale';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Timer } from 'lucide-react';
import { dropdownMotion } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Popover em portal (position: fixed) ancorado no campo: escapa do overflow do painel do evento
 * e abre pra cima quando não cabe embaixo.
 */
function Popover({
  anchorRef,
  open,
  onClose,
  width,
  height,
  children,
}: {
  anchorRef: RefObject<HTMLElement>;
  open: boolean;
  onClose: () => void;
  width: number;
  height: number;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number }>({ left: 0 });
  // Dentro de uma janela (Radix) a lista é desenhada nela: fora, a janela trava clique e rolagem
  const [host, setHost] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const dialog = anchorRef.current.closest<HTMLElement>('[role="dialog"]');
    setHost(dialog);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const below = r.bottom + 8 + height < window.innerHeight;
    if (dialog) {
      // Coordenadas relativas à janela (referência do position: absolute), somando a rolagem dela
      const d = dialog.getBoundingClientRect();
      const top = below ? r.bottom - d.top + dialog.scrollTop + 8 : r.top - d.top + dialog.scrollTop - height - 8;
      setPos({ left: left - d.left, top: Math.max(8, top) });
    } else {
      setPos(below ? { left, top: r.bottom + 8 } : { left, bottom: window.innerHeight - r.top + 8 });
    }
  }, [open, anchorRef, width, height]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !anchorRef.current?.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
    };
  }, [open, onClose, anchorRef]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          data-floating
          {...dropdownMotion}
          style={{
            position: host ? 'absolute' : 'fixed',
            left: pos.left,
            top: pos.top,
            bottom: pos.bottom,
            width,
            transformOrigin: pos.bottom !== undefined ? 'bottom left' : 'top left',
            // Janela (Radix) aberta desliga o clique fora dela; aqui volta a valer
            pointerEvents: 'auto',
          }}
          className="z-[80] overflow-hidden rounded-2xl border border-fg/[0.08] bg-bg-surface p-3 shadow-[0_24px_56px_-16px_rgba(0,0,0,0.7)]"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    host ?? document.body,
  );
}

const fieldButton =
  'flex h-11 w-full items-center gap-2.5 rounded-xl border bg-field px-3 text-left text-sm transition-colors';

/** Data do evento ("YYYY-MM-DD"): calendário próprio no visual do app */
export function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T12:00:00`) : undefined;
  const [month, setMonth] = useState<Date>(selected ?? new Date());

  useEffect(() => {
    if (open && selected) setMonth(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (d?: Date) => {
    if (!d) return;
    onChange(format(d, 'yyyy-MM-dd'));
    setOpen(false);
  };

  const label = selected
    ? format(selected, selected.getFullYear() === new Date().getFullYear() ? "EEE, d 'de' MMMM" : "d 'de' MMM 'de' yyyy", { locale: dateFnsPtBR })
    : 'Escolher data';
  const monthTitle = format(month, "MMMM 'de' yyyy", { locale: dateFnsPtBR });
  const shiftMonth = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(fieldButton, open ? 'border-accent-green/60' : 'border-fg/[0.1] hover:border-fg/[0.18]')}
      >
        <CalendarDays className="h-4 w-4 flex-shrink-0 text-accent-green" />
        <span className={cn('min-w-0 flex-1 truncate first-letter:uppercase', selected ? 'text-text-primary' : 'text-text-muted')}>{label}</span>
      </button>

      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={300} height={360}>
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="font-display text-[15px] font-semibold text-text-primary first-letter:uppercase">{monthTitle}</p>
          <div className="flex gap-1">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Mês anterior" className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-fg/[0.06] hover:text-text-primary">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Próximo mês" className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-fg/[0.06] hover:text-text-primary">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <DayPicker
          mode="single"
          selected={selected}
          onSelect={pick}
          month={month}
          onMonthChange={setMonth}
          locale={ptBR}
          showOutsideDays
          disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
          classNames={{
            root: 'w-full',
            months: 'flex flex-col',
            month: 'w-full',
            month_caption: 'hidden',
            nav: 'hidden',
            weekdays: 'flex',
            weekday: 'flex h-8 flex-1 items-center justify-center text-[11px] font-semibold uppercase tracking-wider text-text-muted',
            week: 'mt-0.5 flex',
            day: 'group flex h-9 flex-1 items-center justify-center p-0',
            day_button: cn(
              'flex h-9 w-9 items-center justify-center rounded-xl text-[13px] tabular-nums text-text-primary transition-colors',
              'hover:bg-fg/[0.07]',
              'group-data-[today]:font-semibold group-data-[today]:text-accent-green',
              'group-data-[selected]:bg-accent-green group-data-[selected]:font-semibold group-data-[selected]:text-[rgb(var(--on-accent))] group-data-[selected]:hover:bg-accent-green',
              'group-data-[outside]:text-text-muted/50',
              'group-data-[disabled]:pointer-events-none group-data-[disabled]:text-text-muted/35 group-data-[disabled]:line-through',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/40',
            ),
            outside: '',
            today: '',
            selected: '',
            hidden: 'invisible',
          }}
        />

        <div className="mt-2 flex items-center justify-between border-t border-fg/[0.06] px-1 pt-2.5">
          <button type="button" onClick={() => pick(new Date())} className="rounded-lg px-2 py-1 text-xs font-medium text-accent-green transition-colors hover:bg-accent-green/10">
            Hoje
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + 1);
              pick(d);
            }}
            className="rounded-lg px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-fg/[0.06] hover:text-text-primary"
          >
            Amanhã
          </button>
        </div>
      </Popover>
    </>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Horários de 30 em 30 min (o horário salvo aparece mesmo se for quebrado, ex. 14:15) */
const TIMES = Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`);

/** Hora do evento ("HH:mm"): grade de horários; abre já rolada no escolhido (ou às 08:00) */
export function TimeField({
  value,
  onChange,
  unavailable,
  list = false,
  fromHour = 0,
  toHour = 23.5,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Horário indisponível: 'busy' (ocupado) ou 'past' (já passou) — aparece desativado */
  unavailable?: (time: string) => 'busy' | 'past' | null;
  /** Uma coluna só (um horário por linha), com "Ocupado"/"Já passou" escrito ao lado */
  list?: boolean;
  /** Faixa de horários mostrada (ex.: 7 a 20) */
  fromHour?: number;
  toHour?: number;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const inRange = TIMES.filter((t) => {
    const [h, m] = t.split(':').map(Number);
    const x = h + m / 60;
    return x >= fromHour && x <= toHour;
  });
  const times = value && !inRange.includes(value) ? [...inRange, value].sort() : inRange;

  useEffect(() => {
    if (!open) return;
    // Espera o popover montar pra rolar até o horário
    const id = window.setTimeout(() => {
      const box = listRef.current;
      const target = box?.querySelector<HTMLElement>(`[data-time="${value || '08:00'}"]`);
      // Rola só a lista (scrollIntoView rolaria a janela/página junto)
      if (box && target) box.scrollTop = target.offsetTop - box.clientHeight / 2 + target.clientHeight / 2;
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, value]);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(fieldButton, open ? 'border-accent-green/60' : 'border-fg/[0.1] hover:border-fg/[0.18]')}
      >
        <Clock className="h-4 w-4 flex-shrink-0 text-accent-green" />
        <span className={cn('flex-1 tabular-nums', value ? 'text-text-primary' : 'text-text-muted')}>{value || '--:--'}</span>
      </button>

      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={list ? 220 : 232} height={300}>
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">Horário</p>
        <div ref={listRef} className={cn('relative max-h-64 overflow-y-auto pr-0.5', list ? 'flex flex-col gap-0.5' : 'grid grid-cols-3 gap-1')}>
          {times.map((t) => {
            const off = unavailable?.(t) ?? null;
            return (
              <button
                key={t}
                type="button"
                data-time={t}
                disabled={!!off}
                title={off === 'busy' ? 'Ocupado' : off === 'past' ? 'Já passou' : undefined}
                onClick={() => {
                  onChange(t);
                  setOpen(false);
                }}
                className={cn(
                  'h-9 rounded-lg text-[13px] tabular-nums transition-colors',
                  list && 'flex items-center justify-between px-3 text-left',
                  t === value
                    ? 'bg-accent-green font-semibold text-[rgb(var(--on-accent))]'
                    : off === 'busy'
                      ? 'cursor-not-allowed text-accent-amber/60 line-through'
                      : off === 'past'
                        ? 'cursor-not-allowed text-text-muted/40'
                        : 'text-text-primary hover:bg-fg/[0.07]',
                )}
              >
                <span>{t}</span>
                {list && off && <span className="inline-block text-[11px]">{off === 'busy' ? 'Ocupado' : 'Já passou'}</span>}
                {list && t === value && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      </Popover>
    </>
  );
}

/** Duração da reunião: mesmo estilo do campo de hora, com a lista de durações */
export function DurationField({
  value,
  onChange,
  options,
}: {
  value: number;
  onChange: (v: number) => void;
  options: { value: number; label: string }[];
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(fieldButton, open ? 'border-accent-green/60' : 'border-fg/[0.1] hover:border-fg/[0.18]')}
      >
        <Timer className="h-4 w-4 flex-shrink-0 text-accent-green" />
        <span className="flex-1 truncate text-text-primary">{current?.label ?? `${value} min`}</span>
        <ChevronDown className={cn('h-4 w-4 flex-shrink-0 text-text-muted transition-transform', open && 'rotate-180')} />
      </button>

      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={200} height={260}>
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">Duração</p>
        <div className="flex flex-col gap-0.5">
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
                  'flex h-9 items-center justify-between rounded-lg px-3 text-left text-[13px] transition-colors',
                  active ? 'bg-accent-green font-semibold text-[rgb(var(--on-accent))]' : 'text-text-primary hover:bg-fg/[0.07]',
                )}
              >
                {o.label}
                {active && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      </Popover>
    </>
  );
}
