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
  Lightbulb,
  MapPin,
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
  googleUrl,
  instagramHandle,
  instagramUrl,
  LEAD_PAIN_LABEL,
  leadPains,
  websiteLabel,
  websiteUrl,
  whatsappUrl,
} from '@/lib/captacao';
import { PAIN_ICON } from '@/components/captacao/LeadCard';
import { AddLeadModal } from '@/components/captacao/AddLeadModal';
import { LeadPeopleCard } from '@/components/captacao/LeadPeopleCard';
import { GmailIcon, GoogleIcon, InstagramIcon, WhatsAppIcon } from '@/components/ui/BrandIcons';
import { QuickLink } from '@/components/ui/QuickLink';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

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

  const company = [lead.job_title, lead.company_name].filter(Boolean).join(' · ');
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
      {free ? 'Livre' : `Com ${lead.captador_name?.split(' ')[0] ?? 'captador'}`}
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
          <div className="card flex flex-wrap items-center gap-4 p-5 md:p-6">
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

        {/* Atribuir */}
        <div className="max-lg:order-3">
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-fg/[0.06] px-4 py-3.5 md:px-5">
              <UserCheck size={16} className="text-accent-green" />
              <h2 className="text-sm font-semibold text-text-primary">{free ? 'Atribuir lead' : 'Atribuição'}</h2>
            </div>
            <div className="p-4 md:p-5">
              {free ? (
                <>
                  <p className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-text-muted">Entregar para</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={target} onChange={(e) => setTarget(e.target.value)} className="input-base h-11 min-w-[220px] flex-1">
                      <option value="">Escolha um captador…</option>
                      {active.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name}
                        </option>
                      ))}
                    </select>
                    <Button size="lg" onClick={handleAssign} disabled={!target || assign.isPending} className="max-sm:w-full">
                      <Send size={15} />
                      {assign.isPending ? 'Atribuindo…' : 'Atribuir'}
                    </Button>
                  </div>
                  <p className="mt-3 text-xs text-text-muted">O lead sai da fila e entra nos leads de hoje do captador.</p>
                </>
              ) : (
                <p className="text-sm text-text-secondary">
                  Este lead já está com <strong className="text-text-primary">{lead.captador_name ?? 'um captador'}</strong>. Acompanhe na aba
                  Acompanhamento da Captação.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Contatos que o captador conseguiu (só leitura aqui) */}
        <div className="max-lg:order-3">
          <LeadPeopleCard people={lead.lead_people ?? []} />
        </div>

        {/* Sobre o lead + Possíveis dores (cada um num bloco no celular) */}
        <div className="mobile-split flex flex-col gap-4 max-lg:order-2">
          <div>
            <div className="card p-4 md:p-5">
              <div className="flex items-center gap-2.5">
                <ClipboardList size={18} strokeWidth={2} className="flex-shrink-0 text-accent-green" />
                <h2 className="text-[15px] font-semibold text-text-primary">Sobre o lead</h2>
              </div>
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
            </div>
          </div>

          {pains.length > 0 && (
            <div>
              <div className="card p-4 md:p-5">
                <div className="flex items-center gap-2.5">
                  <Lightbulb size={18} strokeWidth={2} className="flex-shrink-0 text-accent-amber" />
                  <h2 className="text-[15px] font-semibold text-text-primary">Possíveis dores</h2>
                  <span className="ml-auto text-[11px] text-text-muted">argumentos pra ligação</span>
                </div>
                <ul className="mt-4 divide-y divide-fg/[0.06] overflow-hidden rounded-xl border border-fg/[0.06]">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
