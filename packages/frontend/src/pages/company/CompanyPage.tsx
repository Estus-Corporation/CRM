import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AtSign, Building2, ClipboardList, Globe, Mail, MapPin, MessageSquareText, Pencil, Phone, Tag, Tags, Users } from 'lucide-react';
import { QuickLink } from '@/components/ui/QuickLink';
import { OfferFilePanel } from '@/components/company/OfferFile';
import { GmailIcon, InstagramIcon, WhatsAppIcon } from '@/components/ui/BrandIcons';
import { instagramHandle, instagramUrl, websiteLabel, websiteUrl, whatsappUrl } from '@/lib/captacao';
import { TeamRoster, buildRoster } from '@/components/company/TeamRoster';
import { useTenant, isCompanyProfileComplete } from '@/hooks/useTenant';
import { useAuthStore } from '@/store/authStore';
import { CompanyLogo } from '@/components/company/CompanyLogo';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePageSubtitle } from '@/store/pageStore';

function Section({ icon: Icon, title, text }: { icon: typeof Building2; title: string; text: string | null }) {
  if (!text) return null;
  // div externo: no celular vira o bloco translúcido e o card fica dentro (ver .mobile-split)
  return (
    <div>
      <section className="card p-5 md:p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Icon size={16} className="text-accent-green" />
          {title}
        </h2>
        {/* pre-wrap: respeita as quebras de linha e listas que o admin digitou */}
        <p className="mt-3 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-text-secondary">{text}</p>
      </section>
    </div>
  );
}

type Fact = { icon: ComponentType<{ size?: number; className?: string }>; label: string; value: string; href?: string };

