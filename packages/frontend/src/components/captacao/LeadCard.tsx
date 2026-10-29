import { forwardRef, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Building2, ClipboardPen, Users, Lightbulb, CalendarCheck, CalendarClock, CalendarDays, CheckCheck, PhoneForwarded, PhoneMissed, Clock, ClipboardList, XCircle, Tag, User, CalendarPlus, PhoneCall, Check, CheckCircle2, ChevronDown, ChevronRight, Globe, Hourglass, PhoneOff, History, BellRing, MessageCircleQuestion, Sparkles, Save, Send, PhoneIncoming, Instagram, Lock, MapPin, MapPinOff, Megaphone, MessageSquare, Pencil, Phone, Star, StarHalf, Trophy, Video,
} from 'lucide-react';
import { useRecordWhatsapp, useUpdateMyLead } from '@/hooks/useCaptacao';
import type { CallStatus, LeadAttempt, LostReason, MeetingGuest, MeetingMode, MyLead, WhatsappStatus } from '@/services/captacao.service';
import { useTenant } from '@/hooks/useTenant';
import { Modal } from '@/components/ui/Modal';
import {
  CALL_STATUS,
  CALL_RESULT_OPTIONS,
  LEAD_PAIN_SCRIPT,
  LOST_REASON_LABEL,
  LOST_REASONS,
  formatBRL,
  googleUrl,
  instagramHandle,
  instagramUrl,
  LEAD_PAIN_LABEL,
  leadPains,
  type LeadPain,
  websiteLabel,
  websiteUrl,
  WHATSAPP_STATUS,
  WHATSAPP_STATUS_ORDER,
  whatsappUrl,
} from '@/lib/captacao';
import { GmailIcon, InstagramIcon, GoogleIcon, WhatsAppIcon } from '@/components/ui/BrandIcons';
import { Button } from '@/components/ui/Button';
import { AdminAgenda, type MeetingPick } from './AdminAgenda';
import { LeadPeopleCard } from './LeadPeopleCard';
import { QuickLink } from '@/components/ui/QuickLink';
import { listSpring } from '@/components/ui/DataList';
import { cn } from '@/lib/utils';

const MEETING_MODES = [
  { value: 'online', label: 'Online', icon: Video },
  { value: 'presencial', label: 'Presencial', icon: MapPin },
] as const;

export const PAIN_ICON: Record<LeadPain, typeof Globe> = {
  no_site: Globe,
  no_instagram: Instagram,
  no_marketing: Megaphone,
  no_google: MapPinOff,
  few_reviews: MessageSquare,
  low_rating: StarHalf,
};

// Plano A: ícone de cada resultado da ligação
const CALL_STATUS_ICON: Record<Exclude<CallStatus, 'pending'>, typeof Clock> = {
  no_answer: PhoneMissed,
  answered: PhoneIncoming,
  wrong_number: PhoneOff,
  callback: PhoneForwarded,
  meeting: CalendarCheck,
  lost: XCircle,
};

