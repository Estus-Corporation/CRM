import { useEffect, useRef, useState } from 'react';
import { addDays, addMonths, format, isSameDay, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Building2, Check, ChevronLeft, ChevronRight, Clock, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useAdminBusy } from '@/hooks/useCaptacao';
import { useTenant } from '@/hooks/useTenant';
import type { AdminBusySlot, MeetingGuest } from '@/services/captacao.service';
import type { CalendarEvent } from '@/services/calendar.service';
import { MonthView } from '@/components/calendar/EventManagerCalendar';
import { DurationField, TimeField } from '@/components/calendar/DateTimeFields';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useMediaQuery';

const hhmm = (d: Date) => format(d, 'HH:mm');
const DURATIONS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1h 30min' },
  { value: 120, label: '2 horas' },
];

/** Card no mesmo fundo dos cards de "Possíveis dores" */
const panel = 'rounded-[22px] border border-fg/[0.06] bg-fg/[0.025]';
const label = 'text-xs font-medium text-text-secondary';

/** Resumo de um dia ocupado na grade: etiqueta âmbar com quem, o primeiro horário e quantos compromissos */
function BusyDay({
  day,
  events,
  admins,
  busy,
}: {
  day: Date;
  events: CalendarEvent[];
  admins: { id: string; full_name: string; avatar_url: string | null }[];
  busy: AdminBusySlot[];
}) {
  if (events.length === 0) return null;
  const slots = busy.filter((b) => isSameDay(new Date(b.start), day));
  const names = [...new Set(slots.flatMap((s) => s.admins))];
  const people = names.map((n) => admins.find((a) => a.full_name.split(' ')[0] === n)).filter(Boolean) as typeof admins;

  return (
    <div className="flex h-full flex-col justify-end">
      {/* Etiqueta no pé do dia: quem está ocupado, a partir de que horas e quantos compromissos */}
      <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-accent-amber/25 bg-accent-amber/[0.1] py-1 pl-1 pr-2">
        {people.length > 0 ? (
          <div className="flex flex-shrink-0 -space-x-1.5">
            {people.slice(0, 2).map((p) => (
              <Avatar key={p.id} name={p.full_name} src={p.avatar_url} className="h-[18px] w-[18px] text-[8px] ring-1 ring-fg/[0.12]" />
            ))}
          </div>
        ) : (
          <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-accent-amber/20 text-accent-amber">
            <Clock size={11} />
          </span>
        )}
        <span className="min-w-0 truncate text-[11px] font-semibold tabular-nums text-accent-amber">{hhmm(new Date(slots[0].start))}</span>
        {slots.length > 1 && (
          <span className="ml-auto flex-shrink-0 rounded-full bg-accent-amber/20 px-1.5 text-[10px] font-bold text-accent-amber">{slots.length}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Celular: mês compacto — dias em bolinhas, ponto âmbar nos dias com compromisso.
 * Tocar num dia leva pro painel da reunião (etapa 2).
 */
function MobileMonth({
  month,
  setMonth,
  selected,
  busy,
  onPick,
  loading,
}: {
  month: Date;
  setMonth: (fn: (m: Date) => Date) => void;
  selected: Date;
  busy: AdminBusySlot[];
  onPick: (d: Date) => void;
  loading: boolean;
}) {
  const today = startOfDay(new Date());
  const start = startOfWeek(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const countOf = (d: Date) => busy.filter((b) => isSameDay(new Date(b.start), d)).length;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-1">
        <button type="button" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Mês anterior" className="flex h-10 w-10 items-center justify-center rounded-xl text-text-secondary hover:bg-fg/[0.06]">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="flex items-center gap-2 font-display text-[19px] font-semibold tracking-[-0.02em] text-text-primary">
          {(() => {
            const t = format(month, "MMMM 'de' yyyy", { locale: ptBR });
            return t.charAt(0).toUpperCase() + t.slice(1);
          })()}
          {loading && <Spinner />}
        </h2>
        <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Próximo mês" className="flex h-10 w-10 items-center justify-center rounded-xl text-text-secondary hover:bg-fg/[0.06]">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 text-center">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <span key={i} className="pb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {d}
          </span>
        ))}
        {days.map((d) => {
          const inMonth = d.getMonth() === month.getMonth();
          const past = d < today;
          const isToday = isSameDay(d, today);
          const isSel = isSameDay(d, selected);
          const count = countOf(d);
          return (
            <button key={d.toISOString()} type="button" onClick={() => onPick(d)} className="flex flex-col items-center gap-0.5 py-0.5">
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-medium tabular-nums transition-colors',
                  isSel
                    ? 'bg-accent-green font-semibold text-[rgb(var(--on-accent))]'
                    : isToday
                      ? 'text-accent-green ring-[1.5px] ring-accent-green/60'
                      : !inMonth
                        ? 'text-text-muted/40'
                        : past
                          ? 'text-text-muted'
                          : 'text-text-primary hover:bg-fg/[0.06]',
                )}
              >
                {d.getDate()}
              </span>
              {/* Ponto âmbar = dia com compromisso (dois pontos = mais de um) */}
              <span className="flex h-1.5 gap-0.5">
                {count > 0 && <span className="h-1.5 w-1.5 rounded-full bg-accent-amber" />}
                {count > 1 && <span className="h-1.5 w-1.5 rounded-full bg-accent-amber/60" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-text-muted">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-accent-amber" /> Tem compromisso</span>
      </div>
    </div>
  );
}

/** O que o captador escolhe na agenda: vira a reunião do lead (e o evento no calendário dos admins) */
export interface MeetingPick {
  /** "YYYY-MM-DDTHH:mm" */
  at: string;
  duration: number;
  attendeeIds: string[];
  guests: MeetingGuest[];
}

/**
 * Agenda dos admins pro captador marcar a reunião: o mês igual ao calendário dos admins (só os horários
 * ocupados, sem detalhes) e, ao lado, o formulário da reunião como o criador de eventos —
 * hora, duração, quem participa pela empresa e convidados do cliente.
 */
export function AdminAgenda({
  open,
  onClose,
  onPick,
  initial,
  defaultGuest,
  leadName,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (pick: MeetingPick) => void;
  /** Reunião já escolhida (reabrir pra trocar) */
  initial?: Partial<MeetingPick>;
  /** Convidado sugerido: o contato do lead */
  defaultGuest?: MeetingGuest;
  /** Nome da empresa do lead (título do lado dele na reunião) */
  leadName?: string;
  /** Reunião já marcada: botão pra excluir (limpa a reunião do lead) */
  onRemove?: () => void;
}) {
  const today = startOfDay(new Date());
  const initialDate = initial?.at ? startOfDay(new Date(initial.at)) : today;
  const [month, setMonth] = useState(startOfMonth(initialDate));
  const [selected, setSelected] = useState(initialDate);
  const [time, setTime] = useState(initial?.at ? initial.at.split('T')[1] : '');
  const [duration, setDuration] = useState(initial?.duration ?? 60);
  const [attendeeIds, setAttendeeIds] = useState<string[]>(initial?.attendeeIds ?? []);
  const [guests, setGuests] = useState<MeetingGuest[]>(initial?.guests?.length ? initial.guests : defaultGuest ? [defaultGuest] : []);

  const { data: tenant } = useTenant();
  const isMobile = useIsMobile();
  const dayRef = useRef<HTMLDivElement>(null);
  const admins = (tenant?.members ?? []).filter((m) => m.role === 'admin');
  const titleOf = (email: string) =>
    tenant?.key_people?.find((p) => p.email?.toLowerCase() === email.toLowerCase())?.title ?? 'Admin';

  // Ao abrir: volta pra reunião já escolhida (ou começa do zero, no dia de hoje)
  useEffect(() => {
    if (!open) return;
    const d = initial?.at ? startOfDay(new Date(initial.at)) : today;
    setMonth(startOfMonth(d));
    setSelected(d);
    setTime(initial?.at ? initial.at.split('T')[1] : '');
    setDuration(initial?.duration ?? 60);
    setAttendeeIds(initial?.attendeeIds ?? []);
    setGuests(initial?.guests?.length ? initial.guests : defaultGuest ? [defaultGuest] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Sem escolha prévia: todos os admins marcados
  useEffect(() => {
    if (open && !initial?.attendeeIds?.length && attendeeIds.length === 0 && admins.length) setAttendeeIds(admins.map((a) => a.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, admins.length]);

  const gridStart = startOfWeek(month);
  const { data: busy = [], isLoading } = useAdminBusy(open, gridStart, addDays(gridStart, 42));
  const who = (s: AdminBusySlot) => (s.admins.length ? s.admins.join(', ') : 'Reunião de captação');
  const daySlots = busy.filter((b) => isSameDay(new Date(b.start), selected));

  // Ocupados no formato de evento: a visão de mês é a mesma do calendário dos admins
  const events = busy.map((b, i) => ({
    id: `busy-${i}`,
    title: `Ocupado · ${who(b)}`,
    start_at: b.start,
    end_at: b.end,
    all_day: false,
  })) as unknown as CalendarEvent[];

  const pastDay = selected < today;
  const start = time ? new Date(`${format(selected, 'yyyy-MM-dd')}T${time}`) : null;
  const end = start ? new Date(start.getTime() + duration * 60_000) : null;
  const pastTime = !!start && start < new Date();
  const conflicts = start && end ? busy.filter((b) => new Date(b.start) < end && new Date(b.end) > start) : [];
  const canConfirm = !!start && !pastDay && !pastTime && attendeeIds.length > 0;

  // Horário da lista: ocupado (com a duração escolhida) ou já passado
  const slotState = (t: string): 'busy' | 'past' | null => {
    const st = new Date(`${format(selected, 'yyyy-MM-dd')}T${t}`);
    if (st < new Date()) return 'past';
    const en = new Date(st.getTime() + duration * 60_000);
    return busy.some((b) => new Date(b.start) < en && new Date(b.end) > st) ? 'busy' : null;
  };

  const toggleAdmin = (id: string) => setAttendeeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const updateGuest = (i: number, patch: Partial<MeetingGuest>) => setGuests((prev) => prev.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));

  const confirm = () => {
    if (!canConfirm) return;
    onPick({
      at: `${format(selected, 'yyyy-MM-dd')}T${time}`,
      duration,
      attendeeIds,
      guests: guests.map((g) => ({ name: g.name.trim(), title: g.title?.trim() || undefined })).filter((g) => g.name),
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Agenda dos admins" hideHeader className="max-h-[calc(100dvh-1.5rem)] max-w-6xl overflow-y-auto overscroll-contain pt-12 max-md:max-h-[calc(100dvh-1rem)] max-md:w-[calc(100%-1rem)] max-md:p-3 max-md:pt-12">
      <div className="flex gap-3 max-md:flex-col md:h-[min(70vh,740px)]">
        {/* Calendário: igual ao dos admins */}
        {isMobile ? (
          (
            <div className={cn(panel, 'p-3')}>
              <MobileMonth
                month={month}
                setMonth={setMonth}
                selected={selected}
                busy={busy}
                loading={isLoading}
                onPick={(d) => {
                  setSelected(d);
                  // Leva até o painel do dia, logo abaixo
                  window.setTimeout(() => dayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                }}
              />
            </div>
          )
        ) : (
        <div className={cn(panel, 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden')}>
          <div className="flex flex-shrink-0 items-center gap-3 border-b border-fg/[0.06] px-5 py-4">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <button type="button" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Mês anterior" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-fg/[0.06] hover:text-text-primary">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="min-w-0 truncate px-1 font-display text-[22px] font-semibold tracking-[-0.02em] text-text-primary first-letter:uppercase">
                {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
              </h2>
              <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Próximo mês" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-fg/[0.06] hover:text-text-primary">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            {isLoading && <Spinner />}
          </div>
          <MonthView
            currentDate={month}
            events={events}
            selectedDate={selected}
            allowPastClick
            onDayClick={setSelected}
            onEventClick={(e) => setSelected(startOfDay(new Date(e.start_at)))}
            dayClassName={(_, evs) => evs.length > 0 && 'bg-accent-amber/[0.045]'}
            renderDay={(day, evs) => <BusyDay day={day} events={evs} admins={admins} busy={busy} />}
          />
        </div>
        )}

        {/* Reunião: como o criador de eventos */}
        {(
        <div ref={dayRef} className={cn(panel, 'flex min-h-0 flex-shrink-0 scroll-mt-2 flex-col overflow-hidden md:w-[340px]')}>
          <div className="flex items-center gap-2 border-b border-fg/[0.06] px-5 py-4">
            <div className="min-w-0">
              <p className="truncate font-display text-[16px] font-semibold text-text-primary first-letter:uppercase">
                {format(selected, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">{pastDay ? 'Dia que já passou — só consulta' : 'Nova reunião com o lead'}</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {/* Compromissos do dia: horário em destaque, duração e quem está ocupado */}
            {daySlots.length > 0 ? (
              <div className="space-y-2">
                <p className={label}>
                  {daySlots.length === 1 ? '1 compromisso neste dia' : `${daySlots.length} compromissos neste dia`}
                </p>
                {daySlots.map((sl, i) => {
                  const st = new Date(sl.start);
                  const en = new Date(sl.end);
                  const mins = Math.round((en.getTime() - st.getTime()) / 60_000);
                  const people = sl.admins
                    .map((first) => admins.find((a) => a.full_name.split(' ')[0] === first))
                    .filter(Boolean) as typeof admins;
                  return (
                    <div key={i} className="flex min-w-0 overflow-hidden rounded-xl border border-fg/[0.07] bg-fg/[0.02]">
                      {/* Horário */}
                      <div className="flex w-[74px] flex-shrink-0 flex-col items-center justify-center border-r border-fg/[0.06] bg-accent-amber/[0.07] py-2.5">
                        <span className="font-display text-[16px] font-semibold tabular-nums text-text-primary">{hhmm(st)}</span>
                        <span className="text-[11px] tabular-nums text-text-muted">até {hhmm(en)}</span>
                      </div>
                      {/* O que é e quem está */}
                      <div className="min-w-0 flex-1 px-3 py-2.5">
                        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
                          <span className="h-1.5 w-1.5 rounded-full bg-accent-amber" />
                          {sl.kind === 'lead_meeting' ? 'Reunião da captação' : 'Ocupado'}
                          <span className="font-normal text-text-muted">· {mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}min` : ''}` : `${mins} min`}</span>
                        </p>
                        {people.length > 0 ? (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <div className="flex -space-x-1.5">
                              {people.map((p) => (
                                <Avatar key={p.id} name={p.full_name} src={p.avatar_url} className="h-5 w-5 text-[9px] ring-1 ring-fg/[0.12]" />
                              ))}
                            </div>
                            <span className="truncate text-xs text-text-secondary">{sl.admins.join(' e ')}</span>
                          </div>
                        ) : (
                          sl.admins.length > 0 && <p className="mt-1 truncate text-xs text-text-secondary">{sl.admins.join(' e ')}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              pastDay && (
                <div className="flex flex-col items-center py-10 text-center">
                  <Clock className="mb-2 h-6 w-6 text-text-muted" />
                  <p className="text-sm text-text-secondary">Nenhum compromisso neste dia</p>
                </div>
              )
            )}

            {!pastDay && (
              <>
                {/* Hora e duração lado a lado; a lista de horas já desativa ocupados e passados */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className={label}>Hora *</span>
                    <TimeField value={time} onChange={setTime} unavailable={slotState} list fromHour={7} toHour={20} />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className={label}>Duração</span>
                    <DurationField value={duration} onChange={setDuration} options={DURATIONS} />
                  </div>
                </div>
                {start && end && !pastTime && (
                  <p className="-mt-1.5 text-xs text-text-muted">
                    Das <strong className="font-semibold tabular-nums text-text-primary">{hhmm(start)}</strong> às{' '}
                    <strong className="font-semibold tabular-nums text-text-primary">{hhmm(end)}</strong>
                  </p>
                )}
                {pastTime && <p className="text-xs text-status-lost">Esse horário já passou.</p>}
                {conflicts.length > 0 && !pastTime && (
                  <p className="flex items-start gap-1.5 rounded-lg bg-accent-amber/[0.1] px-2.5 py-2 text-xs text-accent-amber">
                    <AlertTriangle size={13} className="mt-px flex-shrink-0" />
                    Com essa duração, bate com um horário ocupado ({[...new Set(conflicts.map(who))].join(', ')}).
                  </p>
                )}

                {/* Lado da empresa: os admins que vão à reunião */}
                <div className="flex flex-col gap-2 border-t border-fg/[0.06] pt-4">
                  <span className={cn(label, 'flex items-center gap-1.5')}>
                    <Users className="h-3.5 w-3.5" /> Pela {tenant?.name ?? 'empresa'} *
                  </span>
                  <div className={cn('grid gap-2', admins.length > 1 && 'grid-cols-2')}>
                    {admins.map((m) => {
                      const on = attendeeIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleAdmin(m.id)}
                          aria-pressed={on}
                          className={cn(
                            'flex min-w-0 items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors',
                            on ? 'border-accent-green/50 bg-accent-green/[0.1]' : 'border-fg/[0.08] hover:border-fg/[0.18]',
                          )}
                        >
                          <Avatar name={m.full_name} src={m.avatar_url} className="h-8 w-8 flex-shrink-0 text-xs" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-text-primary">{m.full_name.split(' ')[0]}</span>
                            <span className="block truncate text-[11px] text-text-muted">{titleOf(m.email)}</span>
                          </span>
                          <span
                            className={cn(
                              'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border',
                              on ? 'border-accent-green bg-accent-green text-[rgb(var(--on-accent))]' : 'border-fg/[0.2]',
                            )}
                          >
                            {on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Lado do lead: quem vai pela empresa do cliente (nome e cargo) */}
                <div className="flex flex-col gap-2 border-t border-fg/[0.06] pt-4">
                  <span className={cn(label, 'flex items-center gap-1.5')}>
                    <Building2 className="h-3.5 w-3.5" /> Pela {leadName ?? 'empresa do lead'}
                  </span>
                  {guests.map((g, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <input value={g.name} onChange={(e) => updateGuest(i, { name: e.target.value })} placeholder="Nome" maxLength={120} className="input-base h-9 min-w-0 flex-[1.2] text-sm" />
                      <input value={g.title ?? ''} onChange={(e) => updateGuest(i, { title: e.target.value })} placeholder="Cargo" maxLength={80} className="input-base h-9 min-w-0 flex-1 text-sm" />
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

              </>
            )}
          </div>

          {(!pastDay || onRemove) && (
            <div className="flex items-center gap-2 border-t border-fg/[0.06] px-5 py-4">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancelar
              </Button>
              {onRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!window.confirm('Excluir a reunião marcada com este lead?')) return;
                    onRemove();
                    onClose();
                  }}
                  className="text-status-lost hover:bg-status-lost/10 hover:text-status-lost"
                >
                  <Trash2 size={14} />
                  Excluir reunião
                </Button>
              )}
              {!pastDay && (
                <Button type="button" size="sm" onClick={confirm} disabled={!canConfirm} className="ml-auto">
                  <Check size={14} />
                  Confirmar reunião
                </Button>
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </Modal>
  );
}