/** Ficha da empresa no mesmo formato do "Sobre o lead": uma linha por informação, só as que têm valor */
function FactSheet({ facts }: { facts: Fact[] }) {
  if (!facts.length) return null;
  return (
    <div className="h-full">
      <section className="card h-full p-4 md:p-5">
        <div className="flex items-center gap-2.5">
          <ClipboardList size={18} strokeWidth={2} className="flex-shrink-0 text-accent-green" />
          <h2 className="text-[15px] font-semibold text-text-primary">Ficha da empresa</h2>
        </div>
        <dl className="mt-4 divide-y divide-fg/[0.06] overflow-hidden rounded-xl border border-fg/[0.06]">
          {facts.map(({ icon: Icon, label, value, href }) => (
            <div key={label} className="grid grid-cols-[18px_76px_minmax(0,1fr)] items-center gap-3 px-3.5 py-3">
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
      </section>
    </div>
  );
}

/** "Sobre a empresa": o material que a equipe (principalmente o captador) consulta pra vender */
export function CompanyPage() {
  usePageSubtitle('Quem somos, o que vendemos e como abordar o cliente');
  const navigate = useNavigate();
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const { data: tenant, isLoading } = useTenant();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  // Ficha: nome, segmento, telefone, Instagram, e-mail, WhatsApp e site
  const facts = [
    tenant?.name && { icon: Building2, label: 'Empresa', value: tenant.name },
    tenant?.service_type && { icon: Tag, label: 'Segmento', value: tenant.service_type },
    tenant?.phone && { icon: Phone, label: 'Telefone', value: tenant.phone, href: `tel:${tenant.phone.replace(/[^\d+]/g, '')}` },
    tenant?.instagram && { icon: AtSign, label: 'Instagram', value: instagramHandle(tenant.instagram), href: instagramUrl(tenant.instagram) },
    tenant?.email && { icon: Mail, label: 'E-mail', value: tenant.email, href: `mailto:${tenant.email}` },
    tenant?.phone && { icon: WhatsAppIcon, label: 'WhatsApp', value: tenant.phone, href: whatsappUrl(tenant.phone) },
    tenant?.website && { icon: Globe, label: 'Site', value: websiteLabel(tenant.website), href: websiteUrl(tenant.website) },
  ].filter(Boolean) as Fact[];

  const hasLinks = !!(tenant?.phone || tenant?.instagram || tenant?.website || tenant?.address || tenant?.email);

  const editButton = isAdmin && (
    // Celular: só o ícone, botão redondo sobre a quina superior direita do card (metade pra fora)
    <Button
      variant="secondary"
      size="sm"
      onClick={() => navigate('/settings#empresa')}
      aria-label="Editar perfil da empresa"
      className="max-md:absolute max-md:-right-1.5 max-md:-top-3.5 max-md:z-10 max-md:h-9 max-md:w-9 max-md:rounded-full max-md:px-0 max-md:!border-fg/[0.18] max-md:!bg-bg-surface max-md:text-text-primary max-md:shadow-[0_6px_16px_-4px_rgba(0,0,0,0.7)]"
    >
      <Pencil size={14} />
      <span className="max-md:hidden">Editar</span>
    </Button>
  );

  return (
    // mobile-sections: no celular cada parte vira um bloco translúcido separado (ver globals.css)
    <div className="mobile-sections space-y-5 max-md:space-y-3">
      {/* Cabeçalho com divisória embaixo (pouco respiro até a linha e até o conteúdo) */}
      <header className="relative flex flex-wrap items-center gap-4 border-b border-fg/[0.06] pb-5 max-md:border-b-0 max-md:pb-0">
        <CompanyLogo name={tenant?.name} logoUrl={tenant?.logo_url} className="h-16 w-16 flex-shrink-0 text-2xl" />
        <div className={cn('min-w-0 flex-1', isAdmin && 'max-md:pr-8')}>
          <h1 className="page-title truncate">{tenant?.name}</h1>
        </div>
        {/* Atalhos de um clique na extrema direita do cabeçalho (celular: linha de baixo, centralizados) */}
        {hasLinks && (
          <div className="ml-auto flex flex-wrap justify-end gap-2 max-sm:basis-full max-sm:justify-center">
            {tenant?.phone && (
              <QuickLink href={`tel:${tenant.phone.replace(/[^\d+]/g, '')}`} label="Ligar" className="text-text-primary">
                <Phone size={18} fill="currentColor" strokeWidth={1} />
              </QuickLink>
            )}
            {tenant?.phone && (
              <QuickLink href={whatsappUrl(tenant.phone)} label="WhatsApp" className="text-[#25D366]">
                <WhatsAppIcon size={20} />
              </QuickLink>
            )}
            {tenant?.instagram && (
              <QuickLink href={instagramUrl(tenant.instagram)} label={`Instagram ${instagramHandle(tenant.instagram)}`} >
                <InstagramIcon size={23} />
              </QuickLink>
            )}
            {tenant?.website && (
              <QuickLink href={websiteUrl(tenant.website)} label={`Site: ${websiteLabel(tenant.website)}`} className="text-text-primary">
                <Globe size={19} />
              </QuickLink>
            )}
            {tenant?.address && (
              <QuickLink
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.address)}`}
                label={`Endereço: ${tenant.address}`}
                className="text-text-secondary"
              >
                <MapPin size={19} />
              </QuickLink>
            )}
            {tenant?.email && (
              <QuickLink href={`mailto:${tenant.email}`} label={`E-mail: ${tenant.email}`}>
                <GmailIcon size={19} />
              </QuickLink>
            )}
          </div>
        )}
        {editButton}
      </header>

      {/* Conteúdo à esquerda; quem faz parte fica fixo na coluna da direita */}
      {/* grid-cols-1 = minmax(0,1fr): sem isso a coluna cresce até o texto mais longo e vaza da tela */}
      <div className="mobile-split grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="mobile-split flex min-w-0 flex-col gap-4">
          {!isCompanyProfileComplete(tenant) && !tenant?.offer && !tenant?.offer_file_name && !tenant?.pitch ? (
            <div>
              <div className="card">
                <EmptyState
                  icon={Building2}
                  title="Perfil da empresa ainda não preenchido"
                  description={
                    isAdmin
                      ? 'Conte o que a empresa faz, os preços e como abordar o cliente — é o que a equipe vai consultar aqui.'
                      : 'O administrador ainda não escreveu sobre a empresa. Assim que ele preencher, aparece aqui.'
                  }
                  action={
                    isAdmin
                      ? {
                          label: 'Preencher agora',
                          onClick: () => navigate('/settings#empresa'),
                        }
                      : undefined
                  }
                />
              </div>
            </div>
          ) : (
            <>
              {/* Ficha da empresa à esquerda, Serviços e preços ao lado */}
              {/* items-stretch: Ficha e Serviços com a mesma altura */}
              <div className="mobile-split grid grid-cols-1 items-stretch gap-4 md:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
              <FactSheet facts={facts} />
              {tenant?.offer_file_name ? (
                <div className="h-full">
                  <OfferFilePanel
                    tenant={tenant}
                    title={
                      <h2 className="flex items-center gap-2.5 text-[15px] font-semibold text-text-primary">
                        <Tags size={18} strokeWidth={2} className="flex-shrink-0 text-accent-green" />
                        Serviços e preços
                      </h2>
                    }
                  />
                </div>
              ) : (
                <Section icon={Tags} title="Serviços e preços" text={tenant?.offer ?? null} />
              )}
              </div>
              <Section icon={MessageSquareText} title="Estratégia de abordagem" text={tenant?.pitch ?? null} />
            </>
          )}
        </div>

        {/* Coluna da direita: ficha da empresa + integrantes */}
        <div className="mobile-split flex flex-col gap-4 lg:sticky lg:top-4">
        {!!tenant?.members?.length && (
          <div>
            <aside className="card p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Users size={16} className="text-accent-green" />
                Integrantes
                <span className="font-normal text-text-muted">· {buildRoster(tenant.members, tenant.key_people).length}</span>
              </h2>
              <TeamRoster members={tenant.members} keyPeople={tenant.key_people} className="mt-3" />
            </aside>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
