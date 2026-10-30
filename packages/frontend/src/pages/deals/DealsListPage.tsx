import { useState } from 'react';
import { HeadLabel } from '@/components/ui/HeadLabel';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, X, Circle, Briefcase, Search, ChevronLeft, ChevronRight, CalendarClock, CircleDot, User, UserCheck, Wallet } from 'lucide-react';
import { useDeals } from '@/hooks/useDeals';
import { usePipelines } from '@/hooks/usePipeline';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { DataList, DataListBody, DataListHead, DataListRow, DataListSkeleton, listSpring } from '@/components/ui/DataList';
import type { Deal } from '@/services/pipeline.service';

const PAGE_SIZE = 20;

type StatusFilter = '' | 'open' | 'won' | 'lost';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'open', label: 'Em aberto' },
  { value: 'won', label: 'Ganhos' },
  { value: 'lost', label: 'Perdidos' },
];

const statusConfig: Record<string, { label: string; variant: 'green' | 'red' | 'blue'; Icon: typeof Circle }> = {
  open: { label: 'Em aberto', variant: 'blue', Icon: Circle },
  won: { label: 'Ganho', variant: 'green', Icon: Trophy },
  lost: { label: 'Perdido', variant: 'red', Icon: X },
};

// Grade compartilhada entre cabeçalho e linhas. Pesos proporcionais ao conteúdo típico de cada
// coluna (título longo, nomes médios, valor/status curtos), pra sobra de espaço ficar parecida entre todas.
const GRID =
  'grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,0.9fr)]';

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);
}

export function DealsListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [pipelineFilter, setPipelineFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useDeals({
    status: statusFilter || undefined,
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

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar negócio ou contato…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input-base h-10 pl-9"
          />
        </div>

        <SegmentedControl
          layoutId="deals-status-pill"
          options={STATUS_FILTERS}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        />

        {pipelines && pipelines.length > 1 && (
          <select
            value={pipelineFilter}
            onChange={(e) => {
              setPipelineFilter(e.target.value);
              setPage(1);
            }}
            className="input-base ml-auto h-10 w-52"
          >
            <option value="">Todos os pipelines</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <DataListSkeleton grid={GRID} cells={2} />
      ) : deals.length === 0 ? (
        <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={listSpring}>
          <EmptyState
            icon={Briefcase}
            title="Nenhum negócio encontrado"
            description={search ? 'Tente outros termos de busca.' : 'Crie negócios no seu pipeline para acompanhar oportunidades de venda.'}
          />
        </motion.div>
      ) : (
        <DataList>
          <DataListHead grid={GRID}>
            <span><HeadLabel icon={Briefcase}>Negócio</HeadLabel></span>
            <span className="hidden md:block"><HeadLabel icon={User}>Contato</HeadLabel></span>
            {/* Alinhado à esquerda como as outras colunas — à direita ele encostava na coluna Status */}
            <span className="hidden sm:block"><HeadLabel icon={Wallet}>Valor</HeadLabel></span>
            <span><HeadLabel icon={CircleDot}>Status</HeadLabel></span>
            <span className="hidden lg:block"><HeadLabel icon={UserCheck}>Responsável</HeadLabel></span>
            <span className="hidden lg:block"><HeadLabel icon={CalendarClock}>Previsão</HeadLabel></span>
          </DataListHead>

          <DataListBody>
            {deals.map((deal, i) => {
              const status = statusConfig[deal.status] ?? statusConfig.open;
              const StatusIcon = status.Icon;
              return (
                <DataListRow key={deal.id} grid={GRID} index={i} onClick={() => navigate(`/deals/${deal.id}`)}>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent-green/10 text-accent-green">
                      <Briefcase size={15} strokeWidth={1.9} />
                    </div>
                    <p className="truncate text-[14.5px] font-medium text-text-primary">{deal.title}</p>
                  </div>
                  <span className="hidden truncate text-sm text-text-secondary md:block">{deal.contact_name ?? '—'}</span>
                  <span className="hidden text-sm font-semibold tabular-nums text-accent-green sm:block">
                    {formatCurrency(Number(deal.value))}
                  </span>
                  <span>
                    <Badge variant={status.variant}>
                      <span className="flex items-center gap-1">
                        <StatusIcon size={10} />
                        {status.label}
                      </span>
                    </Badge>
                  </span>
                  <span className="hidden truncate text-sm text-text-secondary lg:block">{deal.owner_name ?? '—'}</span>
                  <span className="hidden text-sm tabular-nums text-text-muted lg:block">
                    {deal.expected_close ? new Date(deal.expected_close).toLocaleDateString('pt-BR') : '—'}
                  </span>
                </DataListRow>
              );
            })}
          </DataListBody>

          {/* Paginação dentro do card, nunca atrás de botões flutuantes */}
          {totalPages > 1 && (
            <motion.div
              layout="position"
              className="flex items-center gap-3 border-t-[1.5px] border-fg/[0.14] px-4 py-3 text-[13px] text-text-muted"
            >
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-fg/[0.1] bg-fg/[0.04] backdrop-blur-md p-1.5 transition-colors hover:border-fg/[0.2] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Página anterior"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-fg/[0.1] bg-fg/[0.04] backdrop-blur-md p-1.5 transition-colors hover:border-fg/[0.2] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Próxima página"
              >
                <ChevronRight size={15} />
              </button>
              <span>
                Página {page} de {totalPages} — {total} negócios
              </span>
            </motion.div>
          )}
        </DataList>
      )}
    </div>
  );
}
