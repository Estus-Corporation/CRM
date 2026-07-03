import { useState, useRef } from 'react';
import { Download, Upload, Trophy, Activity, BarChart3, FileDown, Lock } from 'lucide-react';
import { useKpis, useFunnel, useRevenue, useActivitiesReport, useLeaderboard } from '@/hooks/useReports';
import { useQueryClient } from '@tanstack/react-query';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { FunnelChart } from '@/components/dashboard/FunnelChart';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/services/api';
import { contactsService } from '@/services/contacts.service';
import { useTenant } from '@/hooks/useTenant';
import { useUpgradeStore } from '@/store/upgradeStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Tab = 'overview' | 'activities' | 'leaderboard' | 'export';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);
}

function formatCurrencyFull(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

const activityTypeLabel: Record<string, string> = {
  call: 'Ligação',
  email: 'E-mail',
  meeting: 'Reunião',
  task: 'Tarefa',
  note: 'Nota',
  whatsapp: 'WhatsApp',
};

const periodOptions = [
  { value: 'month' as const, label: 'Mensal' },
  { value: 'week' as const, label: 'Semanal' },
];

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Visão geral', icon: <BarChart3 size={14} /> },
  { id: 'activities', label: 'Atividades', icon: <Activity size={14} /> },
  { id: 'leaderboard', label: 'Ranking', icon: <Trophy size={14} /> },
  { id: 'export', label: 'Exportar', icon: <FileDown size={14} /> },
];

const GATED_TABS: Tab[] = ['activities', 'leaderboard'];

