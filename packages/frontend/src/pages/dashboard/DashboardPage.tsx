import { Link } from 'react-router-dom';
import { useKpis, useFunnel, useRevenue } from '@/hooks/useReports';
import { useActivities } from '@/hooks/useActivities';
import { useContacts } from '@/hooks/useContacts';
import { useTenant } from '@/hooks/useTenant';
import { useUpgradeStore } from '@/store/upgradeStore';
import { useAuthStore } from '@/store/authStore';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { FunnelChart } from '@/components/dashboard/FunnelChart';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { Spinner } from '@/components/ui/Spinner';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
  }).format(v);
}

const FREE_CONTACT_LIMIT = 300;

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: kpis, isLoading: kpisLoading } = useKpis();
  const { data: funnel } = useFunnel();
  const { data: revenue } = useRevenue();
  const { data: activitiesData } = useActivities({ limit: 8 });
  const { data: tenant } = useTenant();
  const showUpgrade = useUpgradeStore((s) => s.showUpgrade);
  const isFree = tenant?.plan === 'free';
  const { data: contactsData } = useContacts({ limit: 1 });
  const contactCount = isFree ? (contactsData?.meta?.total ?? 0) : 0;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-text-secondary">
          Olá, {user?.full_name?.split(' ')[0]} — resumo do seu workspace hoje
        </p>
      </div>

      {isFree && contactCount > 0 && (
        <div className="card px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-text-secondary">
                Contatos usados — plano Free
              </p>
              <p className="text-xs font-medium text-text-secondary">
                {contactCount} / {FREE_CONTACT_LIMIT}
              </p>
            </div>
            <div className="h-1.5 bg-bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min((contactCount / FREE_CONTACT_LIMIT) * 100, 100)}%`,
                  backgroundColor: contactCount >= FREE_CONTACT_LIMIT ? '#ef4444' : contactCount >= FREE_CONTACT_LIMIT * 0.8 ? '#f59e0b' : '#72d296',
                }}
              />
            </div>
          </div>
          {contactCount >= FREE_CONTACT_LIMIT * 0.8 && (
            <button
              onClick={() => showUpgrade('starter')}
              className="text-xs font-medium text-accent-green hover:underline whitespace-nowrap flex-shrink-0"
            >
              Fazer upgrade
            </button>
          )}
        </div>
      )}

      {kpisLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Negócios em aberto" value={kpis?.openDeals ?? '—'} />
          <KpiCard
            label="Ganhos no mês"
            value={kpis ? kpis.wonMtd : '—'}
            sub={kpis && kpis.wonMtdValue > 0 ? formatCurrency(kpis.wonMtdValue) : undefined}
          />
          <KpiCard
            label="Taxa de conversão"
            value={kpis ? `${kpis.conversionRate}%` : '—'}
          />
          <KpiCard
            label="Ciclo médio (dias)"
            value={kpis?.avgCycleDays ?? '—'}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-sm font-medium text-text-secondary mb-3">Receita ao longo do tempo</p>
          <RevenueChart data={revenue ?? []} />
        </div>
        <div className="card p-4">
          <p className="text-sm font-medium text-text-secondary mb-3">Funil do pipeline</p>
          <FunnelChart data={funnel ?? []} />
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-text-secondary">Atividades recentes</p>
          <Link to="/calendar" className="text-xs font-medium text-accent-green hover:underline">
            Ver todas
          </Link>
        </div>
        <ActivityFeed activities={activitiesData?.data ?? []} />
      </div>
    </div>
  );
}
