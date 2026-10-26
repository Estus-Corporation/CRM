import { useNavigate } from 'react-router-dom';
import { Building2, Mail, MessageSquareText, Pencil, Tags, Users } from 'lucide-react';
import { TeamRoster, buildRoster } from '@/components/company/TeamRoster';
import { useTenant, isCompanyProfileComplete } from '@/hooks/useTenant';
import { useAuthStore } from '@/store/authStore';
import { CompanyLogo } from '@/components/company/CompanyLogo';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

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

/** "Sobre a empresa": o material que a equipe (principalmente o captador) consulta pra vender */
export function CompanyPage() {
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

  const editButton = isAdmin && (
    <Button variant="secondary" size="sm" onClick={() => navigate('/settings#empresa')}>
      <Pencil size={14} />
      Editar
    </Button>
  );

  return (
    // mobile-sections: no celular cada parte vira um bloco translúcido separado (ver globals.css)
    <div className="mobile-sections space-y-4 max-md:space-y-3">
      <header className="flex flex-wrap items-center gap-4">
        <CompanyLogo name={tenant?.name} logoUrl={tenant?.logo_url} className="h-16 w-16 flex-shrink-0 text-2xl" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold text-text-primary">{tenant?.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
            {tenant?.service_type && <span>{tenant.service_type}</span>}
            {tenant?.email && (
              <a href={`mailto:${tenant.email}`} className="flex items-center gap-1.5 transition-colors hover:text-accent-green">
                <Mail size={14} />
                {tenant.email}
              </a>
            )}
          </div>
        </div>
        {editButton}
      </header>

      {/* Conteúdo à esquerda; quem faz parte fica fixo na coluna da direita */}
      {/* grid-cols-1 = minmax(0,1fr): sem isso a coluna cresce até o texto mais longo e vaza da tela */}
      <div className="mobile-split grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="mobile-split flex min-w-0 flex-col gap-4">
          {!isCompanyProfileComplete(tenant) && !tenant?.offer && !tenant?.pitch ? (
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
              <Section icon={Building2} title="Sobre a empresa" text={tenant?.about ?? null} />
              <Section icon={Tags} title="Serviços e preços" text={tenant?.offer ?? null} />
              <Section icon={MessageSquareText} title="Estratégia de abordagem" text={tenant?.pitch ?? null} />
            </>
          )}
        </div>

        {!!tenant?.members?.length && (
          <div className="lg:sticky lg:top-4">
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
  );
}
