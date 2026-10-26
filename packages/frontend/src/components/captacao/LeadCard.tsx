import { forwardRef, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Building2, CalendarClock, CalendarPlus, Check, CheckCircle2, Globe, Info, Instagram, Link2, Lock, Mail, MapPin, Pencil, Phone, Star, Trophy, Video,
} from 'lucide-react';
import { useUpdateMyLead } from '@/hooks/useCaptacao';
import type { CallStatus, MeetingMode, MyLead } from '@/services/captacao.service';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import {
  CALL_STATUS,
  CALL_STATUS_ORDER,
  formatBRL,
  formatDay,
  googleUrl,
  instagramHandle,
  instagramUrl,
  websiteLabel,
  websiteUrl,
  whatsappUrl,
} from '@/lib/captacao';
import { GoogleIcon, WhatsAppIcon } from '@/components/ui/BrandIcons';
import { Button } from '@/components/ui/Button';
import { listSpring } from '@/components/ui/DataList';
import { cn } from '@/lib/utils';

const MEETING_MODES = [
  { value: 'online', label: 'Online', hint: 'Videochamada', icon: Video },
  { value: 'presencial', label: 'Presencial', hint: 'Encontro no local', icon: MapPin },
] as const;

/** Botão-ícone de atalho (WhatsApp, Instagram, Google, site): abre direto no perfil/página do lead */
function QuickLink({
  href,
  label,
  className,
  children,
}: {
  href: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      className={cn(
        'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-fg/[0.08] bg-fg/[0.04] transition-transform duration-150 hover:-translate-y-0.5 hover:bg-fg/[0.08]',
        className,
      )}
    >
      {children}
    </a>
  );
}