function isPlanAtLeast(plan: string, required: string) {
  const order = ['free', 'starter', 'pro', 'enterprise'];
  return order.indexOf(plan) >= order.indexOf(required);
}

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [period, setPeriod] = useState<'month' | 'week'>('month');
  const [downloading, setDownloading] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { data: tenant } = useTenant();
  const showUpgrade = useUpgradeStore((s) => s.showUpgrade);
  const plan = tenant?.plan ?? 'free';
  const hasStarterPlus = isPlanAtLeast(plan, 'starter');

  const { data: kpis, isLoading: kpisLoading } = useKpis();
  const { data: funnel, isLoading: funnelLoading } = useFunnel();
  const { data: revenue, isLoading: revenueLoading } = useRevenue(period);
  const { data: activities, isLoading: activitiesLoading } = useActivitiesReport();
  const { data: leaderboard, isLoading: leaderboardLoading } = useLeaderboard();

  const handleDownload = async (type: 'contacts' | 'deals' | 'activities') => {
    setDownloading(type);
    try {
      let blob: Blob;
      if (type === 'contacts') {
        blob = await contactsService.exportCsv();
      } else if (type === 'deals') {
        blob = await api.get('/deals/export', { responseType: 'blob' }).then((r) => r.data as Blob);
      } else {
        blob = await api.get('/activities/export', { responseType: 'blob' }).then((r) => r.data as Blob);
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      const labels: Record<string, string> = { contacts: 'Contatos', deals: 'Negócios', activities: 'Atividades' };
      toast.success(`${labels[type]} exportados com sucesso`);
    } catch {
      toast.error('Erro ao exportar. Verifique se seu plano suporta exportação.');
    } finally {
      setDownloading(null);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const result = await contactsService.importCsv(file);
      toast.success(`${result.imported} contatos importados${result.skipped > 0 ? `, ${result.skipped} ignorados` : ''}`);
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} erros durante importação`);
      }
      qc.invalidateQueries({ queryKey: ['contacts'] });
    } catch {
      toast.error('Erro ao importar CSV. Verifique o formato do arquivo.');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Relatórios" subtitle="Desempenho do seu time" />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-bg-border">
        {tabs.map((tab) => {
          const isGated = GATED_TABS.includes(tab.id) && !hasStarterPlus;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (isGated) { showUpgrade('starter'); return; }
                setActiveTab(tab.id);
              }}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                activeTab === tab.id
                  ? 'border-accent-green text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary',
                isGated && 'opacity-60',
              )}
            >
              {tab.icon}
              {tab.label}
              {isGated && <Lock size={11} className="ml-0.5 text-text-muted" />}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {kpisLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <KpiCard label="Negócios em aberto" value={kpis?.openDeals ?? '—'} />
              <KpiCard
                label="Ganhos no mês"
                value={kpis ? kpis.wonMtd : '—'}
                sub={kpis && kpis.wonMtdValue > 0 ? formatCurrency(kpis.wonMtdValue) : undefined}
              />
              <KpiCard label="Valor ganho no mês" value={kpis ? formatCurrency(kpis.wonMtdValue) : '—'} />
              <KpiCard label="Taxa de conversão" value={kpis ? `${kpis.conversionRate}%` : '—'} />
              <KpiCard label="Ciclo médio (dias)" value={kpis?.avgCycleDays ?? '—'} />
            </div>
          )}

          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-text-secondary">Receita ao longo do tempo</p>
              <div className="flex gap-1">
                {periodOptions.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setPeriod(o.value)}
                    className={cn(
                      'px-3 py-1 rounded text-xs font-medium transition-colors',
                      period === o.value
                        ? 'bg-accent-green text-bg-darker'
                        : 'bg-bg-surface text-text-secondary border border-bg-border hover:text-text-primary',
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            {revenueLoading ? <div className="flex justify-center py-10"><Spinner /></div> : <RevenueChart data={revenue ?? []} period={period} />}
          </div>

          <div className="card p-4">
            <p className="text-sm font-medium text-text-secondary mb-3">Funil do pipeline</p>
            {funnelLoading ? <div className="flex justify-center py-10"><Spinner /></div> : <FunnelChart data={funnel ?? []} />}
          </div>

          {funnel && funnel.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-bg-border">
                <p className="text-sm font-medium text-text-primary">Detalhamento por etapa</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-bg-border text-text-muted text-xs uppercase tracking-wide">
                    <th className="text-left px-5 py-3 font-medium">Etapa</th>
                    <th className="text-right px-5 py-3 font-medium">Negócios</th>
                    <th className="text-right px-5 py-3 font-medium">Valor total</th>
                    <th className="text-right px-5 py-3 font-medium">Ticket médio</th>
                  </tr>
                </thead>
                <tbody>
                  {funnel.map((s) => (
                    <tr key={s.stage_id} className="border-b border-bg-border last:border-0 hover:bg-bg-surface/50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color || '#72d296' }} />
                          <span className="text-text-primary">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-text-secondary">{s.deal_count}</td>
                      <td className="px-5 py-3 text-right text-text-secondary">{formatCurrency(s.total_value)}</td>
                      <td className="px-5 py-3 text-right text-text-secondary">
                        {s.deal_count > 0 ? formatCurrency(s.total_value / s.deal_count) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Activities Tab */}
      {activeTab === 'activities' && (
        <div className="space-y-5">
          {activitiesLoading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* By type */}
                <div className="card overflow-hidden">
                  <div className="px-5 py-4 border-b border-bg-border">
                    <p className="text-sm font-medium text-text-primary">Por tipo de atividade</p>
                  </div>
                  {!activities?.byType.length ? (
                    <p className="px-5 py-8 text-sm text-text-muted text-center">Nenhuma atividade registrada</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-bg-border text-text-muted text-xs uppercase tracking-wide">
                          <th className="text-left px-5 py-3 font-medium">Tipo</th>
                          <th className="text-right px-5 py-3 font-medium">Total</th>
                          <th className="text-right px-5 py-3 font-medium">Concluídas</th>
                          <th className="text-right px-5 py-3 font-medium">Taxa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activities?.byType.map((r) => (
                          <tr key={r.type} className="border-b border-bg-border last:border-0 hover:bg-bg-surface/50">
                            <td className="px-5 py-3 text-text-primary capitalize">
                              {activityTypeLabel[r.type] ?? r.type}
                            </td>
                            <td className="px-5 py-3 text-right text-text-secondary">{r.total}</td>
                            <td className="px-5 py-3 text-right text-accent-green">{r.done}</td>
                            <td className="px-5 py-3 text-right text-text-muted">
                              {r.total > 0 ? `${Math.round((r.done / r.total) * 100)}%` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* By user */}
                <div className="card overflow-hidden">
                  <div className="px-5 py-4 border-b border-bg-border">
                    <p className="text-sm font-medium text-text-primary">Por responsável</p>
                  </div>
                  {!activities?.byUser.length ? (
                    <p className="px-5 py-8 text-sm text-text-muted text-center">Nenhuma atividade registrada</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-bg-border text-text-muted text-xs uppercase tracking-wide">
                          <th className="text-left px-5 py-3 font-medium">Usuário</th>
                          <th className="text-right px-5 py-3 font-medium">Total</th>
                          <th className="text-right px-5 py-3 font-medium">Concluídas</th>
                          <th className="text-right px-5 py-3 font-medium">Taxa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activities?.byUser.map((r) => (
                          <tr key={r.userId} className="border-b border-bg-border last:border-0 hover:bg-bg-surface/50">
                            <td className="px-5 py-3 text-text-primary">{r.name}</td>
                            <td className="px-5 py-3 text-right text-text-secondary">{r.total}</td>
                            <td className="px-5 py-3 text-right text-accent-green">{r.done}</td>
                            <td className="px-5 py-3 text-right text-text-muted">
                              {r.total > 0 ? `${Math.round((r.done / r.total) * 100)}%` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-5">
          {leaderboardLoading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : !leaderboard?.length ? (
            <div className="card p-12 flex flex-col items-center justify-center gap-2 text-center">
              <Trophy size={32} className="text-text-muted" />
              <p className="text-text-secondary text-sm">Nenhum negócio ganho ainda</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-bg-border">
                <p className="text-sm font-medium text-text-primary">Ranking de vendedores</p>
                <p className="text-xs text-text-muted mt-0.5">Baseado em negócios ganhos</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-bg-border text-text-muted text-xs uppercase tracking-wide">
                    <th className="text-left px-5 py-3 font-medium w-12">#</th>
                    <th className="text-left px-5 py-3 font-medium">Vendedor</th>
                    <th className="text-right px-5 py-3 font-medium">Negócios ganhos</th>
                    <th className="text-right px-5 py-3 font-medium">Valor total</th>
                    <th className="text-right px-5 py-3 font-medium hidden md:table-cell">Ticket médio</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry) => (
                    <tr key={entry.userId} className="border-b border-bg-border last:border-0 hover:bg-bg-surface/50">
                      <td className="px-5 py-3">
                        <span className={cn(
                          'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold',
                          entry.rank === 1 && 'bg-yellow-500/20 text-yellow-400',
                          entry.rank === 2 && 'bg-gray-400/20 text-gray-400',
                          entry.rank === 3 && 'bg-orange-500/20 text-orange-400',
                          entry.rank > 3 && 'text-text-muted',
                        )}>
                          {entry.rank}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-medium text-text-primary">{entry.name}</td>
                      <td className="px-5 py-3 text-right text-text-secondary">{entry.dealsWon}</td>
                      <td className="px-5 py-3 text-right text-accent-green font-medium">
                        {formatCurrencyFull(entry.totalValue)}
                      </td>
                      <td className="px-5 py-3 text-right text-text-muted hidden md:table-cell">
                        {entry.dealsWon > 0 ? formatCurrencyFull(entry.totalValue / entry.dealsWon) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="space-y-4 max-w-xl">
          <p className="text-sm text-text-secondary">
            Exporte seus dados como CSV para usar em outras ferramentas. Importação de contatos também disponível.
          </p>
          <p className="text-xs text-text-muted bg-bg-surface border border-bg-border rounded px-3 py-2">
            Exportação de atividades e negócios requer plano <strong>Starter</strong>. Exportação e importação de contatos requerem plano <strong>Pro</strong>.
          </p>

          <div className="space-y-3">
            {/* Activities export */}
            <div className="card p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-text-primary">Atividades</p>
                <p className="text-xs text-text-muted mt-0.5">Exporta todas as atividades com tipo, contato, negócio e responsável</p>
              </div>
              {hasStarterPlus ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleDownload('activities')}
                  disabled={downloading === 'activities'}
                >
                  <Download size={14} />
                  {downloading === 'activities' ? 'Exportando…' : 'Exportar CSV'}
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => showUpgrade('starter')}>
                  <Lock size={14} /> Starter+
                </Button>
              )}
            </div>

            {/* Contacts export */}
            <div className="card p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-text-primary">Contatos</p>
                <p className="text-xs text-text-muted mt-0.5">Exporta todos os contatos com nome, email, empresa e tipo</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleDownload('contacts')}
                disabled={downloading === 'contacts'}
              >
                <Download size={14} />
                {downloading === 'contacts' ? 'Exportando…' : 'Exportar CSV'}
              </Button>
            </div>

            {/* Deals export */}
            <div className="card p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-text-primary">Negócios</p>
                <p className="text-xs text-text-muted mt-0.5">Exporta todos os negócios com etapa, pipeline e responsável</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleDownload('deals')}
                disabled={downloading === 'deals'}
              >
                <Download size={14} />
                {downloading === 'deals' ? 'Exportando…' : 'Exportar CSV'}
              </Button>
            </div>

            {/* Contacts import */}
            <div className="card p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-text-primary">Importar contatos</p>
                <p className="text-xs text-text-muted mt-0.5">
                  CSV com colunas: <code className="text-accent-green">Name</code>, <code className="text-accent-green">Email</code>, Phone, Company, Job Title, Type, Source
                </p>
              </div>
              <div>
                <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
                <Button size="sm" variant="secondary" onClick={() => importRef.current?.click()}>
                  <Upload size={14} /> Importar CSV
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
