import { Link } from 'react-router-dom';
import { Briefcase, Trophy, Percent, Timer } from 'lucide-react';
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
      <div className="pt-1">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-text-primary">
          Olá, {user?.full_name?.split(' ')[0]}
        </h1>
        <p className="mt-1 text-[14px] text-text-secondary">Resumo do seu workspace hoje</p>
      </div>

      {isFree && contactCount > 0 && (
        <div className="card px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-text-secondary">
                Contatos usados — plano Free
              </p>
              <p className="text-xs font-medium text-text-secondary">
                {contactCount} / {FREE_CONTACT_LIMIT}
              </p>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Ganhos no mês"
            icon={Trophy}
            highlight
            value={kpis ? kpis.wonMtd : '—'}
            sub={kpis && kpis.wonMtdValue > 0 ? `${formatCurrency(kpis.wonMtdValue)} em receita` : 'Nenhum ganho ainda'}
          />
          <KpiCard label="Negócios em aberto" icon={Briefcase} value={kpis?.openDeals ?? '—'} sub="No pipeline agora" />
          <KpiCard
            label="Taxa de conversão"
            icon={Percent}
            value={kpis ? `${kpis.conversionRate}%` : '—'}
            sub="Ganhos sobre fechados"
          />
          <KpiCard label="Ciclo médio" icon={Timer} value={kpis ? `${kpis.avgCycleDays}d` : '—'} sub="Da criação ao fechamento" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-[15px] font-medium text-text-primary mb-4">Receita ao longo do tempo</p>
          <RevenueChart data={revenue ?? []} />
        </div>
        <div className="card p-5">
          <p className="text-[15px] font-medium text-text-primary mb-4">Funil do pipeline</p>
          <FunnelChart data={funnel ?? []} />
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[15px] font-medium text-text-primary">Atividades recentes</p>
          <Link to="/calendar" className="text-xs font-medium text-accent-green hover:underline">
            Ver todas
          </Link>
        </div>
        <ActivityFeed activities={activitiesData?.data ?? []} />
      </div>
    </div>
  );
}
