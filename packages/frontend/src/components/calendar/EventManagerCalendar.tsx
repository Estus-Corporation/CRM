"use client"

import { AnimatePresence, motion } from 'framer-motion';
import { useState, useCallback, useEffect, useMemo } from 'react';
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
  Building2,
  Check,
  UserPlus,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { useTenant } from '@/hooks/useTenant';
import { DateField, DurationField, TimeField } from './DateTimeFields';
import type { CalendarEvent, CreateEventInput, ExternalAttendee } from '@/services/calendar.service';

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
  const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function weekLabel(date: Date) {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/** Dia anterior a hoje */
function isPastDay(day: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return day < today;
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
/** Largura do card do evento (inclui os 12px de respiro à esquerda) */
const PANEL_WIDTH = 352;
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
        'flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 text-left text-[11.5px] font-medium transition-colors',
        'bg-accent-green/[0.12] text-accent-green hover:bg-accent-green/[0.2]',
        compact ? 'py-[3px]' : 'py-1',
      )}
      title={event.title}
    >
      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-green" />
      {!event.all_day && <span className="flex-shrink-0 tabular-nums text-accent-green/70">{formatTime(event.start_at)}</span>}
      <span className="truncate">{event.title}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Month View
// ---------------------------------------------------------------------------

export function MonthView({
  currentDate,
  events,
  onEventClick,
  onDayClick,
  selectedDate,
  allowPastClick = false,
  renderDay,
  dayClassName,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDayClick: (date: Date) => void;
  /** Dia em destaque (agenda dos admins: o dia aberto no painel ao lado) */
  selectedDate?: Date;
  /** Dia passado também responde ao clique (agenda dos admins: consultar o que houve) */
  allowPastClick?: boolean;
  /** Troca as pílulas de evento por outro resumo do dia (agenda dos admins) */
  renderDay?: (day: Date, events: CalendarEvent[]) => React.ReactNode;
  /** Classe extra da célula conforme os eventos do dia */
  dayClassName?: (day: Date, events: CalendarEvent[]) => string | false;
}) {
  const days = getMonthDays(currentDate);
  const today = new Date();

  function getEventsForDay(day: Date) {
    return events.filter((e) => isSameDay(new Date(e.start_at), day));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Dias da semana: discretos, sem faixa colorida */}
      <div className="grid grid-cols-7 border-b border-fg/[0.06]">
        {WEEK_DAYS_SHORT.map((d) => (
          <div key={d} className="py-3 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
            {d}
          </div>
        ))}
      </div>

      {/* Grade: 6 semanas dividindo a altura disponível (o calendário cabe na tela, sem rolar) */}
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isToday = isSameDay(day, today);
          const weekend = day.getDay() === 0 || day.getDay() === 6;
          // Dia que já passou: mais escuro e sem criar evento (só os eventos dele abrem)
          const past = isPastDay(day);
          const clickable = !past || allowPastClick;

          return (
            <div
              key={idx}
              className={cn(
                'group/day relative flex flex-col gap-1.5 overflow-hidden border-fg/[0.06] p-2 transition-colors',
                clickable ? 'cursor-pointer hover:bg-fg/[0.03]' : 'cursor-default',
                idx % 7 !== 6 && 'border-r',
                idx < 35 && 'border-b',
                weekend && 'bg-fg/[0.012]',
                past && 'bg-black/[0.22]',
                dayClassName?.(day, dayEvents),
                isToday && 'bg-accent-green/[0.05]',
                selectedDate && isSameDay(day, selectedDate) && 'bg-accent-green/[0.1] shadow-[inset_0_0_0_1.5px_rgb(var(--accent-green)/0.45)]',
              )}
              onClick={() => clickable && onDayClick(day)}
            >
              <div className={cn('flex flex-shrink-0 items-center justify-between', past && 'opacity-60')}>
                <span
                  className={cn(
                    'inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[13px] font-medium tabular-nums',
                    isToday
                      ? 'bg-accent-green font-semibold text-[rgb(var(--on-accent))]'
                      : isCurrentMonth
                        ? 'text-text-primary'
                        : 'text-text-muted/60',
                  )}
                >
                  {day.getDate()}
                </span>
                {/* Atalho pra criar evento no dia (dias passados não têm) */}
                {!past && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted opacity-0 transition-opacity group-hover/day:opacity-100">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
              {renderDay ? (
                <div className={cn('min-h-0 flex-1', !isCurrentMonth && 'opacity-50')}>{renderDay(day, dayEvents)}</div>
              ) : (
              <div className={cn('flex flex-col gap-1 overflow-hidden', !isCurrentMonth && 'opacity-50')}>
                {dayEvents.slice(0, 3).map((e) => (
                  <EventChip
                    key={e.id}
                    event={e}
                    compact
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onEventClick(e);
                    }}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <span className="pl-2 text-[11px] font-medium text-text-muted">+{dayEvents.length - 3} mais</span>
                )}
              </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time grid (Semana e Dia): eventos como blocos posicionados pela hora
// ---------------------------------------------------------------------------

const HOUR_HEIGHT = 56;

/** Distribui eventos que se sobrepõem lado a lado (cada um ganha uma "faixa" no dia) */
function layoutDay(dayEvents: CalendarEvent[]) {
  const sorted = [...dayEvents].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  const placed: { event: CalendarEvent; lane: number; lanes: number }[] = [];
  let group: { event: CalendarEvent; lane: number; end: number }[] = [];
  let groupEnd = 0;

  const flush = () => {
    const lanes = Math.max(1, ...group.map((g) => g.lane + 1));
    group.forEach((g) => placed.push({ event: g.event, lane: g.lane, lanes }));
    group = [];
  };

  for (const e of sorted) {
    const start = new Date(e.start_at).getTime();
    const end = Math.max(new Date(e.end_at).getTime(), start + 30 * 60_000);
    if (group.length && start >= groupEnd) flush();
    const used = new Set(group.filter((g) => g.end > start).map((g) => g.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    group.push({ event: e, lane, end });
    groupEnd = Math.max(groupEnd, end);
  }
  if (group.length) flush();
  return placed;
}

function TimeGrid({
  days,
  events,
  onEventClick,
  onCellClick,
}: {
  days: Date[];
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onCellClick: (date: Date, hour: number) => void;
}) {
  const today = new Date();
  const [now, setNow] = useState(new Date());
  const scrollRef = useCallback((el: HTMLDivElement | null) => {
    // Abre já no começo do expediente
    if (el) el.scrollTop = 7 * HOUR_HEIGHT - 8;
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const single = days.length === 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Cabeçalho dos dias */}
      <div className="flex flex-shrink-0 border-b border-fg/[0.06] pr-2">
        <div className="w-16 flex-shrink-0" />
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={day.toISOString()} className={cn('flex flex-1 items-center gap-2.5 py-3', single ? 'px-3' : 'flex-col gap-1')}>
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                {day.toLocaleDateString('pt-BR', { weekday: single ? 'long' : 'short' }).replace('.', '')}
              </span>
              <span
                className={cn(
                  'inline-flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 font-display text-[16px] font-semibold tabular-nums',
                  isToday ? 'bg-accent-green text-[rgb(var(--on-accent))]' : 'text-text-primary',
                )}
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Grade de horas */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative flex" style={{ height: 24 * HOUR_HEIGHT }}>
          {/* Horas à esquerda */}
          <div className="relative w-16 flex-shrink-0">
            {HOURS.map((h) =>
              h === 0 ? null : (
                <span
                  key={h}
                  className="absolute right-3 -translate-y-1/2 text-[11px] tabular-nums text-text-muted"
                  style={{ top: h * HOUR_HEIGHT }}
                >
                  {pad(h)}:00
                </span>
              ),
            )}
          </div>

          {days.map((day) => {
            const placed = layoutDay(events.filter((e) => isSameDay(new Date(e.start_at), day)));
            const isToday = isSameDay(day, today);
            const nowTop = (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT;
            return (
              <div
                key={day.toISOString()}
                className={cn('relative flex-1 cursor-pointer border-l border-fg/[0.06]', isToday && 'bg-accent-green/[0.03]')}
                onClick={(ev) => {
                  const rect = (ev.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const hour = Math.min(23, Math.max(0, Math.floor((ev.clientY - rect.top) / HOUR_HEIGHT)));
                  onCellClick(day, hour);
                }}
              >
                {/* O que já passou fica mais escuro (sem criar evento ali) */}
                {(isPastDay(day) || isToday) && (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 bg-black/[0.22]"
                    style={{ height: isToday ? nowTop : '100%' }}
                  />
                )}

                {/* Linhas das horas */}
                {HOURS.map((h) => (
                  <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-fg/[0.05]" style={{ top: h * HOUR_HEIGHT }} />
                ))}

                {placed.map(({ event: e, lane, lanes }) => {
                  const start = new Date(e.start_at);
                  const end = new Date(e.end_at);
                  const top = (start.getHours() + start.getMinutes() / 60) * HOUR_HEIGHT;
                  const height = Math.max(26, ((end.getTime() - start.getTime()) / 3_600_000) * HOUR_HEIGHT - 3);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick(e);
                      }}
                      title={e.title}
                      className="absolute overflow-hidden rounded-lg border-l-[3px] border-accent-green bg-accent-green/[0.16] px-2 py-1 text-left transition-colors hover:bg-accent-green/[0.24]"
                      style={{
                        top: top + 1,
                        height,
                        left: `calc(${(lane / lanes) * 100}% + 3px)`,
                        width: `calc(${100 / lanes}% - 6px)`,
                      }}
                    >
                      <p className="truncate text-[12px] font-semibold leading-tight text-text-primary">{e.title}</p>
                      {height > 34 && (
                        <p className="truncate text-[11px] tabular-nums text-accent-green">
                          {formatTime(e.start_at)} – {formatTime(e.end_at)}
                        </p>
                      )}
                    </button>
                  );
                })}

                {/* Agora */}
                {isToday && (
                  <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowTop }}>
                    <div className="relative h-[2px] bg-status-lost">
                      <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-status-lost" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeekView(props: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onCellClick: (date: Date, hour: number) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
      <div className="flex min-h-0 min-w-[720px] flex-1 flex-col">
        <TimeGrid days={getWeekDays(props.currentDate)} events={props.events} onEventClick={props.onEventClick} onCellClick={props.onCellClick} />
      </div>
    </div>
  );
}

function DayView(props: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onCellClick: (date: Date, hour: number) => void;
}) {
  return <TimeGrid days={[props.currentDate]} events={props.events} onEventClick={props.onEventClick} onCellClick={props.onCellClick} />;
}

// ---------------------------------------------------------------------------
// List View: agenda agrupada por dia (dos próximos para os passados)
// ---------------------------------------------------------------------------

function ListView({
  events,
  onEventClick,
}: {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sorted = [...events].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  const upcoming = sorted.filter((e) => new Date(e.end_at) >= todayStart);
  const past = sorted.filter((e) => new Date(e.end_at) < todayStart).reverse();

  if (sorted.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-fg/[0.05] text-text-muted">
          <Calendar className="h-6 w-6" />
        </span>
        <p className="text-sm font-medium text-text-primary">Nenhum evento</p>
        <p className="mt-1 text-xs text-text-muted">Crie um em "Novo evento" ou clicando num dia.</p>
      </div>
    );
  }

  const groups = (list: CalendarEvent[]) => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of list) {
      const d = new Date(e.start_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.values()];
  };

  const section = (title: string, list: CalendarEvent[]) =>
    list.length > 0 && (
      <div>
        <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">{title}</p>
        <div className="space-y-3">
          {groups(list).map((dayEvents) => {
            const d = new Date(dayEvents[0].start_at);
            const isToday = isSameDay(d, new Date());
            return (
              <div key={d.toDateString()} className="flex gap-4">
                {/* Data à esquerda */}
                <div className="w-14 flex-shrink-0 pt-1 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    {d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                  </p>
                  <p className={cn('font-display text-[24px] font-semibold leading-tight tabular-nums', isToday ? 'text-accent-green' : 'text-text-primary')}>
                    {d.getDate()}
                  </p>
                  <p className="text-[11px] text-text-muted">{d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</p>
                </div>
                {/* Eventos do dia */}
                <div className="min-w-0 flex-1 space-y-2">
                  {dayEvents.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onEventClick(e)}
                      className="flex w-full min-w-0 items-stretch gap-3 rounded-xl border border-fg/[0.07] bg-fg/[0.02] p-3 text-left transition-colors hover:border-fg/[0.14] hover:bg-fg/[0.04]"
                    >
                      <span className="w-[3px] flex-shrink-0 rounded-full bg-accent-green" />
                      <span className="w-[92px] flex-shrink-0 text-[12.5px] tabular-nums text-text-secondary">
                        <span className="block font-semibold text-text-primary">{formatTime(e.start_at)}</span>
                        até {formatTime(e.end_at)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-text-primary">{e.title}</span>
                        {e.description && <span className="mt-0.5 block truncate text-xs text-text-secondary">{e.description}</span>}
                        {(e.contact_name || e.attendees?.length > 0 || e.external_attendees?.length > 0) && (
                          <span className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-text-muted">
                            {e.contact_name && <span>Contato: {e.contact_name}</span>}
                            {e.attendees?.length > 0 && <span>{e.attendees.map((a) => a.user_name.split(' ')[0]).join(', ')}</span>}
                            {e.external_attendees?.length > 0 && (
                              <span>+ {e.external_attendees.length} convidado{e.external_attendees.length > 1 ? 's' : ''}</span>
                            )}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );

  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
      {section('Próximos', upcoming)}
      {section('Anteriores', past)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dia: etiqueta na grade do mês e cards dos eventos no painel
// ---------------------------------------------------------------------------

type Member = { id: string; full_name: string; avatar_url: string | null };

function durationLabel(mins: number) {
  return mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}min` : ''}` : `${mins} min`;
}

/** Etiqueta no pé do dia: fotos dos participantes, horário e título do primeiro evento e quantos são */
function DayTag({ events, members }: { events: CalendarEvent[]; members: Member[] }) {
  if (events.length === 0) return null;
  const sorted = [...events].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  const first = sorted[0];
  const ids = [...new Set(sorted.flatMap((e) => e.attendees?.map((a) => a.user_id) ?? []))];
  const people = ids.map((id) => members.find((m) => m.id === id)).filter(Boolean) as Member[];

  return (
    <div className="flex h-full flex-col justify-end">
      <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-accent-green/25 bg-accent-green/[0.1] py-1 pl-1 pr-2">
        {people.length > 0 ? (
          <div className="flex flex-shrink-0 -space-x-1.5">
            {people.slice(0, 2).map((m) => (
              <Avatar key={m.id} name={m.full_name} src={m.avatar_url} className="h-[18px] w-[18px] text-[8px] ring-[1.5px] ring-bg-surface" />
            ))}
          </div>
        ) : (
          <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-accent-green/20 text-accent-green">
            <Clock className="h-[11px] w-[11px]" />
          </span>
        )}
        <span className="flex-shrink-0 text-[11px] font-semibold tabular-nums text-accent-green">{formatTime(first.start_at)}</span>
        <span className="min-w-0 truncate text-[11px] font-medium text-text-primary max-lg:hidden">{first.title}</span>
        {sorted.length > 1 && (
          <span className="ml-auto flex-shrink-0 rounded-full bg-accent-green/20 px-1.5 text-[10px] font-bold text-accent-green">{sorted.length}</span>
        )}
      </div>
    </div>
  );
}

/** Card de um evento do dia: horário em destaque, título, duração e quem participa */
function DayEventCard({ event, members, onClick }: { event: CalendarEvent; members: Member[]; onClick?: () => void }) {
  const st = new Date(event.start_at);
  const en = new Date(event.end_at);
  const mins = Math.round((en.getTime() - st.getTime()) / 60_000);
  const people = (event.attendees ?? []).map((a) => members.find((m) => m.id === a.user_id)).filter(Boolean) as Member[];
  const guests = event.external_attendees ?? [];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full min-w-0 overflow-hidden rounded-xl border border-fg/[0.07] bg-fg/[0.02] text-left transition-colors hover:border-fg/[0.14] hover:bg-fg/[0.04]"
    >
      <span className="flex w-[74px] flex-shrink-0 flex-col items-center justify-center border-r border-fg/[0.06] bg-accent-green/[0.07] py-2.5">
        <span className="font-display text-[16px] font-semibold tabular-nums text-text-primary">{formatTime(event.start_at)}</span>
        <span className="text-[11px] tabular-nums text-text-muted">até {formatTime(event.end_at)}</span>
      </span>
      <span className="min-w-0 flex-1 px-3 py-2.5">
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-text-primary">
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-green" />
          <span className="truncate">{event.title}</span>
          <span className="flex-shrink-0 font-normal text-text-muted">· {durationLabel(mins)}</span>
        </span>
        {(people.length > 0 || guests.length > 0) && (
          <span className="mt-1.5 flex min-w-0 items-center gap-1.5">
            {people.length > 0 && (
              <span className="flex flex-shrink-0 -space-x-1.5">
                {people.map((m) => (
                  <Avatar key={m.id} name={m.full_name} src={m.avatar_url} className="h-5 w-5 text-[9px] ring-2 ring-bg-surface" />
                ))}
              </span>
            )}
            <span className="truncate text-xs text-text-secondary">
              {[people.map((m) => m.full_name.split(' ')[0]).join(' e '), guests.length ? `+ ${guests.length} do cliente` : '']
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
        )}
      </span>
    </button>
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

const sectionLabel = 'text-xs font-medium text-text-secondary';

const EVENT_DURATIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1h 30min' },
  { value: 120, label: '2 horas' },
  { value: 180, label: '3 horas' },
  { value: 240, label: '4 horas' },
  { value: 480, label: '8 horas' },
];

function EventFormPanel({
  initialData,
  event,
  allEvents = [],
  onEventClick,
  onSubmit,
  onDelete,
  onClose,
  isSubmitting,
}: {
  initialData?: Partial<EventFormState>;
  event?: CalendarEvent | null;
  /** Todos os eventos: mostra os do dia escolhido e desativa horários ocupados */
  allEvents?: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
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
  // Participantes: equipe do espaço (ids) + convidados do cliente (nome e cargo)
  const { data: tenant } = useTenant();
  // Quem participa da reunião pela empresa: sempre os admins (captador nunca)
  const admins = (tenant?.members ?? []).filter((m) => m.role === 'admin');
  const titleOf = (email: string) =>
    tenant?.key_people?.find((p) => p.email?.toLowerCase() === email.toLowerCase())?.title ?? 'Admin';
  const [attendeeIds, setAttendeeIds] = useState<string[]>(event?.attendees.map((a) => a.user_id) ?? []);
  const [guests, setGuests] = useState<ExternalAttendee[]>(event?.external_attendees ?? []);

  // Data e hora em campos separados; o estado guarda "YYYY-MM-DDTHH:mm"
  const [datePart, timePart] = form.startAt ? form.startAt.split('T') : ['', ''];
  const setDate = (d: string) => set('startAt', d ? `${d}T${timePart || '09:00'}` : '');
  const setTime = (t: string) => set('startAt', `${datePart || toLocalInput(new Date().toISOString()).split('T')[0]}T${t}`);

  // Eventos do dia escolhido (sem o que está sendo editado) e horários que batem com eles
  const day = datePart ? new Date(`${datePart}T12:00:00`) : null;
  const dayEvents = day
    ? allEvents
        .filter((e) => e.id !== event?.id && isSameDay(new Date(e.start_at), day))
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    : [];
  const slotState = (t: string): 'busy' | 'past' | null => {
    if (!datePart) return null;
    const st = new Date(`${datePart}T${t}`);
    if (st < new Date()) return 'past';
    const en = new Date(st.getTime() + form.durationMinutes * 60_000);
    return dayEvents.some((e) => new Date(e.start_at) < en && new Date(e.end_at) > st) ? 'busy' : null;
  };

  const toggleMember = (id: string) =>
    setAttendeeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const updateGuest = (i: number, patch: Partial<ExternalAttendee>) =>
    setGuests((prev) => prev.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));

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
      allDay: false,
      attendeeIds,
      // Convidado sem nome é ignorado
      externalAttendees: guests
        .map((g) => ({ name: g.name.trim(), title: g.title?.trim() || undefined }))
        .filter((g) => g.name),
    });
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Panel header */}
      <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-fg/[0.06] px-5 py-4">
        <div className="min-w-0">
          <h3 className="truncate font-display text-[16px] font-semibold text-text-primary first-letter:uppercase">
            {day ? day.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : event ? 'Editar evento' : 'Novo evento'}
          </h3>
          <p className="mt-0.5 text-xs text-text-muted">{event ? 'Editar evento' : 'Novo evento'}</p>
        </div>
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

        {dayEvents.length > 0 && (
          <div className="space-y-2 border-b border-fg/[0.06] pb-4">
            <p className={sectionLabel}>{dayEvents.length === 1 ? '1 evento neste dia' : `${dayEvents.length} eventos neste dia`}</p>
            {dayEvents.map((e) => (
              <DayEventCard key={e.id} event={e} members={tenant?.members ?? []} onClick={() => onEventClick?.(e)} />
            ))}
          </div>
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

        <div className="flex flex-col gap-1">
          <label className={sectionLabel}>Data *</label>
          <DateField value={datePart} onChange={setDate} />
        </div>
        {/* Hora e duração lado a lado; a lista de horas desativa ocupados e passados */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex min-w-0 flex-col gap-1">
            <label className={sectionLabel}>Hora</label>
            <TimeField value={timePart} onChange={setTime} unavailable={slotState} list fromHour={7} toHour={20} />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label className={sectionLabel}>Duração</label>
            <DurationField value={form.durationMinutes} onChange={(v) => set('durationMinutes', v)} options={EVENT_DURATIONS} />
          </div>
        </div>

        {/* Pela empresa: os admins. Escolha um, outro ou os dois */}
        <div className="flex flex-col gap-2 border-t border-fg/[0.06] pt-4">
          <label className={cn(sectionLabel, 'flex items-center justify-between')}>
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Pela {tenant?.name ?? 'empresa'}
            </span>
            {admins.length > 1 && (
              <button
                type="button"
                onClick={() => setAttendeeIds(attendeeIds.length === admins.length ? [] : admins.map((a) => a.id))}
                className="text-[11px] font-medium text-accent-green hover:underline"
              >
                {attendeeIds.length === admins.length ? 'Limpar' : 'Todos'}
              </button>
            )}
          </label>
          {admins.length === 0 ? (
            <p className="text-xs text-text-muted">Nenhum admin no espaço.</p>
          ) : (
            <div className={cn('grid gap-2', admins.length > 1 && 'grid-cols-2')}>
              {admins.map((m) => {
                const on = attendeeIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    aria-pressed={on}
                    className={cn(
                      'relative flex min-w-0 items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors',
                      on ? 'border-accent-green/50 bg-accent-green/[0.1]' : 'border-fg/[0.08] hover:border-fg/[0.18] hover:bg-fg/[0.03]',
                    )}
                  >
                    <Avatar name={m.full_name} src={m.avatar_url} className="h-9 w-9 flex-shrink-0 text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-text-primary">{m.full_name.split(' ')[0]}</span>
                      <span className="block truncate text-[11px] text-text-muted">{titleOf(m.email)}</span>
                    </span>
                    <span
                      className={cn(
                        'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border transition-colors',
                        on ? 'border-accent-green bg-accent-green text-[rgb(var(--on-accent))]' : 'border-fg/[0.2]',
                      )}
                    >
                      {on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Lado do cliente: só nome e cargo */}
        <div className="flex flex-col gap-2 border-t border-fg/[0.06] pt-4">
          <label className={cn(sectionLabel, 'flex items-center gap-1.5')}>
            <Building2 className="h-3.5 w-3.5" /> Pela empresa do cliente
          </label>
          {guests.map((g, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                value={g.name}
                onChange={(e) => updateGuest(i, { name: e.target.value })}
                placeholder="Nome"
                maxLength={120}
                className="input-base h-9 min-w-0 flex-[1.2] text-sm"
              />
              <input
                value={g.title ?? ''}
                onChange={(e) => updateGuest(i, { title: e.target.value })}
                placeholder="Cargo"
                maxLength={80}
                className="input-base h-9 min-w-0 flex-1 text-sm"
              />
              <button
                type="button"
                onClick={() => setGuests((prev) => prev.filter((_, idx) => idx !== i))}
                aria-label="Remover pessoa"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-status-lost/10 hover:text-status-lost"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setGuests((prev) => [...prev, { name: '', title: '' }])}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-fg/[0.12] py-2 text-xs font-medium text-text-muted transition-colors hover:border-fg/[0.22] hover:text-text-primary"
          >
            <UserPlus className="h-3.5 w-3.5" /> Adicionar pessoa
          </button>
        </div>

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
    const start = date ? new Date(date) : new Date();
    if (hour !== undefined) start.setHours(hour, 0, 0, 0);
    // Passado: só consulta (os eventos existentes continuam abrindo)
    if (date && (hour !== undefined ? start.getTime() + 3_600_000 <= Date.now() : isPastDay(start))) return;
    setSelectedEvent(null);
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

  const isMobile = useIsMobile();
  const { data: tenant } = useTenant();
  const eventForm = (
    <EventFormPanel
      key={selectedEvent?.id ?? `new-${defaultFormData.startAt ?? ''}`}
      event={selectedEvent}
      allEvents={events}
      onEventClick={openEvent}
      initialData={defaultFormData}
      onSubmit={handleSubmit}
      onDelete={selectedEvent ? handleDelete : undefined}
      onClose={closePanel}
      isSubmitting={isSubmitting}
    />
  );

  const viewButtons: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
    { key: 'month', label: 'Mês', icon: <Calendar className="h-3.5 w-3.5" /> },
    { key: 'week', label: 'Semana', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
    { key: 'day', label: 'Dia', icon: <Clock className="h-3.5 w-3.5" /> },
    { key: 'list', label: 'Lista', icon: <List className="h-3.5 w-3.5" /> },
  ];

  return (
    // Calendário + painel do evento lado a lado, cada um no seu card (o painel abre como as notas)
    <div className="flex min-h-0 flex-1">
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-fg/[0.07] bg-bg-surface shadow-[0_24px_48px_-28px_rgba(0,0,0,0.6)]">
      {/* ── Toolbar ── */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-fg/[0.06] px-5 py-4">
        {/* ‹ período › — setas soltas, o título fica entre elas */}
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <button
            onClick={() => navigate('prev')}
            aria-label="Anterior"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-fg/[0.06] hover:text-text-primary"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="min-w-0 truncate px-1 font-display text-[22px] font-semibold tracking-[-0.02em] text-text-primary first-letter:uppercase">
            {headerTitle()}
          </h2>
          <button
            onClick={() => navigate('next')}
            aria-label="Próximo"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-fg/[0.06] hover:text-text-primary"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Busca compacta na própria barra */}
        <div className="relative w-56 max-lg:hidden">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar eventos…"
            className="input-base h-10 pl-9 pr-8 text-[13px]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

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
              selectedDate={panelOpen && defaultFormData.startAt ? new Date(`${defaultFormData.startAt.split('T')[0]}T12:00:00`) : undefined}
              dayClassName={(_, evs) => evs.length > 0 && 'bg-accent-green/[0.035]'}
              renderDay={(_, evs) => <DayTag events={evs} members={tenant?.members ?? []} />}
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

      </div>
    </div>

      {/* Computador: card próprio à direita; só a largura anima (o conteúdo tem largura fixa) */}
      <motion.aside
        className="hidden flex-shrink-0 overflow-hidden md:block"
        initial={false}
        animate={{ width: panelOpen ? PANEL_WIDTH : 0 }}
        transition={{ type: 'spring', visualDuration: 0.4, bounce: 0.08 }}
        aria-hidden={!panelOpen}
      >
        <div className="h-full pl-3" style={{ width: PANEL_WIDTH }}>
          <div className="flex h-full flex-col overflow-hidden rounded-[22px] border border-fg/[0.07] bg-bg-surface shadow-[0_24px_48px_-28px_rgba(0,0,0,0.6)]">
            {panelOpen && !isMobile && eventForm}
          </div>
        </div>
      </motion.aside>

      {/* Celular: tela cheia por cima */}
      <AnimatePresence>
        {panelOpen && isMobile && (
          <motion.div
            className="fixed inset-0 z-[60] flex flex-col bg-bg-surface md:hidden"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', visualDuration: 0.4, bounce: 0.08 }}
          >
            {eventForm}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