// Plano B: ícone de cada situação da mensagem
const WA_STATUS_ICON: Record<WhatsappStatus, typeof Clock> = {
  waiting: Send,
  replied: CheckCheck,
  no_reply: XCircle,
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
 * "Salvar" com Ganhou/Perdeu fecha num resumo ("Editar" reabre); Em aguardo ou sem situação só salva.
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
  // Plano B: abrir o WhatsApp fica registrado (os admins veem quando o captador partiu pra mensagem)
  const recordWhatsapp = useRecordWhatsapp();
  const openWhatsapp = () => {
    recordWhatsapp.mutate(lead.id);
    setWaStatus((cur) => cur ?? 'waiting');
  };
  // Resposta da mensagem salva na hora (clicar de novo desmarca; se o WhatsApp já foi aberto volta pra "enviada")
  // Respondeu / não respondeu tira o lead do aguardo; desmarcar zera a mensagem (só abrir o bloco de novo
  // conta como enviada e põe em aguardo)
  const chooseWaStatus = (ws: WhatsappStatus) => {
    const next = waStatus === ws ? null : ws;
    setWaStatus(next);
    update.mutate({ id: lead.id, whatsappStatus: next, onHold: false });
  };
  const whatsappSent = lead.whatsapp_at
    ? `${format(new Date(lead.whatsapp_at), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}${lead.whatsapp_count > 1 ? ` · ${lead.whatsapp_count}x` : ''}`
    : null;
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
  // Plano A, Plano B e Agenda começam fechados: o captador abre o que for usar
  const [showAgenda, setShowAgenda] = useState(false);
  const [showPlanA, setShowPlanA] = useState(false);
  const [showPlanB, setShowPlanB] = useState(false);
  // Abrir a Ligação já conta como ligação feita: só falta dizer se o lead atendeu
  const [callMade, setCallMade] = useState(lead.call_status !== 'pending');
  // Escolheu um resultado nesta visita: o próximo salvamento entra como tentativa no histórico
  const [callPicked, setCallPicked] = useState(false);
  // "Perdeu" pede o motivo antes de salvar
  const [lostOpen, setLostOpen] = useState(false);
  const { data: tenant } = useTenant();
  const toggleCall = () => {
    setShowPlanA((v) => !v);
    setCallMade(true);
  };
  // Abrir a Mensagem já conta como mensagem enviada: sem saber se respondeu, o lead fica em aguardo sozinho
  const toggleMessage = () => {
    const opening = !showPlanB;
    setShowPlanB(opening);
    if (!opening || waStatus || locked) return;
    setWaStatus('waiting');
    update.mutate({ id: lead.id, whatsappStatus: 'waiting', onHold: true, callStatus: status, callNotes: notes });
  };
  const [showPeople, setShowPeople] = useState(false);
  const [showFollowup, setShowFollowup] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [waStatus, setWaStatus] = useState<WhatsappStatus | null>(lead.whatsapp_status);
  const locked = lead.outcome !== null;
  const concluded = !!lead.concluded_at && !locked;
  const isMeeting = status === 'meeting';
  const meetingMissing = isMeeting && (!meetingAt || !meetingMode);

  // Mantém rascunho e resultado em sincronia quando o servidor devolve outro valor
  useEffect(() => setNotes(lead.call_notes ?? ''), [lead.call_notes]);
  useEffect(() => setStatus(lead.call_status), [lead.call_status]);
  useEffect(() => setWaStatus(lead.whatsapp_status), [lead.whatsapp_status]);
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

  // Situação do lead escolhida acima do "Salvar": ganhou / perdeu (salva concluído) ou em aguardo
  type Situation = 'won' | 'lost' | 'hold';
  const [situationState, setSituation] = useState<Situation | null>(lead.lead_result ?? (lead.on_hold_at ? 'hold' : null));
  useEffect(() => setSituation(lead.lead_result ?? (lead.on_hold_at ? 'hold' : null)), [lead.lead_result, lead.on_hold_at]);
  const situation = situationState;

  // Salvar: manda resultado + anotação + agenda + situação juntos (um único salvamento)
  const save = (override?: Situation, lostReason?: LostReason) => {
    const situation = override ?? situationState;
    const finishing = situation === 'won' || situation === 'lost';
    if (finishing && meetingMissing) {
      toast.error('Informe dia, horário e formato da reunião');
      return;
    }
    concludeMutation.mutate(
      {
        id: lead.id,
        callStatus: status,
        callNotes: notes,
        onHold: situation === 'hold',
        logCall: callPicked,
        ...(finishing ? { concluded: true, leadResult: situation } : { leadResult: null, ...(lead.concluded_at && { concluded: false }) }),
        ...(situation === 'lost' && { lostReason: lostReason ?? lead.lost_reason ?? 'other' }),
        ...(isMeeting &&
          !meetingMissing && {
            meetingAt: new Date(meetingAt).toISOString(),
            meetingMode,
            meetingLocation: meetingLocation.trim() || null,
            meetingDuration,
            meetingAttendeeIds,
            meetingGuests,
          }),
      },
      {
        onSuccess: (saved) => {
          setCallPicked(false);
          // Servidor sem a versão nova ignora a situação sem erro — avisa em vez de fingir que salvou
          if ((situation === 'hold' && !saved.on_hold_at) || (finishing && saved.lead_result === undefined)) {
            toast.error('Não foi possível salvar a situação: o servidor está desatualizado');
            return;
          }
          toast.success(
            situation === 'won'
              ? `${lead.full_name}: ganhou`
              : situation === 'lost'
                ? `${lead.full_name}: perdeu`
                : situation === 'hold'
                  ? `${lead.full_name} em aguardo`
                  : 'Lead salvo',
          );
        },
      },
    );
  };

  const reopen = () => update.mutate({ id: lead.id, concluded: false });

  // Retorno: quando voltar a falar com o lead (salva na hora; vira lembrete pro captador)
  const [nextContact, setNextContact] = useState(toLocalInput(lead.next_contact_at));
  useEffect(() => setNextContact(toLocalInput(lead.next_contact_at)), [lead.next_contact_at]);
  const saveNextContact = (local: string) => {
    setNextContact(local);
    update.mutate(
      { id: lead.id, nextContactAt: local ? new Date(local).toISOString() : null },
      { onSuccess: () => toast.success(local ? 'Retorno marcado' : 'Retorno removido') },
    );
  };
  const quickNextContact = (days: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    saveNextContact(toLocalInput(d.toISOString()));
  };
  const attempts: LeadAttempt[] = lead.attempts ?? [];

  // Montou a reunião na agenda → o resultado vira "Reunião marcada"
  const pickMeeting = (pick: MeetingPick) => {
    setMeetingAt(pick.at);
    setMeetingDuration(pick.duration);
    setMeetingAttendeeIds(pick.attendeeIds);
    setMeetingGuests(pick.guests);
    setStatus('meeting');
  };
  // Excluir a reunião: limpa a agenda (o lead continua como "atendeu"); grava na hora se já estava salva
  const removeMeeting = () => {
    setMeetingAt('');
    setMeetingMode(null);
    setMeetingLocation('');
    setMeetingDuration(60);
    setMeetingAttendeeIds([]);
    setMeetingGuests([]);
    if (status === 'meeting') setStatus('answered');
    if (situation === 'won') setSituation(null);
    if (lead.meeting_at || lead.call_status === 'meeting') {
      update.mutate(
        {
          id: lead.id,
          ...(lead.call_status === 'meeting' && { callStatus: 'answered' as const }),
          meetingAt: null,
          meetingMode: null,
          meetingLocation: null,
          meetingDuration: null,
          meetingAttendeeIds: [],
          meetingGuests: [],
        },
        { onSuccess: () => toast.success('Reunião excluída') },
      );
    }
  };
  const pickMeetingMode = (m: MeetingMode) => {
    setMeetingMode(m);
    setStatus('meeting');
  };
  // Outro resultado → a reunião preenchida sai na hora
  // Clicar de novo no resultado já marcado desmarca (volta a "a ligar")
  const chooseStatus = (picked: CallStatus) => {
    // Com reunião marcada, "Atendeu" já está implícito: não apaga a agenda
    if (picked === 'answered' && status === 'meeting') return;
    const s = picked === status ? 'pending' : picked;
    setStatus(s);
    setCallPicked(s !== 'pending');
    if (s === 'meeting') setShowAgenda(true);
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
  // Em que pé está o lead (lista e cabeçalho da página)
  const state = locked
    ? lead.outcome === 'won'
      ? { label: 'Fechou negócio', className: 'bg-accent-green/15 text-accent-green', dot: 'bg-accent-green' }
      : { label: 'Não fechou', className: 'bg-fg/[0.08] text-text-secondary', dot: 'bg-text-muted' }
    : lead.concluded_at && lead.lead_result
      ? lead.lead_result === 'won'
        ? { label: 'Ganhou', className: 'bg-accent-green/15 text-accent-green', dot: 'bg-accent-green' }
        : { label: 'Perdeu', className: 'bg-status-lost/15 text-status-lost', dot: 'bg-status-lost' }
    : lead.on_hold_at && !lead.concluded_at
      ? { label: 'Em aguardo', className: 'bg-accent-amber/15 text-accent-amber', dot: 'bg-accent-amber' }
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

  // Versão compacta do status: na lista (celular) e no cabeçalho da página no celular
  const stateChip = (
    <span className={cn('inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', state.className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', state.dot)} />
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
          <span className="sm:hidden">{stateChip}</span>
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
        // Vidro leve (igual aos cards do Acompanhamento); sem backdrop-blur dentro da pasta
        className={cn(
          'group flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border border-fg/[0.1] bg-fg/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-fg/[0.16] hover:bg-fg/[0.055] md:px-5',
          concluded && 'opacity-80',
        )}
      >
        {identity}
        {/* À direita: retorno marcado (vermelho se atrasado), status e a seta */}
        <div className="flex flex-shrink-0 items-center gap-2">
          {lead.next_contact_at && !lead.concluded_at && !locked && (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs font-medium max-sm:hidden',
                new Date(lead.next_contact_at) < new Date() ? 'text-status-lost' : 'text-accent-amber',
              )}
              title="Retorno marcado"
            >
              <BellRing size={12} />
              {format(new Date(lead.next_contact_at), "d/MM 'às' HH:mm")}
            </span>
          )}
          <span className="max-sm:hidden">{stateBadge}</span>
          <ChevronRight size={18} className="text-text-muted transition-transform group-hover:translate-x-0.5" />
        </div>
      </motion.li>
    );
  }

  // Ganhou / perdeu / em aguardo: salvam na hora; o botão aceso é a situação do lead
  const situationButtons = (full = false) => (
    <div className={cn('flex divide-x divide-fg/[0.08] overflow-hidden rounded-xl border border-fg/[0.1] bg-fg/[0.03]', full && 'w-full [&>button]:flex-1')}>
      <button
        type="button"
        onClick={() => {
          setSituation('won');
          save('won');
        }}
        disabled={concludeMutation.isPending}
        title="Ganhou"
        aria-pressed={concluded && lead.lead_result === 'won'}
        className={cn(
          'flex h-10 w-11 items-center justify-center transition-colors hover:bg-accent-green/10 hover:text-accent-green',
          concluded && lead.lead_result === 'won' ? 'bg-accent-green/15 text-accent-green' : 'text-text-secondary',
        )}
      >
        <Trophy size={19} />
      </button>
      <button
        type="button"
        onClick={() => {
          setLostOpen(true);
        }}
        disabled={concludeMutation.isPending}
        title="Perdeu"
        aria-pressed={concluded && lead.lead_result === 'lost'}
        className={cn(
          'flex h-10 w-11 items-center justify-center transition-colors hover:bg-status-lost/10 hover:text-status-lost',
          concluded && lead.lead_result === 'lost' ? 'bg-status-lost/15 text-status-lost' : 'text-text-secondary',
        )}
      >
        <XCircle size={19} />
      </button>
      <button
        type="button"
        onClick={() => {
          setSituation('hold');
          save('hold');
        }}
        disabled={concludeMutation.isPending}
        title="Em aguardo"
        aria-pressed={!concluded && !!lead.on_hold_at}
        className={cn(
          'flex h-10 w-11 items-center justify-center transition-colors hover:bg-accent-amber/10 hover:text-accent-amber',
          !concluded && lead.on_hold_at ? 'bg-accent-amber/15 text-accent-amber' : 'text-text-secondary',
        )}
      >
        <Hourglass size={18} />
      </button>
    </div>  );

  // Atalhos de um clique (cabeçalho da página)
  const quickLinks = (
    <>
      {lead.phone && (
        <QuickLink href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`} label="Ligar" className="text-text-primary">
          <Phone size={18} fill="currentColor" strokeWidth={1} />
        </QuickLink>
      )}
      {lead.phone && (
        <QuickLink href={whatsappUrl(lead.phone)} label="Abrir no WhatsApp" className="text-[#25D366]" onClick={openWhatsapp}>
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
    <div className="mobile-split grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="max-lg:order-1 lg:col-span-2">
        <div className="card flex flex-wrap items-center gap-4 p-5 md:p-6">
          {identity}
          {/* Celular: os atalhos vão pro bloco logo abaixo; o status fica no selo pequeno do cabeçalho */}
          <div className="flex flex-wrap items-center gap-2 max-sm:hidden">
            {quickLinks}
            {/* Ganhou / perdeu / em aguardo direto do cabeçalho (salva na hora, como o "Salvar" com a situação);
                o botão aceso é o status do lead */}
            {locked ? (
              <>
                <span className="mx-1 h-6 w-px bg-fg/[0.1]" />
                {stateBadge}
              </>
            ) : (
              <>
                <span className="mx-1 h-6 w-px bg-fg/[0.1]" />
                {situationButtons()}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Celular: atalhos (ligar, WhatsApp, Google…) num bloco próprio logo abaixo do cabeçalho */}
      <div className="max-lg:order-1 sm:hidden">
        {/* Ícones dividem a largura toda (sem sobra nas laterais) */}
        <div className="card grid auto-cols-fr grid-flow-col gap-2 p-2 [&>a]:!w-full">{quickLinks}</div>
      </div>

      <div className="max-lg:order-3">
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-fg/[0.06] px-4 py-3.5 md:px-5">
            <ClipboardPen size={16} className="text-accent-green" />
            <h2 className="text-sm font-semibold text-text-primary">Formulário</h2>
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
            {lead.lead_result && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                  lead.lead_result === 'won' ? 'bg-accent-green/15 text-accent-green' : 'bg-status-lost/15 text-status-lost',
                )}
              >
                {lead.lead_result === 'won' ? <Trophy size={12} /> : <XCircle size={12} />}
                {lead.lead_result === 'won' ? 'Ganhou' : 'Perdeu'}
                {lead.lead_result === 'lost' && lead.lost_reason && <span className="font-normal">· {LOST_REASON_LABEL[lead.lost_reason]}</span>}
              </span>
            )}
            {lead.call_status !== 'pending' && <StatusBadge status={lead.call_status} />}
            {lead.call_status === 'meeting' && lead.meeting_at && (
              <span className="flex items-center gap-1 text-xs font-medium text-accent-green">
                <CalendarClock size={13} />
                {formatMeeting(lead.meeting_at)} · {lead.meeting_mode === 'online' ? 'Online' : 'Presencial'}
                {lead.meeting_location && <span className="font-normal text-text-muted">· {lead.meeting_location}</span>}
              </span>
            )}
            {(whatsappSent || lead.whatsapp_status) && (
              <span className="flex items-center gap-1 text-xs font-medium text-[#25D366]" title="Mensagem no WhatsApp">
                <WhatsAppIcon size={13} />
                {lead.whatsapp_status ? WHATSAPP_STATUS[lead.whatsapp_status].label : 'WhatsApp'}
                {whatsappSent && <span className="font-normal text-text-muted">· {whatsappSent}</span>}
              </span>
            )}
            <p className="min-w-0 flex-1 truncate text-sm text-text-secondary" title={lead.call_notes ?? undefined}>
              {lead.call_notes || <span className="text-text-muted">Sem anotações</span>}
            </p>
            <span className="text-xs text-text-muted">
              Salvo {new Date(lead.concluded_at!).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
            <Button variant="ghost" size="sm" onClick={reopen} disabled={update.isPending}>
              <Pencil size={13} />
              Editar
            </Button>
          </div>
        ) : (
          <>
            {/* Etapas numa lista só (ligação, mensagem, agenda, contatos): uma linha por etapa, abre embaixo */}
            <div className="divide-y divide-fg/[0.07] overflow-hidden rounded-xl border border-fg/[0.1]">

            {/* Plano A: a ligação — o que aconteceu ao ligar */}
            <PlanBlock
              icon={<PhoneCall size={15} />}
              title="Ligação"
              tag={
                callMade ? (
                  <span className="text-[13px] text-text-muted">{status === 'pending' ? 'O lead atendeu?' : CALL_STATUS[status].label}</span>
                ) : (
                  <span className="text-[13px] font-medium text-accent-green">Obrigatório</span>
                )
              }
              done={status !== 'pending'}
              open={showPlanA}
              onToggle={toggleCall}
            >
              <div className="space-y-3 p-4">
                {/* Clicar de novo desmarca; reunião marcada na Agenda conta como "Atendeu" */}
                <StepRow label="O lead atendeu?">
                  {CALL_RESULT_OPTIONS.map((s) => (
                    <ChoicePill
                      key={s}
                      active={status === s || (s === 'answered' && status === 'meeting')}
                      activeClass={CALL_STATUS[s].className}
                      icon={CALL_STATUS_ICON[s]}
                      label={CALL_STATUS[s].label}
                      onClick={() => chooseStatus(s)}
                    />
                  ))}
                </StepRow>
              </div>
            </PlanBlock>

            {/* Plano B: não deu certo na ligação → mensagem no WhatsApp (fica registrado pros admins) */}
            <PlanBlock
              icon={<WhatsAppIcon size={15} />}
              iconClassName="text-[#25D366]"
              title="Mensagem"
              tag={
                <span className={cn('text-[13px]', waStatus === 'waiting' ? 'text-accent-amber' : 'text-text-muted')}>
                  {waStatus === 'waiting' ? 'Enviada · em aguardo' : waStatus ? WHATSAPP_STATUS[waStatus].label : 'Se não deu certo na ligação'}
                </span>
              }
              // Só depois de registrar a ligação (quem já mandou mensagem antes continua vendo)
              lockedHint={status === 'pending' && !waStatus ? 'Diga primeiro se o lead atendeu ou não' : undefined}
              // Só fica feito quando diz se respondeu ou não (enviada sem resposta = em aguardo)
              done={waStatus === 'replied' || waStatus === 'no_reply'}
              open={showPlanB && !(status === 'pending' && !waStatus)}
              onToggle={toggleMessage}
            >
              <div className="space-y-3 p-4">
                    {/* Clicar de novo desmarca */}
                    <StepRow label="Ele respondeu?">
                      {WHATSAPP_STATUS_ORDER.map((ws) => (
                        <ChoicePill
                          key={ws}
                          active={waStatus === ws}
                          activeClass={WHATSAPP_STATUS[ws].className}
                          icon={WA_STATUS_ICON[ws]}
                          label={WHATSAPP_STATUS[ws].label}
                          onClick={() => chooseWaStatus(ws)}
                        />
                      ))}
                    </StepRow>
              </div>
            </PlanBlock>


            {/* Agenda: confere a agenda dos admins e marca o horário da reunião */}
            <PlanBlock
              icon={<CalendarClock size={15} />}
              title="Agenda"
              tag={
                <span className={cn('text-[13px]', meetingAt ? 'text-accent-green' : 'text-text-muted')}>
                  {meetingAt ? formatMeeting(new Date(meetingAt).toISOString()) : 'Sem reunião marcada'}
                </span>
              }
              done={!!meetingAt && !!meetingMode}
              open={showAgenda}
              onToggle={() => {
                // Abrir a Reunião já conta como lead ganho (o captador ainda pode trocar na Situação)
                if (!showAgenda) setSituation('won');
                setShowAgenda(!showAgenda);
              }}
            >
              <div className="space-y-3 p-4">
                <StepRow label="Data e hora">
                  <button
                    type="button"
                    onClick={() => setAgendaOpen(true)}
                    className={cn(
                      'inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-[14px] font-medium transition-colors',
                      meetingAt
                        ? 'border-accent-green/40 bg-accent-green/10 text-accent-green hover:bg-accent-green/15'
                        : 'border-dashed border-fg/[0.18] text-text-secondary hover:border-accent-green/50 hover:text-accent-green',
                    )}
                  >
                    {meetingAt ? <CalendarClock size={14} /> : <CalendarPlus size={14} />}
                    {meetingAt ? (
                      <span className="capitalize">{format(new Date(meetingAt), "EEE, d 'de' MMM 'às' HH:mm", { locale: ptBR })}</span>
                    ) : (
                      'Escolher na agenda dos admins'
                    )}
                    {meetingAt && <Pencil size={12} className="opacity-70" />}
                  </button>
                </StepRow>
                <StepRow label="Formato">
                  {MEETING_MODES.map(({ value, label, icon }) => (
                    <ChoicePill
                      key={value}
                      active={meetingMode === value}
                      activeClass="bg-accent-green/15 text-accent-green"
                      icon={icon}
                      label={label}
                      onClick={() => pickMeetingMode(value)}
                    />
                  ))}
                </StepRow>
                {meetingMode && (
                  <StepRow label={meetingMode === 'online' ? 'Link' : 'Endereço'}>
                    <input
                      value={meetingLocation}
                      onChange={(e) => setMeetingLocation(e.target.value)}
                      maxLength={500}
                      placeholder={meetingMode === 'online' ? 'Meet, Zoom, WhatsApp… (opcional)' : 'Onde vai ser (opcional)'}
                      className="input-base h-9 w-full max-w-md text-sm"
                    />
                  </StepRow>
                )}
              </div>
            </PlanBlock>

            {/* Retorno combinado com o lead: vira lembrete na hora marcada */}
            <PlanBlock
              icon={<BellRing size={15} />}
              title="Retorno"
              tag={
                <span className={cn('text-[13px]', nextContact ? (new Date(nextContact) < new Date() ? 'text-status-lost' : 'text-accent-amber') : 'text-text-muted')}>
                  {nextContact ? format(new Date(nextContact), "EEE, d 'de' MMM 'às' HH:mm", { locale: ptBR }) : 'Sem retorno marcado'}
                </span>
              }
              done={!!nextContact}
              open={showFollowup}
              onToggle={() => setShowFollowup((v) => !v)}
            >
              <div className="space-y-3 p-4">
                <StepRow label="Voltar a falar em">
                  <input
                    type="datetime-local"
                    value={nextContact}
                    onChange={(e) => setNextContact(e.target.value)}
                    onBlur={(e) => e.target.value !== toLocalInput(lead.next_contact_at) && saveNextContact(e.target.value)}
                    className="input-base h-10 w-auto text-sm [color-scheme:dark]"
                  />
                  {nextContact && (
                    <button type="button" onClick={() => saveNextContact('')} className="text-[13px] text-text-muted hover:text-status-lost">
                      Remover
                    </button>
                  )}
                </StepRow>
                <StepRow label="Atalhos">
                  <ChoicePill active={false} activeClass="" icon={Clock} label="Hoje 17h" onClick={() => quickNextContact(0, 17)} />
                  <ChoicePill active={false} activeClass="" icon={Clock} label="Amanhã 10h" onClick={() => quickNextContact(1, 10)} />
                  <ChoicePill active={false} activeClass="" icon={Clock} label="Em 3 dias" onClick={() => quickNextContact(3, 10)} />
                  <ChoicePill active={false} activeClass="" icon={Clock} label="Em 1 semana" onClick={() => quickNextContact(7, 10)} />
                </StepRow>
                <p className="text-xs text-text-muted">Na hora marcada você recebe um aviso, e o lead aparece em "Retornar hoje".</p>
              </div>
            </PlanBlock>

            {/* Contatos conseguidos na ligação: salva na hora (ligado à empresa) */}
            <PlanBlock
              icon={<Users size={15} />}
              title="Contatos do lead"
              tag={
                <span className="text-[13px] text-text-muted">
                  {(lead.lead_people ?? []).length
                    ? `${(lead.lead_people ?? []).length} ${(lead.lead_people ?? []).length === 1 ? 'pessoa' : 'pessoas'}`
                    : 'Nenhum'}
                </span>
              }
              done={(lead.lead_people ?? []).length > 0}
              open={showPeople}
              onToggle={() => setShowPeople((v) => !v)}
            >
              <LeadPeopleCard
                bare
                people={lead.lead_people ?? []}
                saving={update.isPending}
                onSave={(next) => update.mutate({ id: lead.id, leadPeople: next })}
              />
            </PlanBlock>

            {/* Histórico: cada ligação e mensagem registrada */}
            <PlanBlock
              icon={<History size={15} />}
              title="Histórico"
              tag={
                <span className="text-[13px] text-text-muted">
                  {attempts.length
                    ? `${attempts.length} ${attempts.length === 1 ? 'tentativa' : 'tentativas'} · última ${format(new Date(attempts[0].created_at), "d/MM 'às' HH:mm")}`
                    : 'Nenhuma tentativa'}
                </span>
              }
              open={showHistory}
              onToggle={() => setShowHistory((v) => !v)}
            >
              <div className="p-4">
                {attempts.length === 0 ? (
                  <p className="text-sm text-text-muted">As ligações e mensagens que você salvar aparecem aqui.</p>
                ) : (
                  <AttemptsTimeline attempts={attempts} />
                )}
              </div>
            </PlanBlock>
            </div>

            <p className="mb-2 mt-5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-text-muted">Anotações</p>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={2}
              maxLength={2000}
              aria-label="Anotações"
              placeholder="Com quem falou, objeções, melhor horário para retornar…"
              className="input-base min-h-[64px] resize-y border-fg/[0.12] bg-fg/[0.05] py-2.5 text-sm leading-relaxed shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            />

            <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
              {meetingMissing && (situation === 'won' || situation === 'lost') && (
                <span className="mr-auto text-xs text-text-muted">Defina dia, horário e formato da reunião na Agenda.</span>
              )}
              <Button onClick={() => save()} disabled={concludeMutation.isPending} className="max-sm:hidden">
                <Save size={15} />
                {concludeMutation.isPending ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </>
        )}
      </div>

        </div>
      </div>

      {/* Coluna da direita: ficha do lead e, embaixo, o card das possíveis dores */}
      <div className="max-lg:order-2 lg:sticky lg:top-3">
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-fg/[0.06] px-4 py-3.5">
            <ClipboardList size={16} className="text-accent-green" />
            <h2 className="text-[15px] font-semibold text-text-primary">Sobre o lead</h2>
          </div>

          {facts.length > 0 && (
            <dl className="divide-y divide-fg/[0.06] px-4 py-1">
              {facts.map(({ icon: Icon, label, value, href }) => (
                <div key={label} className="grid grid-cols-[16px_100px_minmax(0,1fr)] items-start gap-2.5 py-3">
                  <Icon size={14} className="mt-0.5 text-text-muted" />
                  <dt className="text-[13.5px] text-text-muted">{label}</dt>
                  <dd className="min-w-0 break-words text-[13.5px] font-medium text-text-primary">
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

        </div>
        {/* Possíveis dores: cada uma com uma frase pronta pra usar na ligação */}
        {pains.length > 0 && (
          <div className="card mt-4 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-fg/[0.06] px-4 py-3.5">
              <Lightbulb size={16} className="text-accent-amber" />
              <h2 className="text-[15px] font-semibold text-text-primary">Possíveis dores</h2>
            </div>
            <ul className="divide-y divide-fg/[0.06]">
              {pains.map((pn) => {
                const Icon = PAIN_ICON[pn];
                return (
                  <li key={pn} className="px-4 py-3">
                    <p className="flex items-center gap-2 text-[13.5px] font-semibold text-text-primary">
                      <Icon size={14} className="text-accent-amber" />
                      {LEAD_PAIN_LABEL[pn]}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">"{LEAD_PAIN_SCRIPT[pn]}"</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Roteiro da ligação: abertura e respostas pras objeções mais comuns */}
        <CallScript leadName={lead.company_name || lead.full_name} companyName={tenant?.name} />
      </div>

      {/* Lead concluído/fechado: o Formulário vira resumo, então os contatos aparecem num card (concluído
          ainda edita; fechado pelo admin = só leitura) */}
      {(concluded || locked) && (lead.lead_people ?? []).length > 0 && (
        <div className="max-lg:order-3">
          <LeadPeopleCard
            people={lead.lead_people ?? []}
            saving={update.isPending}
            onSave={locked ? undefined : (next) => update.mutate({ id: lead.id, leadPeople: next })}
          />
        </div>
      )}

      {/* Celular: "Salvar" é um botão próprio embaixo do Formulário (não dentro dele) */}
      {!locked && !concluded && (
        <div className="space-y-2 max-lg:order-4 sm:hidden">
          {situationButtons(true)}
          <Button size="lg" onClick={() => save()} disabled={concludeMutation.isPending} className="w-full">
            <Save size={17} />
            {concludeMutation.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      )}

      <Modal open={lostOpen} onClose={() => setLostOpen(false)} title="Por que o lead foi perdido?" className="max-w-md">
        <div className="grid grid-cols-2 gap-2">
          {LOST_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setLostOpen(false);
                setSituation('lost');
                save('lost', r);
              }}
              className="rounded-xl border border-fg/[0.1] px-3 py-3 text-left text-[14px] font-medium text-text-primary transition-colors hover:border-status-lost/40 hover:bg-status-lost/10"
            >
              {LOST_REASON_LABEL[r]}
            </button>
          ))}
        </div>
      </Modal>

      <AdminAgenda open={agendaOpen} onClose={() => setAgendaOpen(false)} onPick={pickMeeting}
        initial={meetingAt ? { at: meetingAt, duration: meetingDuration, attendeeIds: meetingAttendeeIds, guests: meetingGuests } : undefined}
        defaultGuest={{ name: lead.full_name, title: lead.job_title ?? undefined }}
        leadName={lead.company_name || lead.full_name}
        onRemove={meetingAt || lead.meeting_at ? removeMeeting : undefined}
      />
    </div>
  );
});

const ATTEMPT_LABEL: Record<string, string> = {
  no_answer: 'Não atendeu',
  answered: 'Atendeu',
  wrong_number: 'Número errado',
  meeting: 'Reunião marcada',
  callback: 'Em aguardo',
  lost: 'Perdido',
  waiting: 'Mensagem enviada',
  replied: 'Respondeu',
  no_reply: 'Não respondeu',
};

/** Histórico de tentativas: uma linha por ligação/mensagem, da mais nova pra mais antiga */
export function AttemptsTimeline({ attempts }: { attempts: LeadAttempt[] }) {
  return (
    <ol className="relative space-y-3 border-l border-fg/[0.1] pl-5">
      {attempts.map((t) => (
        <li key={t.id} className="relative">
          <span
            className={cn(
              'absolute -left-[27px] top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full ring-4 ring-bg-surface',
              t.channel === 'whatsapp' ? 'bg-[#25D366]/15 text-[#25D366]' : 'bg-fg/[0.1] text-text-secondary',
            )}
          >
            {t.channel === 'whatsapp' ? <WhatsAppIcon size={10} /> : <Phone size={9} fill="currentColor" strokeWidth={1} />}
          </span>
          <p className="text-[13.5px] font-medium text-text-primary">
            {t.channel === 'whatsapp' ? 'WhatsApp' : 'Ligação'} · {ATTEMPT_LABEL[t.result] ?? t.result}
          </p>
          <p className="text-xs text-text-muted">{format(new Date(t.created_at), "EEEE, d 'de' MMM 'às' HH:mm", { locale: ptBR })}</p>
        </li>
      ))}
    </ol>
  );
}

const OBJECTIONS = [
  { q: '"Não tenho interesse."', a: 'Entendo! Posso só te mostrar em 2 minutos como outras lojas da região estão trazendo mais clientes? Se não fizer sentido, sem problema.' },
  { q: '"Já tenho alguém que cuida disso."', a: 'Ótimo, então vocês já sabem a importância. Vale uma segunda opinião sem compromisso: às vezes dá pra ter mais resultado pelo mesmo valor.' },
  { q: '"Está caro / não tenho verba agora."', a: 'Faz sentido. A ideia é que se pague com os clientes novos. Posso te mostrar os planos e você decide com calma.' },
  { q: '"Me manda por WhatsApp / e-mail."', a: 'Mando sim! Pra mandar algo que faça sentido pra vocês, posso marcar 15 minutos com nosso time pra entender melhor?' },
  { q: '"O dono não está."', a: 'Sem problema! Qual o melhor horário pra falar com ele? E qual o nome dele? (registre em Contatos do lead e marque o Retorno)' },
];

/** Roteiro da ligação: abertura pronta e respostas pras objeções mais comuns (começa fechado) */
function CallScript({ leadName, companyName }: { leadName: string; companyName?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card mt-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3.5 text-left transition-colors hover:bg-fg/[0.03]"
      >
        <Sparkles size={16} className="text-accent-green" />
        <h2 className="flex-1 text-[15px] font-semibold text-text-primary">Roteiro da ligação</h2>
        <ChevronDown size={17} className={cn('text-text-muted transition-transform duration-300', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', visualDuration: 0.32, bounce: 0.1 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-fg/[0.06] px-4 py-3.5">
              <div>
                <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-text-muted">Abertura</p>
                <p className="text-[13.5px] leading-relaxed text-text-primary">
                  "Oi, tudo bem? Aqui é [seu nome]{companyName ? `, da ${companyName}` : ''}. Falo com o responsável pela {leadName}? Estou ligando
                  porque a gente ajuda negócios como o de vocês a conseguir mais clientes. Você tem 2 minutinhos?"
                </p>
              </div>
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                  <MessageCircleQuestion size={13} />
                  Objeções comuns
                </p>
                <ul className="space-y-2.5">
                  {OBJECTIONS.map((o) => (
                    <li key={o.q}>
                      <p className="text-[13.5px] font-medium text-text-primary">{o.q}</p>
                      <p className="text-[13px] leading-relaxed text-text-secondary">{o.a}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Linha de uma etapa: pergunta curta à esquerda, resposta/opções à direita (no celular, uma embaixo da outra) */
function StepRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid items-center gap-x-4 gap-y-1.5 sm:grid-cols-[130px_minmax(0,1fr)]">
      <p className="text-[13.5px] text-text-muted">{label}</p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Opção pequena (pílula) de uma etapa; ativa ganha a cor do resultado */
function ChoicePill({
  active,
  activeClass,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  activeClass: string;
  icon: typeof Clock;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-[14px] font-medium transition-colors',
        active ? cn(activeClass, 'border-transparent') : 'border-fg/[0.1] text-text-secondary hover:border-fg/[0.2] hover:text-text-primary',
      )}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

/**
 * Parte da ligação (Plano A, Plano B, Agenda): cabeçalho clicável e o conteúdo num bloco só —
 * o que abre embaixo fica preso ao cabeçalho, no mesmo fundo do card ("Sobre o lead").
 */
function PlanBlock({
  icon,
  iconClassName,
  title,
  tag,
  lockedHint,
  done,
  open,
  onToggle,
  className,
  children,
}: {
  icon: ReactNode;
  iconClassName?: string;
  title: string;
  /** Selo ao lado do título (ex.: "Obrigatório") */
  tag?: ReactNode;
  /** Bloqueado: não abre e mostra o motivo no lugar do selo */
  lockedHint?: string;
  /** Já tem algo preenchido: ganha o check verde */
  done?: boolean;
  open: boolean;
  onToggle: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(lockedHint && 'opacity-55', className)}>
      {/* Uma linha da lista de etapas: ícone, título, situação à direita e a seta */}
      <button
        type="button"
        onClick={onToggle}
        disabled={!!lockedHint}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-fg/[0.03] disabled:cursor-not-allowed disabled:hover:bg-transparent',
          open && 'bg-fg/[0.03]',
        )}
      >
        <span className={cn('relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-fg/[0.06] text-text-secondary', iconClassName)}>
          {icon}
          {done && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent-green text-[rgb(var(--on-accent))] ring-2 ring-bg-surface">
              <Check size={10} strokeWidth={3} />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text-primary">{title}</span>
        {/* Situação da etapa à direita (texto discreto) */}
        <span className="min-w-0 max-w-[55%] truncate text-right max-sm:hidden">
          {lockedHint ? <span className="text-[13px] text-text-muted">{lockedHint}</span> : tag}
        </span>
        {lockedHint ? <Lock size={15} className="flex-shrink-0 text-text-muted" /> : <ChevronDown size={17} className={cn('flex-shrink-0 text-text-muted transition-transform duration-300', open && 'rotate-180')} />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', visualDuration: 0.32, bounce: 0.1 }}
            className="overflow-hidden"
          >
            <div className="border-t border-fg/[0.06] bg-fg/[0.015]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
