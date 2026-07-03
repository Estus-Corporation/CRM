import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, X, Circle, Briefcase, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDeals } from '@/hooks/useDeals';
import { usePipelines } from '@/hooks/usePipeline';
import { Badge } from '@/components/ui/Badge';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import type { Deal } from '@/services/pipeline.service';

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'open', label: 'Em aberto' },
  { value: 'won', label: 'Ganhos' },
  { value: 'lost', label: 'Perdidos' },
];

const statusConfig: Record<string, { label: string; variant: 'green' | 'red' | 'default'; Icon: typeof Circle }> = {
  open:  { label: 'Em aberto', variant: 'default', Icon: Circle },
  won:   { label: 'Ganho',     variant: 'green',   Icon: Trophy },
  lost:  { label: 'Perdido',   variant: 'red',     Icon: X },
};

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);
}

export function DealsListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  function handleStatusChange(value: string) {
    setStatusFilter(value);
    setPage(1);
  }

  function handlePipelineChange(value: string) {
    setPipelineFilter(value);
    setPage(1);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  const { data, isLoading } = useDeals({
    status: (statusFilter as 'open' | 'won' | 'lost') || undefined,
    pipeline: pipelineFilter || undefined,
    q: search || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const { data: pipelines } = usePipelines();

  const deals: Deal[] = data?.data ?? [];
  const total: number = data?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <PageHeader title="Negócios" subtitle={`${total} no total`} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar negócio ou contato…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="input-base pl-8 py-1.5 text-xs w-56"
          />
        </div>

        {/* Status tabs */}
        <div className="flex gap-1">
          {STATUS_FILTERS.map((o) => (
            <button
              key={o.value}
              onClick={() => handleStatusChange(o.value)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                statusFilter === o.value
                  ? 'bg-accent-green text-bg-darker'
                  : 'bg-bg-surface text-text-secondary border border-bg-border hover:text-text-primary'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Pipeline filter */}
        {pipelines && pipelines.length > 1 && (
          <select
            value={pipelineFilter}
            onChange={(e) => handlePipelineChange(e.target.value)}
            className="input-base py-1.5 text-xs w-44"
          >
            <option value="">Todos os pipelines</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : deals.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="Nenhum negócio encontrado"
            description={search ? 'Tente outros termos de busca.' : 'Crie negócios no seu pipeline para acompanhar oportunidades de venda.'}
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bg-border text-text-muted text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">Negócio</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Contato</th>
                  <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Valor</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Responsável</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Previsão</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => {
                  const status = statusConfig[deal.status] ?? statusConfig.open;
                  const StatusIcon = status.Icon;
                  return (
                    <tr
                      key={deal.id}
                      className="border-b border-bg-border last:border-0 hover:bg-bg-surface/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/deals/${deal.id}`)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary">{deal.title}</p>
                      </td>
                      <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                        {deal.contact_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <span className="font-mono text-accent-green text-xs">
                          {formatCurrency(Number(deal.value))}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={status.variant}>
                          <span className="flex items-center gap-1">
                            <StatusIcon size={10} />
                            {status.label}
                          </span>
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs hidden lg:table-cell">
                        {deal.owner_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs hidden lg:table-cell">
                        {deal.expected_close
                          ? new Date(deal.expected_close).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination — inside the card so it's never behind floating buttons */}
            {totalPages > 1 && (
              <div className="flex items-center gap-3 px-4 py-3 border-t border-bg-border text-xs text-text-muted">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded border border-bg-border hover:bg-bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded border border-bg-border hover:bg-bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
                <span>Página {page} de {totalPages} — {total} negócios</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
