import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Briefcase, Trophy, Percent, Timer, TrendingUp, Filter, Zap, Landmark, LayoutDashboard, Settings2 } from 'lucide-react';
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
import { CardAction, CardHeader } from '@/components/dashboard/CardHeader';
import { Spinner } from '@/components/ui/Spinner';
import { usePageSubtitle } from '@/store/pageStore';
import { Button } from '@/components/ui/Button';
import { FinanceView } from '@/components/finance/FinanceView';
import { FinanceSettingsModal } from '@/components/finance/FinanceSettingsModal';
import { MonthNavigator } from '@/components/finance/MonthNavigator';
import { useStickyState } from '@/hooks/useStickyState';
import { currentMonth } from '@/lib/finance';
import { pageMotion } from '@/lib/motion';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
  }).format(v);
}

const FREE_CONTACT_LIMIT = 300;

const RANGE_OPTIONS = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'custom', label: 'Personalizado' },
];

export function DashboardPage() {
  const [range, setRange] = useState('today');
  const user = useAuthStore((s) => s.user);
  // Financeiro: só admin (o backend também recusa os demais). A visão fica guardada ao trocar de tela.
  const isAdmin = user?.role === 'admin';
  const [view, setView] = useStickyState<'overview' | 'finance'>('dashboard.view', 'overview');
  const [financeMonth, setFinanceMonth] = useStickyState('dashboard.financeMonth', currentMonth());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const activeView = isAdmin ? view : 'overview';
  usePageSubtitle(activeView === 'finance' ? 'Resultado real do mês: lucro líquido, contas e divisão entre sócios' : 'Resumo do seu workspace hoje');
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
    // mobile-sections: no celular cada bloco vira um card translúcido separado (ver globals.css)
    <div className="mobile-sections space-y-5 max-md:space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-4 pt-1">
        <div>
          <h1 className="page-title">{activeView === 'finance' ? 'Financeiro' : `Olá, ${user?.full_name?.split(' ')[0]}`}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          {activeView === 'finance' ? (
            <>
              <MonthNavigator month={financeMonth} onChange={setFinanceMonth} />
              <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
                <Settings2 size={16} className="mr-2" />
                Configurar
              </Button>
            </>
          ) : (
            // Período (por enquanto só visual — os dados ainda não filtram por ele)
            <SegmentedControl layoutId="dashboard-range-pill" options={RANGE_OPTIONS} value={range} onChange={setRange} className="md:mr-2" />
          )}
          {isAdmin && (
            <Button variant="secondary" onClick={() => setView(activeView === 'finance' ? 'overview' : 'finance')}>
              {activeView === 'finance' ? <LayoutDashboard size={16} className="mr-2" /> : <Landmark size={16} className="mr-2" />}
              {activeView === 'finance' ? 'Visão geral' : 'Financeiro'}
            </Button>
          )}
        </div>
      </div>

      {/* Transição entre as visões; mobile-split = agrupador neutro (cada bloco filho vira um card no celular) */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={activeView} {...pageMotion} className="mobile-split space-y-5 max-md:space-y-3">
          {activeView === 'finance' ? (
            <FinanceView month={financeMonth} onOpenSettings={() => setSettingsOpen(true)} />
          ) : (
            <>
              {isFree && contactCount > 0 && (
                <div>
                  <div className="card px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs text-text-secondary">Contatos usados — plano Free</p>
                        <p className="text-xs font-medium text-text-secondary">
                          {contactCount} / {FREE_CONTACT_LIMIT}
                        </p>
                      </div>
                      <div className="h-1.5 bg-fg/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min((contactCount / FREE_CONTACT_LIMIT) * 100, 100)}%`,
                            backgroundColor:
                              contactCount >= FREE_CONTACT_LIMIT
                                ? 'rgb(var(--status-lost))'
                                : contactCount >= FREE_CONTACT_LIMIT * 0.8
                                  ? 'rgb(var(--accent-amber))'
                                  : 'rgb(var(--accent-green))',
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
                </div>
              )}

              {kpisLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <KpiCard
                    label="Ganhos no mês"
                    icon={Trophy}
                    highlight
                    trend={kpis?.trends?.wonMtd}
                    value={kpis ? kpis.wonMtd : '—'}
                    sub={kpis && kpis.wonMtdValue > 0 ? `${formatCurrency(kpis.wonMtdValue)} em receita` : 'Nenhum ganho ainda'}
                  />
                  <KpiCard label="Negócios em aberto" icon={Briefcase} trend={kpis?.trends?.openDeals} value={kpis?.openDeals ?? '—'} sub="No pipeline agora" />
                  <KpiCard
                    label="Taxa de conversão"
                    icon={Percent}
                    trend={kpis?.trends?.conversionRate}
                    value={kpis ? `${kpis.conversionRate}%` : '—'}
                    sub="Ganhos sobre fechados"
                  />
                  <KpiCard label="Ciclo médio" icon={Timer} trend={kpis?.trends?.avgCycleDays} lowerIsBetter value={kpis ? `${kpis.avgCycleDays}d` : '—'} sub="Da criação ao fechamento" />
                </div>
              )}

              {/* mobile-split: no celular cada gráfico tem o próprio bloco (cada div = bloco, card dentro) */}
              <div className="mobile-split grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <div className="card h-full p-5">
                    <CardHeader icon={TrendingUp} title="Receita ao longo do tempo" action={<CardAction>Últimos 6 meses</CardAction>} />
                    <RevenueChart data={revenue ?? []} />
                  </div>
                </div>
                <div>
                  <div className="card flex h-full flex-col p-5">
                    <CardHeader
                      icon={Filter}
                      title="Funil do pipeline"
                      action={
                        <Link to="/pipeline">
                          <CardAction>Ver pipeline</CardAction>
                        </Link>
                      }
                    />
                    <FunnelChart data={funnel ?? []} />
                  </div>
                </div>
              </div>

              {/* div: no celular vira o bloco translúcido e o card fica dentro (ver .mobile-sections) */}
              <div>
                <div className="card p-5">
                  <CardHeader
                    icon={Zap}
                    title="Atividades recentes"
                    action={
                      <Link to="/calendar">
                        <CardAction>Ver todas</CardAction>
                      </Link>
                    }
                  />
                  <ActivityFeed activities={activitiesData?.data ?? []} />
                </div>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {isAdmin && <FinanceSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
