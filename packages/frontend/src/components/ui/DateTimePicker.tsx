import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { dialogMotion, overlayMotion } from '@/lib/motion';
import { DayPicker } from 'react-day-picker';
import { ptBR } from 'react-day-picker/locale';
import { ChevronLeft, ChevronRight, CalendarDays, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

function capitalizeFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toDisplayString(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocalInput(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function toLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// ---------------------------------------------------------------------------
// Modal portal
// ---------------------------------------------------------------------------

interface DateTimeModalProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  title?: string;
}

function DateTimeModal({ value, onChange, onClose, title }: DateTimeModalProps) {
  const parsed = parseLocalInput(value);
  const [tempDate, setTempDate] = useState<Date | undefined>(parsed ?? undefined);
  const [tempHour, setTempHour] = useState<number>(parsed?.getHours() ?? 9);
  const [currentMonth, setCurrentMonth] = useState<Date>(parsed ?? new Date());

  const hourListRef = useRef<HTMLDivElement>(null);

  function prevMonth() {
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  function nextMonth() {
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  const monthLabel = capitalizeFirst(
    currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
  );

  // Scroll selected hour into view on mount
  useEffect(() => {
    const el = hourListRef.current?.querySelector('[data-selected="true"]');
    el?.scrollIntoView({ block: 'center' });
  }, []);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') handleConfirmOrClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempDate, tempHour]);

  function handleDaySelect(day: Date | undefined) {
    if (!day) return;
    setTempDate(day);
  }

  function handleHourSelect(h: number) {
    setTempHour(h);
  }

  function handleConfirmOrClose() {
    if (tempDate) {
      const result = new Date(tempDate);
      result.setHours(tempHour, 0, 0, 0);
      onChange(toLocalInputValue(result));
    }
    onClose();
  }

  function handleConfirm() {
    handleConfirmOrClose();
  }

  function handleClear() {
    onChange('');
    onClose();
  }

  const previewDate = tempDate
    ? (() => { const d = new Date(tempDate); d.setHours(tempHour, 0, 0, 0); return d; })()
    : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
    >
      {/* Overlay — clique fora confirma e fecha */}
      <motion.div
        className="absolute inset-0 bg-black/55"
        onClick={handleConfirmOrClose}
        {...overlayMotion}
      />

      {/* Modal card */}
      <motion.div
        {...dialogMotion}
        className="relative z-10 flex w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-fg/[0.08] bg-bg-surface shadow-[0_32px_80px_-20px_rgba(0,0,0,0.55)]"
      >

        {/* Header — [← prev] [icon + title + next →] [spacer] [✕] */}
        <div className="flex items-center gap-1 px-3 py-3 border-b border-bg-border flex-shrink-0">
          <button
            onClick={prevMonth}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-bg-border hover:text-text-primary transition-colors flex-shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <CalendarDays className="h-4 w-4 text-accent-green" />
            <span className="text-sm font-semibold text-text-primary">
              {title ?? 'Selecionar data e hora'}
            </span>
          </div>

          <button
            onClick={nextMonth}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-bg-border hover:text-text-primary transition-colors flex-shrink-0"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="flex-1" />

          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-border transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body: calendar + hour list side by side */}
        <div className="flex min-h-0">

          {/* Calendar */}
          <div className="flex-1 p-5">
            {/* Month label inside the calendar body */}
            <div className="text-center text-sm font-semibold text-text-primary mb-3 capitalize">
              {monthLabel}
            </div>

            <DayPicker
              mode="single"
              selected={tempDate}
              onSelect={handleDaySelect}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              locale={ptBR}
              showOutsideDays={false}
              disableNavigation
              classNames={{
                root: 'w-full',
                months: 'flex flex-col',
                month: 'w-full',
                month_caption: 'hidden',
                nav: 'hidden',
                weeks: '',
                weekdays: 'flex',
                weekday:
                  'flex-1 flex items-center justify-center h-8 text-[11px] font-medium text-text-muted uppercase tracking-wider',
                week: 'flex mt-0.5',
                day: 'group flex-1 h-10 p-0 text-sm flex items-center justify-center',
                day_button: cn(
                  'h-9 w-9 flex items-center justify-center rounded-lg text-sm transition-all duration-150',
                  'text-text-primary',
                  'hover:bg-accent-green/15 hover:text-accent-green',
                  'group-data-[selected]:bg-accent-green group-data-[selected]:text-bg-darker group-data-[selected]:font-bold group-data-[selected]:shadow-md',
                  'group-data-[today]:ring-1 group-data-[today]:ring-accent-green/60 group-data-[today]:font-medium',
                  'group-data-[outside]:opacity-25 group-data-[outside]:pointer-events-none',
                  'focus:outline-none',
                ),
                outside: 'opacity-25',
                today: '',
                selected: '',
                hidden: 'invisible',
              }}
            />
          </div>

          {/* Divider */}
          <div className="w-px bg-bg-border flex-shrink-0" />

          {/* Hour list */}
          <div className="flex flex-col w-36 flex-shrink-0">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-bg-border flex-shrink-0">
              <Clock className="h-3.5 w-3.5 text-accent-green" />
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Hora</span>
            </div>
            <div
              ref={hourListRef}
              className="overflow-y-auto flex-1 py-2 px-2"
              style={{ maxHeight: '300px' }}
            >
              {HOURS.map((h) => {
                const isSelected = tempHour === h;
                return (
                  <button
                    key={h}
                    type="button"
                    data-selected={isSelected}
                    onClick={() => handleHourSelect(h)}
                    className={cn(
                      'w-full h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-150 mb-0.5',
                      isSelected
                        ? 'bg-accent-green text-bg-darker shadow-md'
                        : 'text-text-secondary hover:bg-bg-border hover:text-text-primary',
                    )}
                  >
                    {pad(h)}:00
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-bg-border px-5 py-4 flex items-center gap-3 flex-shrink-0">
          {/* Preview */}
          <div className="flex-1 min-w-0">
            {previewDate ? (
              <p className="text-sm text-text-primary font-medium">
                {previewDate.toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}{' '}
                <span className="text-accent-green">às {pad(tempHour)}:00</span>
              </p>
            ) : (
              <p className="text-sm text-text-muted">Selecione uma data e hora</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors px-2 py-1.5 rounded hover:bg-bg-border"
          >
            Limpar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!tempDate}
            className={cn(
              'px-5 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150',
              tempDate
                ? 'bg-accent-green text-bg-darker hover:bg-accent-green-dim shadow-md'
                : 'bg-bg-border text-text-muted cursor-not-allowed',
            )}
          >
            Confirmar
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  modalTitle?: string;
  /** Substitui o campo padrão por um gatilho próprio (o modal continua o mesmo) */
  renderTrigger?: (props: { open: () => void; date: Date | null }) => React.ReactNode;
}

export function DateTimePicker({
  value,
  onChange,
  label,
  placeholder = 'Selecionar data e hora',
  className,
  modalTitle,
  renderTrigger,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const parsed = parseLocalInput(value);

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label className="text-xs font-medium text-text-secondary">{label}</label>
      )}

      {/* Trigger button */}
      {renderTrigger ? renderTrigger({ open: () => setOpen(true), date: parsed }) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'input-base w-full flex items-center gap-2 text-left cursor-pointer',
          !parsed && 'text-text-muted',
        )}
      >
        <CalendarDays className="h-3.5 w-3.5 text-text-muted flex-shrink-0" />
        <span className="flex-1 text-sm">
          {parsed ? toDisplayString(parsed) : placeholder}
        </span>
        {parsed && (
          <span
            role="button"
            onClick={handleClear}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>
      )}

      {/* Modal */}
      <AnimatePresence>
      {open && (
        <DateTimeModal
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
          title={modalTitle}
        />
      )}
      </AnimatePresence>
    </div>
  );
}
