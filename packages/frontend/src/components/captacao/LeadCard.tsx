import { forwardRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Building2, CalendarClock, CalendarDays, ClipboardList, Tag, User, CalendarPlus, PhoneCall, Check, CheckCircle2, ChevronDown, ChevronRight, Globe, Instagram, Link2, Lock, MapPin, MapPinOff, Megaphone, MessageSquare, Pencil, Phone, Star, StarHalf, Trophy, Video,
} from 'lucide-react';
import { useUpdateMyLead } from '@/hooks/useCaptacao';
import type { CallStatus, MeetingGuest, MeetingMode, MyLead } from '@/services/captacao.service';
import { SelectDropdown } from '@/components/ui/SelectDropdown';
import {
  CALL_STATUS,
  CALL_STATUS_ORDER,
  formatBRL,
  googleUrl,
  instagramHandle,
  instagramUrl,
  LEAD_PAIN_LABEL,
  leadPains,
  type LeadPain,
  websiteLabel,
  websiteUrl,
  whatsappUrl,
} from '@/lib/captacao';
import { GmailIcon, InstagramIcon, GoogleIcon, WhatsAppIcon } from '@/components/ui/BrandIcons';
import { Button } from '@/components/ui/Button';
import { AdminAgenda, type MeetingPick } from './AdminAgenda';
import { QuickLink } from '@/components/ui/QuickLink';
import { listSpring } from '@/components/ui/DataList';
import { cn } from '@/lib/utils';

const MEETING_MODES = [
  { value: 'online', label: 'Online', icon: Video },
  { value: 'presencial', label: 'Presencial', icon: MapPin },
] as const;

const PAIN_ICON: Record<LeadPain, typeof Globe> = {
  no_site: Globe,
  no_instagram: Instagram,
  no_marketing: Megaphone,
  no_google: MapPinOff,
  few_reviews: MessageSquare,
  low_rating: StarHalf,
};

/** ISO do banco → "YYYY-MM-DDTHH:mm" no fuso local (formato do DateTimePicker) */
function toLocalInput(iso: string | null) {
  return iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : '';
}

function formatMeeting(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: CallStatus }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', CALL_STATUS[status].className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', CALL_STATUS[status].dot)} />
      {CALL_STATUS[status].label}
    </span>
  );
}

/**
 * Lead pra quem liga. Lista: resumo clicável (abre a página do lead) com status e atalhos de um clique.
 * Página (detail): resultado da ligação, agenda da reunião e anotações + sobre, dores e dados do lugar.
 * "Concluir lead" fecha num resumo; "Editar" reabre.
 */
