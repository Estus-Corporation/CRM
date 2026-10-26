import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Zap, ExternalLink, CreditCard, MessageCircle, UserCog } from 'lucide-react';
import { ApiKeysSection } from '@/components/integrations/ApiKeysSection';
import { WebhooksSection } from '@/components/integrations/WebhooksSection';
import { useBilling, useCreateCheckoutSession, useCreatePortalSession } from '@/hooks/useBilling';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { CompanyProfileForm } from '@/components/company/CompanyProfileForm';
import { TeamPanel } from '@/components/team/TeamPanel';
import { useTenant } from '@/hooks/useTenant';
import { Spinner } from '@/components/ui/Spinner';

const PLAN_LABEL: Record<string, string> = {
  free: 'FREE',
  starter: 'STARTER',
  pro: 'PRO',
  enterprise: 'ENTERPRISE',
};

const PLAN_COLOR: Record<string, string> = {
  free: 'text-text-muted bg-bg-border',
  starter: 'text-status-open bg-status-open/20',
  pro: 'text-accent-green bg-accent-green/20',
  enterprise: 'text-purple-400 bg-purple-500/20',
};

function BillingSection({ isAdmin }: { isAdmin: boolean }) {
  const { data, isLoading } = useBilling();
  const checkout = useCreateCheckoutSession();
  const portal = useCreatePortalSession();

  if (isLoading) {
    return (
      <div className="card px-5 py-6 flex justify-center">
        <Spinner />
      </div>
    );
  }

  const plan = data?.plan ?? 'free';
  const hasPaidPlan = plan !== 'free';
  const periodEnd = data?.subscription?.current_period_end;

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-border flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-text-primary">Plano & Faturamento</p>
          <p className="text-xs text-text-muted mt-0.5">Gerencie sua assinatura</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${PLAN_COLOR[plan] ?? PLAN_COLOR.free}`}>
          {PLAN_LABEL[plan] ?? plan.toUpperCase()}
        </span>
      </div>

      <div className="px-5 py-5 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Usuários incluídos</span>
          <span className="font-medium text-text-primary">{data?.maxUsers ?? 3}</span>
        </div>

        {periodEnd && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Próxima renovação</span>
            <span className="font-medium text-text-primary">
              {new Date(periodEnd).toLocaleDateString('pt-BR')}
            </span>
          </div>
        )}

        {isAdmin && (
          <div className="flex flex-wrap gap-2 pt-1">
            {hasPaidPlan ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={portal.isPending}
                onClick={() => portal.mutate()}
                className="flex items-center gap-1.5"
              >
                <ExternalLink size={13} />
                {portal.isPending ? 'Redirecionando…' : 'Gerenciar assinatura'}
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={checkout.isPending}
                  onClick={() => checkout.mutate('starter')}
                  className="flex items-center gap-1.5"
                >
                  <CreditCard size={13} />
                  Starter
                </Button>
                <Button
                  size="sm"
                  disabled={checkout.isPending}
                  onClick={() => checkout.mutate('pro')}
                  className="flex items-center gap-1.5"
                >
                  <Zap size={13} />
                  {checkout.isPending ? 'Redirecionando…' : 'Upgrade para Pro'}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';
  const { data: tenant } = useTenant();

  // Engrenagem do seletor de workspace / "Editar" de Sobre a empresa caem em /settings#empresa:
  // rola até a seção — também quando já se está nesta página (location.key muda a cada navegação)
  const location = useLocation();
  const navigate = useNavigate();
  const hasTenant = !!tenant;
  useEffect(() => {
    if (location.hash !== '#empresa' || !hasTenant) return;
    document.getElementById('empresa')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash, location.key, hasTenant]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Configurações</h1>
          <p className="text-sm text-text-secondary mt-0.5">Configurações deste workspace: empresa, plano e equipe</p>
        </div>
        {/* Perfil pessoal (foto, nome, senha, workspaces) fica em Minha conta */}
        <Button variant="secondary" size="sm" onClick={() => navigate('/conta')}>
          <UserCog size={14} />
          Minha conta
        </Button>
      </div>

      {/* Conteúdo à esquerda; equipe fixa na coluna da direita */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {/* Perfil da empresa — o que a equipe lê em "Sobre a empresa" */}
          {isAdmin && (
            <div id="empresa" className="card scroll-mt-6 overflow-hidden">
              <div className="border-b border-bg-border px-5 py-4">
                <p className="text-sm font-medium text-text-primary">Perfil da empresa</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  Aparece para toda a equipe em "Sobre a empresa" — é onde os captadores aprendem o que vender e como abordar.
                </p>
              </div>
              <div className="p-5">
                <CompanyProfileForm tenant={tenant} />
              </div>
            </div>
          )}

          <BillingSection isAdmin={isAdmin} />

          {/* Integrations sections — gated by starter tier */}
          <WebhooksSection isAdmin={isAdmin} />
          <ApiKeysSection isAdmin={isAdmin} />

          {/* WhatsApp support */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-bg-border">
              <p className="text-sm font-medium text-text-primary">Suporte via WhatsApp</p>
              <p className="text-xs text-text-muted mt-0.5">Fale diretamente com nossa equipe</p>
            </div>
            <div className="px-5 py-5 flex items-center justify-between gap-4">
              <p className="text-sm text-text-secondary">
                Tire dúvidas, reporte problemas ou solicite ajuda com a configuração do TitanFlow.
              </p>
              <a
                href="https://wa.me/5516992386188"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-medium transition-colors"
              >
                <MessageCircle size={16} />
                Abrir WhatsApp
              </a>
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-4">
          <TeamPanel />
        </div>
      </div>
    </div>
  );
}
