import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  Pencil,
  Building2,
  CalendarDays,
  ClipboardList,
  Globe,
  Instagram,
  Lightbulb,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  PhoneOff,
  Send,
  Star,
  Tag,
  User,
  UserCheck,
} from 'lucide-react';
import { useAssignLeads, useCaptadores, useManagerLead } from '@/hooks/useCaptacao';
import {
  CALL_STATUS,
  googleUrl,
  instagramHandle,
  instagramUrl,
  LEAD_PAIN_LABEL,
  LEAD_PAIN_SCRIPT,
  leadPains,
  LOST_REASON_LABEL,
  websiteLabel,
  websiteUrl,
  whatsappUrl,
} from '@/lib/captacao';
import { AttemptsTimeline, PAIN_ICON } from '@/components/captacao/LeadCard';
import { AddLeadModal } from '@/components/captacao/AddLeadModal';
import { LeadPeopleCard } from '@/components/captacao/LeadPeopleCard';
import { GmailIcon, GoogleIcon, InstagramIcon, WhatsAppIcon } from '@/components/ui/BrandIcons';
import { QuickLink } from '@/components/ui/QuickLink';
import { Button } from '@/components/ui/Button';
import { SelectDropdown } from '@/components/ui/SelectDropdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn, formatPhone, shortName } from '@/lib/utils';
import { SPLIT_CARD, SPLIT_CARD_BODY, SPLIT_CARD_HEAD } from '@/components/captacao/cardStyles';

/**
 * Página de um lead vista pelo admin/gerente (aberta pela aba Distribuir): o mesmo cabeçalho,
 * "Sobre o lead" e "Possíveis dores" da página do captador, e um card pra atribuir a alguém.
 */
