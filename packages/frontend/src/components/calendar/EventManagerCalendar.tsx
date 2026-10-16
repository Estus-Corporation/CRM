"use client"

import { motion } from 'framer-motion';
import { useState, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Clock,
  LayoutGrid,
  List,
  Search,
  X,
  Trash2,
  CheckSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import type { CalendarEvent, CreateEventInput } from '@/services/calendar.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = 'month' | 'week' | 'day' | 'list';

interface EventManagerCalendarProps {
  events: CalendarEvent[];
  onEventCreate?: (input: CreateEventInput) => Promise<void>;
  onEventUpdate?: (id: string, input: Partial<CreateEventInput>) => Promise<void>;
  onEventDelete?: (id: string) => Promise<void>;
  isSubmitting?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(s: string): Date {
  return new Date(s);
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function weekLabel(date: Date) {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function getWeekStart(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthDays(date: Date): Date[] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const startDay = new Date(first);
  startDay.setDate(startDay.getDate() - startDay.getDay());

  const days: Date[] = [];
  const cur = new Date(startDay);
  for (let i = 0; i < 42; i++) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function getWeekDays(date: Date): Date[] {
  const start = getWeekStart(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const WEEK_DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ---------------------------------------------------------------------------
// Event Card
// ---------------------------------------------------------------------------

function EventChip({
  event,
  onClick,
  compact = false,
}: {
  event: CalendarEvent;
  onClick: (e: React.MouseEvent) => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded px-1.5 text-xs font-medium truncate transition-all',
        'bg-accent-green/20 text-accent-green border border-accent-green/30',
        'hover:bg-accent-green/30 hover:border-accent-green/50',
        compact ? 'py-0.5' : 'py-1',
      )}
      title={event.title}
    >
      {!compact && (
        <span className="text-accent-green/60 mr-1">{formatTime(event.start_at)}</span>
      )}
      {event.title}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Month View
// ---------------------------------------------------------------------------

function MonthView({
  currentDate,
  events,
  onEventClick,
  onDayClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDayClick: (date: Date) => void;
}) {
  const days = getMonthDays(currentDate);
  const today = new Date();

  function getEventsForDay(day: Date) {
    return events.filter((e) => isSameDay(new Date(e.start_at), day));
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
      {/* Day headers */}
      <div className="data-head grid grid-cols-7">
        {WEEK_DAYS_SHORT.map((d) => (
          <div
            key={d}
            className="py-2.5 text-center"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6 min-h-0">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isToday = isSameDay(day, today);

          return (
            <div
              key={idx}
              className={cn(
                'border-b border-r border-bg-border p-1 flex flex-col gap-1 overflow-hidden cursor-pointer',
                !isCurrentMonth && 'opacity-40',
                'hover:bg-bg-surface/50 transition-colors',
              )}
              onClick={() => onDayClick(day)}
            >
              <div className="flex-shrink-0">
                <span
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                    isToday
                      ? 'bg-accent-green text-bg-darker font-bold'
                      : 'text-text-secondary',
                  )}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((e) => (
                  <EventChip
                    key={e.id}
                    event={e}
                    compact
                    onClick={(ev) => { ev.stopPropagation(); onEventClick(e); }}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-text-muted pl-1">
                    +{dayEvents.length - 3} mais
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Week View
// ---------------------------------------------------------------------------

function WeekView({
  currentDate,
  events,
  onEventClick,
  onCellClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onCellClick: (date: Date, hour: number) => void;
}) {
  const weekDays = getWeekDays(currentDate);
  const today = new Date();

  function getEventsForDayHour(day: Date, hour: number) {
    return events.filter((e) => {
      const d = new Date(e.start_at);
      return isSameDay(d, day) && d.getHours() === hour;
    });
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="min-w-[600px]">
        {/* Header row */}
        <div className="grid grid-cols-8 border-b border-bg-border sticky top-0 bg-bg-primary z-10">
          <div className="py-2 border-r border-bg-border" />
          {weekDays.map((day, i) => {
            const isToday = isSameDay(day, today);
            return (
              <div
                key={i}
                className="py-2 text-center border-r border-bg-border last:border-r-0"
              >
                <div className="text-xs text-text-secondary uppercase tracking-wider">
                  {WEEK_DAYS_SHORT[i]}
                </div>
                <div
                  className={cn(
                    'mx-auto mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium',
                    isToday
                      ? 'bg-accent-green text-bg-darker font-bold'
                      : 'text-text-primary',
                  )}
                >
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Hour rows */}
        {HOURS.map((hour) => (
          <div key={hour} className="grid grid-cols-8 border-b border-bg-border/50 min-h-[52px]">
            <div className="border-r border-bg-border px-2 py-1 text-[10px] text-text-muted text-right">
              {pad(hour)}:00
            </div>
            {weekDays.map((day, i) => {
              const hourEvents = getEventsForDayHour(day, hour);
              return (
                <div
                  key={i}
                  className="border-r border-bg-border/30 last:border-r-0 p-0.5 flex flex-col gap-0.5 cursor-pointer hover:bg-bg-surface/30 transition-colors"
                  onClick={() => onCellClick(day, hour)}
                >
                  {hourEvents.map((e) => (
                    <EventChip
                      key={e.id}
                      event={e}
                      onClick={(ev) => { ev.stopPropagation(); onEventClick(e); }}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day View
// ---------------------------------------------------------------------------

function DayView({
  currentDate,
  events,
  onEventClick,
  onCellClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onCellClick: (date: Date, hour: number) => void;
}) {
  function getEventsForHour(hour: number) {
    return events.filter((e) => {
      const d = new Date(e.start_at);
      return isSameDay(d, currentDate) && d.getHours() === hour;
    });
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      {HOURS.map((hour) => {
        const hourEvents = getEventsForHour(hour);
        return (
          <div
            key={hour}
            className="flex border-b border-bg-border/50 min-h-[56px] cursor-pointer hover:bg-bg-surface/30 transition-colors"
            onClick={() => onCellClick(currentDate, hour)}
          >
            <div className="w-16 flex-shrink-0 border-r border-bg-border px-2 py-1 text-[11px] text-text-muted text-right">
              {pad(hour)}:00
            </div>
            <div className="flex-1 p-1 flex flex-col gap-1">
              {hourEvents.map((e) => (
                <EventChip
                  key={e.id}
                  event={e}
                  onClick={(ev) => { ev.stopPropagation(); onEventClick(e); }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// List View
// ---------------------------------------------------------------------------

function ListView({
  events,
  onEventClick,
}: {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );

  if (sorted.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-text-muted">
        <Calendar className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">Nenhum evento encontrado</p>
      </div>
    );
  }

  let lastDate = '';

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="divide-y divide-bg-border/50">
        {sorted.map((e) => {
          const d = new Date(e.start_at);
          const dateStr = d.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });
          const showDate = dateStr !== lastDate;
          lastDate = dateStr;

          return (
            <div key={e.id}>
              {showDate && (
                <div className="px-4 py-2 bg-bg-surface/50 text-xs font-semibold text-text-secondary uppercase tracking-wider sticky top-0">
                  {dateStr}
                </div>
              )}
              <button
                onClick={() => onEventClick(e)}
                className="w-full flex items-start gap-4 px-4 py-3 hover:bg-bg-surface/60 transition-colors text-left"
              >
                <div className="flex-shrink-0 pt-0.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-accent-green mt-1" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">{e.title}</div>
                  {e.description && (
                    <div className="text-xs text-text-secondary mt-0.5 truncate">{e.description}</div>
                  )}
                  {e.contact_name && (
                    <div className="text-xs text-text-muted mt-0.5">Contato: {e.contact_name}</div>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-xs font-medium text-accent-green">{formatTime(e.start_at)}</div>
                  {!e.all_day && (
                    <div className="text-[10px] text-text-muted">{formatTime(e.end_at)}</div>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event Form (slide-in panel)
// ---------------------------------------------------------------------------

interface EventFormState {
  title: string;
  description: string;
  startAt: string;
  durationMinutes: number;
  allDay: boolean;
}

function EventFormPanel({
  initialData,
  event,
  onSubmit,
  onDelete,
  onClose,
  isSubmitting,
}: {
  initialData?: Partial<EventFormState>;
  event?: CalendarEvent | null;
  onSubmit: (input: CreateEventInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  isSubmitting?: boolean;
}) {
  const existingDuration = event
    ? Math.round((new Date(event.end_at).getTime() - new Date(event.start_at).getTime()) / 60000)
    : 60;

  const [form, setForm] = useState<EventFormState>({
    title: event?.title ?? '',
    description: event?.description ?? '',
    startAt: event ? toLocalInput(event.start_at) : initialData?.startAt ?? '',
    durationMinutes: existingDuration > 0 ? existingDuration : 60,
    allDay: event?.all_day ?? false,
  });
  const [error, setError] = useState('');

  function set(key: keyof EventFormState, value: string | boolean | number) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Título obrigatório'); return; }
    if (!form.startAt) { setError('Data de início obrigatória'); return; }
    setError('');

    const start = fromLocalInput(form.startAt);
    const end = new Date(start.getTime() + form.durationMinutes * 60 * 1000);

    await onSubmit({
      title: form.title.trim(),
      description: form.description || undefined,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      allDay: form.allDay,
    });
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border flex-shrink-0">
        <h3 className="text-base font-semibold text-text-primary">
          {event ? 'Editar evento' : 'Novo evento'}
        </h3>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {error && (
          <p className="text-xs text-status-lost bg-status-lost/10 px-3 py-2 rounded">{error}</p>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">Título *</label>
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            className="input-base"
            placeholder="Ex: Reunião com cliente"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">Descrição</label>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className="input-base resize-none"
            rows={3}
            placeholder="Detalhes do evento..."
          />
        </div>

        <DateTimePicker
          label="Data e hora *"
          value={form.startAt}
          onChange={(v) => set('startAt', v)}
        />

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">Duração</label>
          <select
            value={form.durationMinutes}
            onChange={(e) => set('durationMinutes', Number(e.target.value))}
            className="input-base"
          >
            <option value={15}>15 minutos</option>
            <option value={30}>30 minutos</option>
            <option value={45}>45 minutos</option>
            <option value={60}>1 hora</option>
            <option value={90}>1h 30min</option>
            <option value={120}>2 horas</option>
            <option value={180}>3 horas</option>
            <option value={240}>4 horas</option>
            <option value={480}>8 horas</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={form.allDay}
            onChange={(e) => set('allDay', e.target.checked)}
            className="accent-accent-green"
          />
          Dia inteiro
        </label>

        {event?.contact_name && (
          <div className="text-xs text-text-muted">
            Contato: <span className="text-text-secondary">{event.contact_name}</span>
          </div>
        )}
        {event?.deal_title && (
          <div className="text-xs text-text-muted">
            Negócio: <span className="text-text-secondary">{event.deal_title}</span>
          </div>
        )}
        {event?.creator_name && (
          <div className="text-xs text-text-muted">
            Criado por: <span className="text-text-secondary">{event.creator_name}</span>
          </div>
        )}
      </form>

      {/* Footer */}
      <div className="flex items-center gap-2 px-5 py-4 border-t border-bg-border flex-shrink-0">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isSubmitting}
            className="text-status-lost hover:text-red-400 transition-colors p-1.5 rounded hover:bg-status-lost/10"
            title="Excluir evento"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onClose} type="button">
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit as unknown as React.MouseEventHandler}
          disabled={isSubmitting}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          {isSubmitting ? 'Salvando...' : event ? 'Salvar' : 'Criar'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function EventManagerCalendar({
  events,
  onEventCreate,
  onEventUpdate,
  onEventDelete,
  isSubmitting,
}: EventManagerCalendarProps) {
  const [view, setView] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  // Panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [defaultFormData, setDefaultFormData] = useState<Partial<EventFormState>>({});

  // Filtered events
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.contact_name?.toLowerCase().includes(q) ||
        e.deal_title?.toLowerCase().includes(q),
    );
  }, [events, searchQuery]);

  const navigate = useCallback(
    (dir: 'prev' | 'next') => {
      setCurrentDate((prev) => {
        const d = new Date(prev);
        if (view === 'month') d.setMonth(d.getMonth() + (dir === 'next' ? 1 : -1));
        else if (view === 'week') d.setDate(d.getDate() + (dir === 'next' ? 7 : -7));
        else if (view === 'day') d.setDate(d.getDate() + (dir === 'next' ? 1 : -1));
        return d;
      });
    },
    [view],
  );

  function headerTitle() {
    if (view === 'month') return monthLabel(currentDate);
    if (view === 'week') return weekLabel(currentDate);
    if (view === 'day')
      return currentDate.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    return 'Todos os eventos';
  }

  function openNew(date?: Date, hour?: number) {
    setSelectedEvent(null);
    const start = date ? new Date(date) : new Date();
    if (hour !== undefined) start.setHours(hour, 0, 0, 0);
    setDefaultFormData({
      startAt: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:00`,
      durationMinutes: 60,
    });
    setPanelOpen(true);
  }

  function openEvent(event: CalendarEvent) {
    setSelectedEvent(event);
    setDefaultFormData({});
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setSelectedEvent(null);
  }

  async function handleSubmit(input: CreateEventInput) {
    if (selectedEvent) {
      await onEventUpdate?.(selectedEvent.id, input);
    } else {
      await onEventCreate?.(input);
    }
    closePanel();
  }

  async function handleDelete() {
    if (!selectedEvent) return;
    await onEventDelete?.(selectedEvent.id);
    closePanel();
  }

  const viewButtons: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
    { key: 'month', label: 'Mês', icon: <Calendar className="h-3.5 w-3.5" /> },
    { key: 'week', label: 'Semana', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
    { key: 'day', label: 'Dia', icon: <Clock className="h-3.5 w-3.5" /> },
    { key: 'list', label: 'Lista', icon: <List className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-full gap-0 overflow-hidden rounded-xl border border-bg-border bg-bg-primary">
      {/* ── Toolbar ── */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b-[1.5px] border-fg/[0.14] px-4 py-3">
        {/* Nav */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate('prev')}
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-bg-border text-text-secondary hover:text-text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-2 h-7 text-xs rounded hover:bg-bg-border text-text-secondary hover:text-text-primary transition-colors"
          >
            Hoje
          </button>
          <button
            onClick={() => navigate('next')}
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-bg-border text-text-secondary hover:text-text-primary transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Title */}
        <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold capitalize text-text-primary">
          {headerTitle()}
        </h2>

        {/* View switcher */}
        <div className="flex h-10 items-stretch overflow-hidden rounded-xl border border-fg/[0.1] bg-field shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
          {viewButtons.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={cn(
                'relative flex items-center gap-1.5 px-3.5 text-[13px] font-medium transition-colors duration-200',
                view === key ? 'text-[rgb(var(--on-accent))]' : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {view === key && (
                <motion.span
                  layoutId="calendar-view-pill"
                  className="absolute inset-0 rounded-[11px] bg-accent-green shadow-[0_4px_14px_-6px_rgb(var(--accent-green)/0.6)]"
                  transition={{ type: 'spring', visualDuration: 0.35, bounce: 0.15 }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </span>
            </button>
          ))}
        </div>

        {/* New event */}
        <Button
          variant="primary"
          size="lg"
          onClick={() => openNew()}
          className="flex-shrink-0 px-6 text-[15px]"
        >
          <Plus size={18} strokeWidth={2.25} />
          Novo evento
        </Button>
      </div>

      {/* ── Search ── */}
      <div className="px-4 py-2 border-b border-bg-border/50 bg-bg-surface/40 flex-shrink-0">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar eventos..."
            className="w-full h-7 pl-8 pr-7 rounded text-xs bg-bg-border/50 border border-bg-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-green/50 focus:ring-1 focus:ring-accent-green/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Main content (calendar + panel side-by-side) ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Calendar area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {view === 'month' && (
            <MonthView
              currentDate={currentDate}
              events={filteredEvents}
              onEventClick={openEvent}
              onDayClick={(day) => openNew(day)}
            />
          )}
          {view === 'week' && (
            <WeekView
              currentDate={currentDate}
              events={filteredEvents}
              onEventClick={openEvent}
              onCellClick={(day, hour) => openNew(day, hour)}
            />
          )}
          {view === 'day' && (
            <DayView
              currentDate={currentDate}
              events={filteredEvents}
              onEventClick={openEvent}
              onCellClick={(day, hour) => openNew(day, hour)}
            />
          )}
          {view === 'list' && (
            <ListView events={filteredEvents} onEventClick={openEvent} />
          )}
        </div>

        {/* Side panel */}
        {panelOpen && (
          <div className="w-80 flex-shrink-0 border-l border-bg-border bg-bg-surface flex flex-col overflow-hidden">
            <EventFormPanel
              key={selectedEvent?.id ?? 'new'}
              event={selectedEvent}
              initialData={defaultFormData}
              onSubmit={handleSubmit}
              onDelete={selectedEvent ? handleDelete : undefined}
              onClose={closePanel}
              isSubmitting={isSubmitting}
            />
          </div>
        )}
      </div>
    </div>
  );
}