function InfoRow({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2 text-sm text-text-secondary">
      <Icon size={15} className="mt-0.5 flex-shrink-0 text-text-muted" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

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
 * Card do lead pra quem liga: dados do lugar (endereço, Google, Instagram, site, avaliações),
 * atalhos de um clique e o resultado da ligação. "Concluir lead" fecha o card num resumo;
 * "Editar" reabre.
 */
// forwardRef: a lista usa AnimatePresence "popLayout", que precisa do ref do item pra animar a saída
export const LeadCard = forwardRef<HTMLLIElement, { lead: MyLead; index: number }>(function LeadCard({ lead, index }, ref) {
  const update = useUpdateMyLead();
  // Concluir tem estado próprio: o salvamento da anotação (no blur, ao clicar no botão) não pode travá-lo
  const concludeMutation = useUpdateMyLead();
  const [notes, setNotes] = useState(lead.call_notes ?? '');
  // Resultado e agenda da reunião ficam só na tela até "Concluir lead" — um único envio ao servidor
  const [status, setStatus] = useState<CallStatus>(lead.call_status);
  const [meetingAt, setMeetingAt] = useState(toLocalInput(lead.meeting_at));
  const [meetingMode, setMeetingMode] = useState<MeetingMode | null>(lead.meeting_mode);
  const [meetingLocation, setMeetingLocation] = useState(lead.meeting_location ?? '');
  const locked = lead.outcome !== null;
  const concluded = !!lead.concluded_at && !locked;
  const isMeeting = status === 'meeting';
  const meetingMissing = isMeeting && (!meetingAt || !meetingMode);

  // Mantém rascunho e resultado em sincronia quando o servidor devolve outro valor
  useEffect(() => setNotes(lead.call_notes ?? ''), [lead.call_notes]);
  useEffect(() => setStatus(lead.call_status), [lead.call_status]);
  useEffect(() => {
    setMeetingAt(toLocalInput(lead.meeting_at));
    setMeetingMode(lead.meeting_mode);
    setMeetingLocation(lead.meeting_location ?? '');
  }, [lead.meeting_at, lead.meeting_mode, lead.meeting_location]);

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
        }),
      },
      { onSuccess: () => toast.success(`${lead.full_name} concluído`) },
    );
  };

  const reopen = () => update.mutate({ id: lead.id, concluded: false });

  const company = [lead.job_title, lead.company_name].filter(Boolean).join(' · ');
  const hasDetails = lead.address || lead.email || lead.website;

  return (
    <motion.li
      ref={ref}
      layout
      initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { ...listSpring, delay: Math.min(index * 0.04, 0.35) } }}
      exit={{ opacity: 0, x: -12, transition: { duration: 0.2 } }}
      transition={listSpring}
      className={cn('card overflow-hidden', concluded && 'opacity-80')}
    >
      {/* Cabeçalho: quem é o lead */}
      <div className="flex flex-wrap items-start gap-4 p-4 md:p-5">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-accent-green/15 text-base font-semibold uppercase text-accent-green">
          {(lead.company_name || lead.full_name).trim().charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <p className="truncate text-[15.5px] font-semibold text-text-primary">{lead.full_name}</p>
            {lead.google_rating !== null && (
              <span className="flex items-center gap-1 text-xs text-text-secondary" title="Avaliação no Google">
                <Star size={12} className="fill-accent-amber text-accent-amber" />
                <strong className="font-semibold text-text-primary">{lead.google_rating.toFixed(1)}</strong>
                {lead.google_reviews !== null && <span className="text-text-muted">({lead.google_reviews})</span>}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
            {company && (
              <span className="flex items-center gap-1">
                <Building2 size={12} />
                {company}
              </span>
            )}
            {lead.niche && <span className="rounded-md bg-fg/[0.05] px-2 py-0.5 font-medium text-text-secondary">{lead.niche}</span>}
            {/* "Sem site" é argumento de venda — fica em destaque */}
            {!lead.website && (
              <span className="rounded-md bg-accent-amber/15 px-2 py-0.5 font-medium text-accent-amber">Sem site</span>
            )}
            <span>Recebido em {formatDay(lead.assigned_for)}</span>
          </div>
        </div>

        {/* Atalhos de um clique */}
        <div className="flex flex-wrap items-center gap-2">
          {lead.phone && (
            <a
              href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`}
              className="flex h-10 items-center gap-2 rounded-xl border border-fg/[0.08] bg-fg/[0.04] px-3 text-sm font-medium text-text-primary transition-colors hover:bg-fg/[0.08]"
              title="Ligar"
            >
              <Phone size={15} />
              {lead.phone}
            </a>
          )}
          {lead.phone && (
            <QuickLink href={whatsappUrl(lead.phone)} label="Abrir no WhatsApp" className="text-[#25D366]">
              <WhatsAppIcon size={18} />
            </QuickLink>
          )}
          {lead.instagram && (
            <QuickLink href={instagramUrl(lead.instagram)} label={`Instagram ${instagramHandle(lead.instagram)}`} className="text-[#E1306C]">
              <Instagram size={18} />
            </QuickLink>
          )}
          <QuickLink href={googleUrl(lead)} label={lead.maps_url ? 'Página no Google' : 'Buscar no Google Maps'}>
            <GoogleIcon size={17} />
          </QuickLink>
          {lead.website && (
            <QuickLink href={websiteUrl(lead.website)} label={`Site: ${websiteLabel(lead.website)}`} className="text-text-secondary">
              <Globe size={17} />
            </QuickLink>
          )}
        </div>
      </div>

      {/* Contexto que o admin deixou sobre a empresa */}
      {lead.lead_context && !concluded && (
        <div className="flex gap-2 border-t border-fg/[0.06] px-4 py-3 text-sm md:px-5">
          <Info size={15} className="mt-0.5 flex-shrink-0 text-accent-amber" />
          <p className="min-w-0 whitespace-pre-line break-words text-text-secondary">{lead.lead_context}</p>
        </div>
      )}

      {/* Dados do lugar */}
      {hasDetails && !concluded && (
        <div className="grid gap-x-6 gap-y-2 border-t border-fg/[0.06] px-4 py-3 sm:grid-cols-2 md:px-5">
          {lead.address && (
            <InfoRow icon={MapPin}>
              <a href={googleUrl(lead)} target="_blank" rel="noopener noreferrer" className="hover:text-text-primary hover:underline">
                {lead.address}
              </a>
            </InfoRow>
          )}
          {lead.website && (
            <InfoRow icon={Globe}>
              <a href={websiteUrl(lead.website)} target="_blank" rel="noopener noreferrer" className="hover:text-text-primary hover:underline">
                {websiteLabel(lead.website)}
              </a>
            </InfoRow>
          )}
          {lead.instagram && (
            <InfoRow icon={Instagram}>
              <a href={instagramUrl(lead.instagram)} target="_blank" rel="noopener noreferrer" className="hover:text-text-primary hover:underline">
                {instagramHandle(lead.instagram)}
              </a>
            </InfoRow>
          )}
          {lead.email && (
            <InfoRow icon={Mail}>
              <a href={`mailto:${lead.email}`} className="hover:text-text-primary hover:underline">
                {lead.email}
              </a>
            </InfoRow>
          )}
        </div>
      )}

      {/* Resultado */}
      <div className="border-t border-fg/[0.06] bg-fg/[0.015] px-4 py-4 md:px-5">
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
            <p className="mb-2.5 text-xs font-medium uppercase tracking-[0.06em] text-text-muted">O que aconteceu na ligação?</p>
            <div className="flex flex-wrap gap-2">
              {CALL_STATUS_ORDER.filter((s) => s !== 'pending').map((s) => {
                const active = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
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

            {/* Reunião marcada: quando (gatilho em formato de "folha de calendário") e como */}
            <AnimatePresence initial={false}>
              {isMeeting && (
                <motion.div
                  key="meeting"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', visualDuration: 0.32, bounce: 0.1 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 rounded-2xl border border-accent-green/20 bg-gradient-to-br from-accent-green/[0.08] via-accent-green/[0.03] to-transparent p-4">
                    <div className="mb-3.5 flex items-center gap-2.5">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent-green/15 text-accent-green">
                        <CalendarClock size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary">Agendar reunião</p>
                        <p className="text-xs text-text-muted">Quando e como vai ser a conversa</p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                      <DateTimePicker
                        value={meetingAt}
                        onChange={setMeetingAt}
                        modalTitle="Data da reunião"
                        renderTrigger={({ open, date }) => (
                          <button
                            type="button"
                            onClick={open}
                            className={cn(
                              'group flex h-[76px] w-full items-center gap-3 rounded-xl border px-3 text-left transition-colors',
                              date
                                ? 'border-fg/[0.08] bg-field hover:border-accent-green/40'
                                : 'border-dashed border-fg/[0.16] hover:border-accent-green/50 hover:bg-accent-green/[0.04]',
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
                                  <span className="block text-sm font-medium text-text-primary">Escolher dia e horário</span>
                                  <span className="block text-xs text-text-muted">Obrigatório</span>
                                </span>
                              </>
                            )}
                          </button>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-2">
                        {MEETING_MODES.map(({ value, label, hint, icon: Icon }) => {
                          const active = meetingMode === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setMeetingMode(value)}
                              aria-pressed={active}
                              className={cn(
                                'relative flex h-[76px] min-w-0 flex-col justify-center gap-1 rounded-xl border px-3 text-left transition-colors',
                                active ? 'border-accent-green/60 bg-accent-green/[0.12]' : 'border-fg/[0.08] bg-field hover:border-fg/[0.18]',
                              )}
                            >
                              <Icon size={17} className={active ? 'text-accent-green' : 'text-text-muted'} />
                              <span className={cn('text-[13px] font-semibold', active ? 'text-text-primary' : 'text-text-secondary')}>{label}</span>
                              <span className="truncate text-[11px] text-text-muted">{hint}</span>
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
                      <div className="relative mt-3">
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
                          className="input-base h-11 pl-10 text-sm"
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={2}
              maxLength={2000}
              placeholder="Anotações (com quem falou, objeções, melhor horário para retornar…)"
              className="input-base mt-3 min-h-[64px] resize-y py-2 text-sm"
            />

            <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
              {(status === 'pending' || meetingMissing) && (
                <span className="mr-auto text-xs text-text-muted">
                  {status === 'pending' ? 'Escolha o resultado para concluir.' : 'Defina dia, horário e formato da reunião.'}
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
    </motion.li>
  );
});