export function ManagerLeadPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: lead, isLoading, isError } = useManagerLead(id);
  const { data: captadores = [] } = useCaptadores();
  const active = captadores.filter((c) => c.is_active);
  const assign = useAssignLeads();
  const [target, setTarget] = useState('');
  const [editOpen, setEditOpen] = useState(false);

  const back = (
    <div>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft size={16} />
        Captação
      </button>
    </div>
  );

  if (isLoading && !lead) {
    return (
      <div className="space-y-4">
        {back}
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!lead || isError) {
    return (
      <div className="mobile-sections space-y-4 max-md:space-y-3">
        {back}
        <div>
          <div className="card">
            <EmptyState icon={PhoneOff} title="Lead não encontrado" description="Ele pode ter sido removido." />
          </div>
        </div>
      </div>
    );
  }

  const company = [lead.job_title, lead.company_name && lead.company_name !== lead.full_name ? lead.company_name : null].filter(Boolean).join(' · ');
  const pains = leadPains(lead);
  const free = !lead.assignment_id;

  const stateChip = (
    <span
      className={cn(
        'inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
        free ? 'border border-dashed border-fg/[0.22] text-text-muted' : 'bg-accent-green/15 text-accent-green',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', free ? 'bg-text-muted' : 'bg-accent-green')} />
      {free ? 'Livre' : `Com ${lead.captador_name ? shortName(lead.captador_name) : 'captador'}`}
    </span>
  );

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

  // Ficha do "Sobre o lead": uma linha por informação, só as que têm valor
  const facts = [
    lead.company_name && { icon: Building2, label: 'Empresa', value: lead.company_name },
    lead.job_title && { icon: User, label: 'Cargo', value: lead.job_title },
    lead.niche && { icon: Tag, label: 'Segmento', value: lead.niche },
    lead.address && { icon: MapPin, label: 'Endereço', value: lead.address, href: googleUrl(lead) },
    // Mesmos dados dos atalhos do cabeçalho (igual à ficha da página do captador)
    lead.phone && { icon: Phone, label: 'Telefone', value: formatPhone(lead.phone), href: `tel:${lead.phone.replace(/[^\d+]/g, '')}` },
    lead.phone && { icon: MessageSquare, label: 'WhatsApp', value: formatPhone(lead.phone), href: whatsappUrl(lead.phone) },
    lead.instagram && { icon: Instagram, label: 'Instagram', value: instagramHandle(lead.instagram), href: instagramUrl(lead.instagram) },
    { icon: Star, label: 'Google', value: lead.maps_url ? 'Página no Google' : 'Buscar no Google Maps', href: googleUrl(lead) },
    lead.website && { icon: Globe, label: 'Site', value: websiteLabel(lead.website), href: websiteUrl(lead.website) },
    lead.email && { icon: Mail, label: 'E-mail', value: lead.email, href: `mailto:${lead.email}` },
    { icon: CalendarDays, label: 'Cadastrado em', value: format(new Date(lead.created_at), "d 'de' MMM 'de' yyyy", { locale: ptBR }) },
  ].filter(Boolean) as { icon: typeof Globe; label: string; value: string; href?: string }[];

  const handleAssign = () => {
    if (!target) return;
    assign.mutate({ captadorId: target, contactIds: [lead.id] }, { onSuccess: () => navigate(-1) });
  };

  return (
    // mobile-sections: no celular cada parte vira um bloco translúcido separado (ver globals.css)
    <div className="mobile-sections space-y-4 max-md:space-y-3">
      {back}
      <AddLeadModal open={editOpen} onClose={() => setEditOpen(false)} editing={lead} />

      <div className="mobile-split grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Cabeçalho: identidade + atalhos + situação */}
        <div className="max-lg:order-1 lg:col-span-2">
          {/* Mesmo vidro transparente do cabeçalho da página do lead do captador */}
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-fg/[0.1] bg-fg/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] md:p-6">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-fg/[0.08] text-text-primary">
              <Building2 size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <p className="page-title-sm truncate text-text-primary">{lead.full_name}</p>
                {lead.google_rating != null && (
                  <span className="flex items-center gap-1 text-xs text-text-secondary" title="Avaliação no Google">
                    <Star size={12} className="fill-accent-amber text-accent-amber" />
                    <strong className="font-semibold text-text-primary">{lead.google_rating.toFixed(1)}</strong>
                    {lead.google_reviews != null && <span className="text-text-muted">({lead.google_reviews})</span>}
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
                  <span className="max-w-full truncate whitespace-nowrap rounded-md bg-fg/[0.05] px-2 py-0.5 font-medium text-text-secondary">
                    {lead.niche}
                  </span>
                )}
                <span className="sm:hidden">{stateChip}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 max-sm:hidden">
              {quickLinks}
              <span className="mx-1 h-6 w-px bg-fg/[0.1]" />
              {stateChip}
            </div>
            {/* Editar os dados do lead (só admin/gerente chegam nesta página) */}
            <Button variant="secondary" onClick={() => setEditOpen(true)} className="max-sm:w-full">
              <Pencil size={14} />
              Editar
            </Button>
          </div>
        </div>

        {/* Celular: atalhos num bloco próprio logo abaixo do cabeçalho */}
        <div className="max-lg:order-1 sm:hidden">
          <div className="card grid auto-cols-fr grid-flow-col gap-2 p-2 [&>a]:!w-full">{quickLinks}</div>
        </div>

        {/* Sobre o lead + Possíveis dores (cada um num bloco no celular) */}
        <div className="mobile-split flex flex-col gap-4 max-lg:order-2">
          <div>
            <div className={cn(SPLIT_CARD, SPLIT_CARD_BODY)}>
              <div className={cn(SPLIT_CARD_HEAD, 'md:px-5')}>
                <ClipboardList size={16} className="text-accent-green" />
                <h2 className="text-[15px] font-semibold text-text-primary">Ficha</h2>
              </div>
              <dl className="divide-y divide-fg/[0.06] px-4 py-1 md:px-5">
                {facts.map(({ icon: Icon, label, value, href }) => (
                  <div key={label} className="grid grid-cols-[16px_110px_minmax(0,1fr)] items-start gap-2.5 py-3">
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
            </div>
          </div>

          {pains.length > 0 && (
            <div>
              <div className={cn(SPLIT_CARD, SPLIT_CARD_BODY)}>
                <div className={SPLIT_CARD_HEAD}>
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
            </div>
          )}
        </div>
        {/* Coluna da direita: contatos do lead e, embaixo, a atribuição */}
        <div className="mobile-split flex flex-col gap-4 max-lg:order-3">
          {/* Contatos que o captador conseguiu (só leitura aqui) */}
          <div>
            <LeadPeopleCard people={lead.lead_people ?? []} />
          </div>
          {/* Atribuir */}
          <div>
            <div className={cn(SPLIT_CARD, SPLIT_CARD_BODY)}>
              <div className={cn(SPLIT_CARD_HEAD, 'md:px-5')}>
                <UserCheck size={16} className="text-accent-green" />
                <h2 className="text-sm font-semibold text-text-primary">{free ? 'Atribuir lead' : 'Atribuição'}</h2>
              </div>
              <div className="p-4 md:p-5">
                {free ? (
                  <>
                    <p className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-text-muted">Entregar para</p>
                    {/* Escolha, aviso logo abaixo e o botão na largura toda (a coluna é estreita) */}
                    <SelectDropdown
                      value={target}
                      onChange={setTarget}
                      placeholder="Escolha um captador…"
                      title="Captador"
                      options={active.map((c) => ({ value: c.id, label: shortName(c.full_name) }))}
                      className="w-full"
                    />
                    <p className="mt-2 text-xs text-text-muted">O lead sai da fila e entra nos leads de hoje do captador.</p>
                    <Button size="lg" onClick={handleAssign} disabled={!target || assign.isPending} className="mt-4 w-full">
                      <Send size={15} />
                      {assign.isPending ? 'Atribuindo…' : 'Atribuir'}
                    </Button>
                  </>
                ) : (
                  // Andamento com o captador: situação, ligação, retorno, anotação e histórico de tentativas
                  <div className="space-y-3">
                    <p className="text-sm text-text-secondary">
                      Com <strong className="text-text-primary">{lead.captador_name ? shortName(lead.captador_name) : 'um captador'}</strong>
                    </p>
                    <dl className="grid gap-x-4 gap-y-2 text-[13.5px] sm:grid-cols-[120px_minmax(0,1fr)]">
                      <dt className="text-text-muted">Situação</dt>
                      <dd className="font-medium text-text-primary">
                        {lead.lead_result === 'won'
                          ? 'Ganhou'
                          : lead.lead_result === 'lost'
                            ? `Perdeu${lead.lost_reason ? ` · ${LOST_REASON_LABEL[lead.lost_reason]}` : ''}`
                            : lead.on_hold_at && !lead.concluded_at
                              ? 'Em aguardo'
                              : 'Pendente'}
                      </dd>
                      <dt className="text-text-muted">Ligação</dt>
                      <dd className="font-medium text-text-primary">
                        {lead.call_status && lead.call_status !== 'pending' ? CALL_STATUS[lead.call_status].label : '—'}
                      </dd>
                      {lead.next_contact_at && (
                        <>
                          <dt className="text-text-muted">Retorno</dt>
                          <dd className={cn('font-medium', new Date(lead.next_contact_at) < new Date() ? 'text-status-lost' : 'text-accent-amber')}>
                            {format(new Date(lead.next_contact_at), "EEE, d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                          </dd>
                        </>
                      )}
                      {lead.call_notes && (
                        <>
                          <dt className="text-text-muted">Anotação</dt>
                          <dd className="whitespace-pre-line text-text-secondary">{lead.call_notes}</dd>
                        </>
                      )}
                    </dl>
                    {lead.attempts.length > 0 && (
                      <div className="border-t border-fg/[0.06] pt-3">
                        <p className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-text-muted">Histórico</p>
                        <AttemptsTimeline attempts={lead.attempts} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