// forwardRef: a lista usa AnimatePresence "popLayout", que precisa do ref do item pra animar a saída
export const LeadCard = forwardRef<HTMLLIElement, { lead: MyLead; index?: number; detail?: boolean }>(function LeadCard(
  { lead, index = 0, detail = false },
  ref,
) {
  const navigate = useNavigate();
  const update = useUpdateMyLead();
  // Concluir tem estado próprio: o salvamento da anotação (no blur, ao clicar no botão) não pode travá-lo
  const concludeMutation = useUpdateMyLead();
  const [notes, setNotes] = useState(lead.call_notes ?? '');
  // Resultado e agenda da reunião ficam só na tela até "Concluir lead" — um único envio ao servidor
  const [status, setStatus] = useState<CallStatus>(lead.call_status);
  const [meetingAt, setMeetingAt] = useState(toLocalInput(lead.meeting_at));
  const [meetingMode, setMeetingMode] = useState<MeetingMode | null>(lead.meeting_mode);
  const [meetingLocation, setMeetingLocation] = useState(lead.meeting_location ?? '');
  const [agendaOpen, setAgendaOpen] = useState(false);
  // Detalhes escolhidos na agenda (vão pro evento do calendário dos admins)
  const [meetingDuration, setMeetingDuration] = useState(lead.meeting_duration ?? 60);
  const [meetingAttendeeIds, setMeetingAttendeeIds] = useState<string[]>(lead.meeting_attendee_ids ?? []);
  const [meetingGuests, setMeetingGuests] = useState<MeetingGuest[]>(lead.meeting_guests ?? []);
  const [showAgenda, setShowAgenda] = useState(!!lead.meeting_at);
  const locked = lead.outcome !== null;
  const concluded = !!lead.concluded_at && !locked;
  const isMeeting = status === 'meeting';
  const meetingMissing = isMeeting && (!meetingAt || !meetingMode);

  // Mantém rascunho e resultado em sincronia quando o servidor devolve outro valor
  useEffect(() => setNotes(lead.call_notes ?? ''), [lead.call_notes]);
  useEffect(() => setStatus(lead.call_status), [lead.call_status]);
  useEffect(() => {
    if (status === 'meeting') setShowAgenda(true);
  }, [status]);
  useEffect(() => {
    setMeetingAt(toLocalInput(lead.meeting_at));
    setMeetingMode(lead.meeting_mode);
    setMeetingLocation(lead.meeting_location ?? '');
    setMeetingDuration(lead.meeting_duration ?? 60);
    setMeetingAttendeeIds(lead.meeting_attendee_ids ?? []);
    setMeetingGuests(lead.meeting_guests ?? []);
    // Listas comparadas pelo conteúdo: cada resposta do servidor traz arrays novos (salvar a anotação
    // não pode apagar a reunião que ainda está só na tela)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.meeting_at, lead.meeting_mode, lead.meeting_location, lead.meeting_duration, JSON.stringify(lead.meeting_attendee_ids), JSON.stringify(lead.meeting_guests)]);

  const saveNotes = () => {
    if (locked || notes.trim() === (lead.call_notes ?? '')) return;
    update.mutate({ id: lead.id, callNotes: notes });
  };

  const conclude = () => {
    if (status === 'pending') {
      toast.error('Escolha o resultado da ligação antes de concluir');
      return;
    }
    if (meetingMissing) {
      toast.error('Informe dia, horário e formato da reunião');
      return;
    }
    // Manda resultado + anotação + agenda juntos: um único salvamento
    concludeMutation.mutate(
      {
        id: lead.id,
        concluded: true,
        callStatus: status,
        callNotes: notes,
        ...(isMeeting && {
          meetingAt: new Date(meetingAt).toISOString(),
          meetingMode,
          meetingLocation: meetingLocation.trim() || null,
          meetingDuration,
          meetingAttendeeIds,
          meetingGuests,
        }),
      },
      { onSuccess: () => toast.success(`${lead.full_name} concluído`) },
    );
  };

  const reopen = () => update.mutate({ id: lead.id, concluded: false });

  // Montou a reunião na agenda → o resultado vira "Reunião marcada"
  const pickMeeting = (pick: MeetingPick) => {
    setMeetingAt(pick.at);
    setMeetingDuration(pick.duration);
    setMeetingAttendeeIds(pick.attendeeIds);
    setMeetingGuests(pick.guests);
    setStatus('meeting');
  };
  const pickMeetingMode = (m: MeetingMode) => {
    setMeetingMode(m);
    setStatus('meeting');
  };
  // Outro resultado → a reunião preenchida sai na hora
  const chooseStatus = (s: CallStatus) => {
    setStatus(s);
    if (s !== 'meeting') {
      setMeetingAt('');
      setMeetingMode(null);
      setMeetingLocation('');
      setMeetingDuration(60);
      setMeetingAttendeeIds([]);
      setMeetingGuests([]);
      setShowAgenda(false);
    }
  };

  const company = [lead.job_title, lead.company_name].filter(Boolean).join(' · ');
  const pains = leadPains(lead);
  const about =
    lead.lead_context?.trim() ||
    (lead.niche
      ? `${lead.company_name || lead.full_name} atua no ramo de ${lead.niche.toLowerCase()}.`
      : null);

  // Em que pé está o lead (lista e cabeçalho da página)
  const state = locked
    ? lead.outcome === 'won'
      ? { label: 'Fechou negócio', className: 'bg-accent-green/15 text-accent-green', dot: 'bg-accent-green' }
      : { label: 'Não fechou', className: 'bg-fg/[0.08] text-text-secondary', dot: 'bg-text-muted' }
    : lead.call_status === 'pending'
      ? { label: 'Pendente', className: 'border border-dashed border-fg/[0.2] text-text-muted', dot: 'bg-text-muted' }
      : CALL_STATUS[lead.call_status];
  const stateBadge = (
    <span
      className={cn(
        'inline-flex flex-shrink-0 items-center rounded-full font-medium',
        detail ? 'h-10 gap-2 px-4 text-sm' : 'gap-1.5 px-2.5 py-1 text-xs',
        state.className,
      )}
    >
      <span className={cn('rounded-full', detail ? 'h-2 w-2' : 'h-1.5 w-1.5', state.dot)} />
      {state.label}
    </span>
  );

  const identity = (
    <>
      <div className={cn('flex flex-shrink-0 items-center justify-center rounded-xl bg-fg/[0.08] text-text-primary', detail ? 'h-14 w-14' : 'h-11 w-11')}>
        <Building2 size={detail ? 24 : 20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <p className={cn('truncate text-text-primary', detail ? 'page-title-sm' : 'text-[15.5px] font-semibold')}>{lead.full_name}</p>
          {lead.google_rating !== null && (
            <span className="flex items-center gap-1 text-xs text-text-secondary" title="Avaliação no Google">
              <Star size={12} className="fill-accent-amber text-accent-amber" />
              <strong className="font-semibold text-text-primary">{lead.google_rating.toFixed(1)}</strong>
              {lead.google_reviews !== null && <span className="text-text-muted">({lead.google_reviews})</span>}
            </span>
          )}
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-text-muted">
          {company && (
            <span className="flex min-w-0 max-w-full items-center gap-1">
              <Building2 size={12} className="flex-shrink-0" />
              <span className="truncate">{company}</span>
            </span>
          )}
          {lead.niche && (
            <span className="max-w-full truncate whitespace-nowrap rounded-md bg-fg/[0.05] px-2 py-0.5 font-medium text-text-secondary">{lead.niche}</span>
          )}
          {/* Lista no celular: o status vai pra cá (à direita não cabe junto do nome) */}
          {!detail && <span className="sm:hidden">{stateBadge}</span>}
        </div>
      </div>
    </>
  );

  if (!detail) {
    return (
      <motion.li
        ref={ref}
        layout
        initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { ...listSpring, delay: Math.min(index * 0.04, 0.35) } }}
        exit={{ opacity: 0, x: -12, transition: { duration: 0.2 } }}
        transition={listSpring}
        onClick={() => navigate(`/meus-leads/lead/${lead.id}`)}
        className={cn('card card-interactive group flex cursor-pointer items-center gap-4 overflow-hidden p-4 md:px-5', concluded && 'opacity-80')}
      >
        {identity}
        {/* À direita: só o status do lead e a seta */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="max-sm:hidden">{stateBadge}</span>
          <ChevronRight size={18} className="text-text-muted transition-transform group-hover:translate-x-0.5" />
        </div>
      </motion.li>
    );
  }

  // Atalhos de um clique (cabeçalho da página)
  const quickLinks = (
    <>
      {lead.phone && (
        <QuickLink href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`} label="Ligar" className="text-text-primary">
          <Phone size={18} fill="currentColor" strokeWidth={1} />
        </QuickLink>
      )}
      {lead.phone && (
        <QuickLink href={whatsappUrl(lead.phone)} label="Abrir no WhatsApp" className="text-[#25D366]">
          <WhatsAppIcon size={20} />
        </QuickLink>
      )}
      {lead.instagram && (
        <QuickLink href={instagramUrl(lead.instagram)} label={`Instagram ${instagramHandle(lead.instagram)}`}>
          <InstagramIcon size={23} />
        </QuickLink>
      )}
      <QuickLink href={googleUrl(lead)} label={lead.maps_url ? 'Página no Google' : 'Buscar no Google Maps'}>
        <GoogleIcon size={19} />
      </QuickLink>
      {lead.website && (
        <QuickLink href={websiteUrl(lead.website)} label={`Site: ${websiteLabel(lead.website)}`} className="text-text-primary">
          <Globe size={19} />
        </QuickLink>
      )}
      {lead.email && (
        <QuickLink href={`mailto:${lead.email}`} label={`E-mail: ${lead.email}`}>
          <GmailIcon size={19} />
        </QuickLink>
      )}
    </>
  );

  // Ficha do "Sobre o lead": tudo que se sabe, uma linha por informação
  const facts = [
    lead.company_name && { icon: Building2, label: 'Empresa', value: lead.company_name },
    lead.job_title && { icon: User, label: 'Cargo', value: lead.job_title },
    lead.niche && { icon: Tag, label: 'Segmento', value: lead.niche },
    lead.address && { icon: MapPin, label: 'Endereço', value: lead.address, href: googleUrl(lead) },
    { icon: CalendarDays, label: 'Recebido em', value: format(new Date(`${lead.assigned_for.slice(0, 10)}T12:00:00`), "d 'de' MMM 'de' yyyy", { locale: ptBR }) },
  ].filter(Boolean) as { icon: typeof Globe; label: string; value: string; href?: string }[];


  // Página do lead: cabeçalho; à esquerda a ligação, à direita contato, sobre e dores
  return (
    <div className="mobile-split grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="max-lg:order-1 lg:col-span-2">
        <div className="card flex flex-wrap items-center gap-4 p-5 md:p-6">
          {identity}
          <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
            {quickLinks}
            <span className="mx-1 h-6 w-px bg-fg/[0.1] max-sm:hidden" />
            {stateBadge}
          </div>
        </div>
      </div>

      <div className="max-lg:order-3">
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-fg/[0.06] px-4 py-3.5 md:px-5">
            <PhoneCall size={16} className="text-accent-green" />
            <h2 className="text-sm font-semibold text-text-primary">Ligação</h2>
          </div>
      {/* Resultado */}
      <div className="p-4 md:p-5">
        {locked ? (
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm',
              lead.outcome === 'won' ? 'bg-accent-green/10 text-accent-green' : 'bg-fg/[0.05] text-text-secondary',
            )}
          >
            {lead.outcome === 'won' ? <Trophy size={15} /> : <Lock size={14} />}
            {lead.outcome === 'won' ? (
              <span>
                Fechou negócio! Sua comissão: <strong>{formatBRL(lead.commission_value)}</strong>
                {lead.commission_paid_at ? ' · paga' : ' · a receber'}
              </span>
            ) : (
              <span>Encerrado pelo administrador: não fechou.</span>
            )}
          </div>
        ) : concluded ? (
          // Resumo do que houve; "Editar" reabre
          <div className="flex flex-wrap items-center gap-3">
            <CheckCircle2 size={18} className="flex-shrink-0 text-accent-green" />
            <StatusBadge status={lead.call_status} />
            {lead.call_status === 'meeting' && lead.meeting_at && (
              <span className="flex items-center gap-1 text-xs font-medium text-accent-green">
                <CalendarClock size={13} />
                {formatMeeting(lead.meeting_at)} · {lead.meeting_mode === 'online' ? 'Online' : 'Presencial'}
                {lead.meeting_location && <span className="font-normal text-text-muted">· {lead.meeting_location}</span>}
              </span>
            )}
            <p className="min-w-0 flex-1 truncate text-sm text-text-secondary" title={lead.call_notes ?? undefined}>
              {lead.call_notes || <span className="text-text-muted">Sem anotações</span>}
            </p>
            <span className="text-xs text-text-muted">
              Concluído {new Date(lead.concluded_at!).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
            <Button variant="ghost" size="sm" onClick={reopen} disabled={update.isPending}>
              <Pencil size={13} />
              Editar
            </Button>
          </div>
        ) : (
          <>
            {/* Agenda: botão que abre o bloco da reunião (confere a agenda dos admins e marca o horário) */}
            <button
              type="button"
              onClick={() => setShowAgenda((v) => !v)}
              aria-expanded={showAgenda}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
                // Mesmo fundo dos cards de "Possíveis dores", aberto ou fechado
                'border-fg/[0.06] bg-fg/[0.025] hover:border-fg/[0.14]',
              )}
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-fg/[0.06] text-text-primary">
                <CalendarClock size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-text-primary">Agenda</span>
                <span className="block truncate text-xs text-text-muted">
                  {meetingAt
                    ? `Reunião ${format(new Date(meetingAt), "EEE, d 'de' MMM 'às' HH:mm", { locale: ptBR })}${meetingMode ? ` · ${meetingMode === 'online' ? 'Online' : 'Presencial'}` : ''}`
                    : 'Data e hora da reunião'}
                </span>
              </span>
              <ChevronDown size={17} className={cn('flex-shrink-0 text-text-muted transition-transform duration-300', showAgenda && 'rotate-180')} />
            </button>

            <AnimatePresence initial={false}>
              {showAgenda && (
                <motion.div
                  key="meeting"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', visualDuration: 0.32, bounce: 0.1 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 rounded-2xl border border-fg/[0.06] bg-fg/[0.025] p-4">

                    <div className="grid max-w-3xl gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                      {(() => {
                        const date = meetingAt ? new Date(meetingAt) : null;
                        const open = () => setAgendaOpen(true);
                        return (
                          <button
                            type="button"
                            onClick={open}
                            className={cn(
                              'group flex h-[76px] w-full items-center gap-3 rounded-xl border px-3 text-left transition-colors',
                              date
                                ? 'border-fg/[0.06] bg-fg/[0.025] hover:border-accent-green/40'
                                : 'border-dashed border-fg/[0.14] bg-fg/[0.025] hover:border-accent-green/50 hover:bg-accent-green/[0.04]',
                            )}
                          >
                            {date ? (
                              <>
                                <span className="flex h-[52px] w-12 flex-shrink-0 flex-col overflow-hidden rounded-lg bg-bg-surface text-center shadow-sm ring-1 ring-fg/[0.06]">
                                  <span className="bg-accent-green py-0.5 text-[10px] font-bold uppercase tracking-wider text-[rgb(var(--on-accent))]">
                                    {format(date, 'MMM', { locale: ptBR }).replace('.', '')}
                                  </span>
                                  <span className="flex flex-1 items-center justify-center text-lg font-bold tabular-nums text-text-primary">
                                    {format(date, 'd')}
                                  </span>
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[13px] capitalize text-text-secondary">
                                    {format(date, 'EEEE', { locale: ptBR })}
                                  </span>
                                  <span className="block text-lg font-semibold leading-tight tabular-nums text-text-primary">
                                    {format(date, 'HH:mm')}
                                  </span>
                                </span>
                                <Pencil size={13} className="flex-shrink-0 text-text-muted transition-colors group-hover:text-accent-green" />
                              </>
                            ) : (
                              <>
                                <span className="flex h-[52px] w-12 flex-shrink-0 items-center justify-center rounded-lg bg-fg/[0.05] text-text-muted transition-colors group-hover:text-accent-green">
                                  <CalendarPlus size={20} />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium text-text-primary">Data e Hora</span>
                                  <span className="block text-xs text-text-muted">Abre a agenda dos admins</span>
                                </span>
                              </>
                            )}
                          </button>
                        );
                      })()}

                      <div className="grid grid-cols-2 gap-2">
                        {MEETING_MODES.map(({ value, label, icon: Icon }) => {
                          const active = meetingMode === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => pickMeetingMode(value)}
                              aria-pressed={active}
                              className={cn(
                                // Celular: ícone em cima e nome embaixo, centralizados (lado a lado o check cobria o nome)
                                'relative flex h-[76px] min-w-0 items-center gap-3 rounded-xl border px-3 text-left transition-colors max-sm:h-auto max-sm:flex-col max-sm:justify-center max-sm:gap-1.5 max-sm:py-3 max-sm:text-center',
                                active ? 'border-accent-green/60 bg-accent-green/[0.12]' : 'border-fg/[0.06] bg-fg/[0.025] hover:border-fg/[0.16]',
                              )}
                            >
                              {/* Ícone grande à esquerda, como no "Data e Hora" */}
                              <span
                                className={cn(
                                  'flex h-[52px] w-12 flex-shrink-0 items-center justify-center rounded-lg transition-colors max-sm:h-9 max-sm:w-9',
                                  active ? 'bg-accent-green/20 text-accent-green' : 'bg-fg/[0.05] text-text-muted',
                                )}
                              >
                                <Icon size={21} />
                              </span>
                              <span className="min-w-0">
                                <span className={cn('block text-sm font-semibold max-sm:text-[13px]', active ? 'text-text-primary' : 'text-text-secondary')}>{label}</span>
                              </span>
                              {active && (
                                <motion.span
                                  layoutId={`meeting-check-${lead.id}`}
                                  className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent-green text-[rgb(var(--on-accent))]"
                                >
                                  <Check size={10} strokeWidth={3} />
                                </motion.span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {meetingMode && (
                      <div className="relative mt-3 max-w-3xl">
                        {meetingMode === 'online' ? (
                          <Link2 size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                        ) : (
                          <MapPin size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                        )}
                        <input
                          value={meetingLocation}
                          onChange={(e) => setMeetingLocation(e.target.value)}
                          maxLength={500}
                          placeholder={meetingMode === 'online' ? 'Link da chamada (Meet, Zoom, WhatsApp…) — opcional' : 'Endereço da reunião — opcional'}
                          className="input-base h-11 border-fg/[0.06] bg-fg/[0.025] pl-10 text-sm"
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="mb-2.5 mt-5 text-[13px] font-medium text-text-secondary">O que aconteceu na ligação?</p>
            <SelectDropdown
              title="Resultado"
              placeholder="Selecionar resultado"
              options={CALL_STATUS_ORDER.filter((s) => s !== 'pending').map((s) => ({ value: s, label: CALL_STATUS[s].label }))}
              value={status}
              onChange={chooseStatus}
              className="sm:hidden"
            />
            <div className="flex flex-wrap gap-2 max-sm:hidden">
              {CALL_STATUS_ORDER.filter((s) => s !== 'pending').map((s) => {
                const active = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => chooseStatus(s)}
                    className={cn(
                      'flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
                      active
                        ? cn(CALL_STATUS[s].className, 'border-transparent font-semibold')
                        : 'border-fg/[0.08] text-text-secondary hover:border-fg/[0.16] hover:text-text-primary',
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', CALL_STATUS[s].dot)} />
                    {CALL_STATUS[s].label}
                  </button>
                );
              })}
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={2}
              maxLength={2000}
              placeholder="Anotações (com quem falou, objeções, melhor horário para retornar…)"
              className="input-base mt-3 min-h-[64px] resize-y border-fg/[0.06] bg-fg/[0.025] py-2 text-sm"
            />

            <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
              {(status === 'pending' || meetingMissing) && (
                <span className="mr-auto text-xs text-text-muted">
                  {status === 'pending' ? 'Escolha o resultado para concluir.' : 'Defina dia, horário e formato da reunião na Agenda.'}
                </span>
              )}
              <Button onClick={conclude} disabled={concludeMutation.isPending || status === 'pending' || meetingMissing}>
                <CheckCircle2 size={15} />
                {concludeMutation.isPending ? 'Salvando…' : 'Concluir lead'}
              </Button>
            </div>
          </>
        )}
      </div>

        </div>
      </div>

      <div className="mobile-split flex flex-col gap-4 max-lg:order-2">
        {/* Sobre o lead: resumo + ficha com tudo que se sabe (só as linhas que têm valor) */}
        <div>
          <div className="card p-4 md:p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent-green text-[rgb(var(--on-accent))]">
                <ClipboardList size={15} strokeWidth={2.25} />
              </span>
              <h2 className="text-[15px] font-semibold text-text-primary">Sobre o lead</h2>
            </div>
            {about && <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-text-secondary">{about}</p>}

            {facts.length > 0 && (
              <dl className="mt-4 divide-y divide-fg/[0.06] overflow-hidden rounded-xl border border-fg/[0.06]">
                {facts.map(({ icon: Icon, label, value, href }) => (
                  <div key={label} className="grid grid-cols-[18px_minmax(0,0.9fr)_minmax(0,1.4fr)] items-center gap-3 px-3.5 py-3">
                    <Icon size={16} className="text-text-muted" />
                    <dt className="truncate text-[13px] text-text-muted">{label}</dt>
                    <dd className="min-w-0 break-words text-[13px] font-medium text-text-primary">
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-accent-green hover:underline">
                          {value}
                        </a>
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {/* Possíveis dores: argumentos de venda pra ligação */}
            {pains.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <p className="text-[13px] font-semibold text-text-primary">Possíveis dores</p>
                  <p className="text-[11px] text-text-muted">use como argumento na ligação</p>
                </div>
                <ul className="divide-y divide-fg/[0.06] overflow-hidden rounded-xl border border-fg/[0.06] bg-fg/[0.025]">
                  {pains.map((pn) => {
                    const Icon = PAIN_ICON[pn];
                    return (
                      <li key={pn} className="flex items-center gap-3 px-3.5 py-2.5">
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-fg/[0.05] text-accent-amber">
                          <Icon size={14} />
                        </span>
                        <span className="text-[13px] font-medium text-text-primary">{LEAD_PAIN_LABEL[pn]}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>

      </div>

      <AdminAgenda open={agendaOpen} onClose={() => setAgendaOpen(false)} onPick={pickMeeting}
        initial={meetingAt ? { at: meetingAt, duration: meetingDuration, attendeeIds: meetingAttendeeIds, guests: meetingGuests } : undefined}
        defaultGuest={{ name: lead.full_name, title: lead.job_title ?? undefined }}
        leadName={lead.company_name || lead.full_name}
      />
    </div>
  );
});
