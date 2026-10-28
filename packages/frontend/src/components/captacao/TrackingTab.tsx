import { useState } from 'react';
import { HeadLabel } from '@/components/ui/HeadLabel';
import { motion } from 'framer-motion';
import { Search, Trophy, XCircle, Undo2, Trash2, ClipboardList, CheckCircle2, Circle, Building2, CalendarDays, Flag, Headset, PhoneCall } from 'lucide-react';
import {
  useAssignments,
  useCaptadores,
  useCloseAssignment,
  useSetCommissionPaid,
  useUnassign,
} from '@/hooks/useCaptacao';
import { useDebounce } from '@/hooks/useDebounce';
import type { Assignment, CallStatus } from '@/services/captacao.service';
import { CALL_STATUS, CALL_STATUS_ORDER, formatBRL, formatDay, WHATSAPP_STATUS } from '@/lib/captacao';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { DataList, DataListBody, DataListHead, DataListRow, DataListSkeleton, listSpring } from '@/components/ui/DataList';
import { CloseLeadModal } from './CloseLeadModal';
import { WhatsAppIcon } from '@/components/ui/BrandIcons';
import { cn } from '@/lib/utils';

const GRID =
  'grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1.3fr)] xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1.6fr)_minmax(0,0.6fr)_minmax(0,1.3fr)]';

type OutcomeFilter = 'open' | 'won' | 'lost' | '';

const OUTCOME_OPTIONS: { value: OutcomeFilter; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'open', label: 'Aguardando decisão' },
  { value: 'won', label: 'Fechados' },
  { value: 'lost', label: 'Não fecharam' },
];

const PAGE_SIZE = 30;

interface Props {
  isAdmin: boolean;
  commissionRate: number;
  captadorId: string;
  onCaptadorChange: (id: string) => void;
}

function OutcomeCell({ a, isAdmin, onWon }: { a: Assignment; isAdmin: boolean; onWon: () => void }) {
  const close = useCloseAssignment();
  const setPaid = useSetCommissionPaid();
  const unassign = useUnassign();

  if (a.outcome === 'won') {
    const paid = !!a.commission_paid_at;
    return (
      <div className="flex min-w-0 items-center justify-end gap-2">
        <div className="min-w-0 text-right">
          <p className="truncate text-sm font-medium tabular-nums text-text-primary">{formatBRL(a.deal_value)}</p>
          <p className="truncate text-xs tabular-nums text-text-muted">comissão {formatBRL(a.commission_value)}</p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => setPaid.mutate({ id: a.id, paid: !paid })}
            disabled={setPaid.isPending}
            title={paid ? 'Comissão paga — clique para desfazer' : 'Marcar comissão como paga'}
            className={cn(
              'flex h-8 flex-shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors',
              paid ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-amber/15 text-accent-amber hover:bg-accent-amber/25',
            )}
          >
            {paid ? <CheckCircle2 size={13} /> : <Circle size={13} />}
            {paid ? 'Paga' : 'A pagar'}
          </button>
        ) : (
          <span className={cn('text-xs font-medium', paid ? 'text-accent-green' : 'text-accent-amber')}>
            {paid ? 'Paga' : 'A pagar'}
          </span>
        )}
        {!paid && (
          <button
            type="button"
            onClick={() => close.mutate({ id: a.id, outcome: null })}
            title="Reabrir (desfaz o fechamento)"
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-fg/[0.06] hover:text-text-primary"
          >
            <Undo2 size={14} />
          </button>
        )}
      </div>
    );
  }

  if (a.outcome === 'lost') {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="text-sm text-text-muted">Não fechou</span>
        <button
          type="button"
          onClick={() => close.mutate({ id: a.id, outcome: null })}
          title="Reabrir"
          className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-fg/[0.06] hover:text-text-primary"
        >
          <Undo2 size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button size="sm" onClick={onWon} title="Fechou negócio com este lead">
        <Trophy size={13} />
        Fechou
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => close.mutate({ id: a.id, outcome: 'lost' })}
        disabled={close.isPending}
        title="Não fechou"
      >
        <XCircle size={13} />
        <span className="hidden 2xl:inline">Não fechou</span>
      </Button>
      <button
        type="button"
        onClick={() => {
          if (confirm(`Devolver ${a.full_name} para a fila de leads livres?`)) unassign.mutate(a.id);
        }}
        title="Remover do captador (volta para a fila)"
        className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-status-lost/10 hover:text-status-lost"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

/** Tudo que os captadores registraram: o admin decide aqui se fechou e quanto */
export function TrackingTab({ isAdmin, commissionRate, captadorId, onCaptadorChange }: Props) {
  const { data: captadores = [] } = useCaptadores();
  const [outcome, setOutcome] = useState<OutcomeFilter>('open');
  const [status, setStatus] = useState<CallStatus | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [closing, setClosing] = useState<Assignment | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useAssignments({
    captadorId: captadorId || undefined,
    outcome: outcome || undefined,
    status: status || undefined,
    search: debouncedSearch || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const rows = data?.data ?? [];
  const resetPage = () => setPage(1);

  return (
    // mobile-split: no celular cada parte vira um bloco translúcido separado (ver globals.css)
    <div className="mobile-split space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          layoutId="tracking-outcome"
          options={OUTCOME_OPTIONS}
          value={outcome}
          onChange={(v) => {
            setOutcome(v);
            resetPage();
          }}
        />
        <div className="relative max-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            className="input-base h-10 pl-9"
            placeholder="Buscar lead…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
          />
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <select
            value={captadorId}
            onChange={(e) => {
              onCaptadorChange(e.target.value);
              resetPage();
            }}
            className="input-base h-10 w-44"
          >
            <option value="">Todos os captadores</option>
            {captadores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as CallStatus | '');
              resetPage();
            }}
            className="input-base h-10 w-44"
          >
            <option value="">Todos os resultados</option>
            {CALL_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {CALL_STATUS[s].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
      {isLoading ? (
        <DataListSkeleton grid={GRID} cells={4} />
      ) : rows.length === 0 ? (
        <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={listSpring}>
          <EmptyState
            icon={ClipboardList}
            title="Nada por aqui"
            description={
              outcome === 'open'
                ? 'Nenhum lead aguardando decisão. Distribua leads na aba Distribuir.'
                : 'Nenhum lead com esses filtros.'
            }
          />
        </motion.div>
      ) : (
        <DataList outlined={false}>
          <DataListHead grid={GRID}>
            <span><HeadLabel icon={Building2}>Lead</HeadLabel></span>
            <span className="hidden md:block"><HeadLabel icon={Headset}>Captador</HeadLabel></span>
            <span className="hidden md:block"><HeadLabel icon={PhoneCall}>Resultado da ligação</HeadLabel></span>
            <span className="hidden xl:block"><HeadLabel icon={CalendarDays}>Recebido</HeadLabel></span>
            <span className="text-right"><HeadLabel icon={Flag}>Fechamento</HeadLabel></span>
          </DataListHead>
          <DataListBody>
            {rows.map((a, i) => (
              <DataListRow key={a.id} grid={GRID} index={i}>
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-medium text-text-primary">{a.full_name}</p>
                  <p className="truncate text-xs text-text-muted">
                    {[a.phone, a.company_name].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <span className="hidden truncate text-sm text-text-secondary md:block">{a.captador_name ?? '(removido)'}</span>
                <div className="hidden min-w-0 md:block">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                      CALL_STATUS[a.call_status].className,
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', CALL_STATUS[a.call_status].dot)} />
                    {CALL_STATUS[a.call_status].label}
                  </span>
                  {/* Plano B: o captador partiu pra mensagem no WhatsApp */}
                  {(a.whatsapp_at || a.whatsapp_status) && (
                    <span
                      className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-[#25D366]/10 px-2 py-0.5 text-[11px] font-medium text-[#25D366]"
                      title={
                        a.whatsapp_at
                          ? `WhatsApp aberto ${a.whatsapp_count}x — último em ${new Date(a.whatsapp_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                          : 'Mensagem no WhatsApp'
                      }
                    >
                      <WhatsAppIcon size={11} />
                      {a.whatsapp_status ? WHATSAPP_STATUS[a.whatsapp_status].label : 'WhatsApp'}
                      {a.whatsapp_at &&
                        ` · ${new Date(a.whatsapp_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                      {a.whatsapp_count > 1 && ` · ${a.whatsapp_count}x`}
                    </span>
                  )}
                  {a.call_notes && (
                    <p className="mt-1 line-clamp-2 text-xs text-text-muted" title={a.call_notes}>
                      {a.call_notes}
                    </p>
                  )}
                </div>
                <span className="hidden text-sm tabular-nums text-text-muted xl:block">{formatDay(a.assigned_for)}</span>
                <OutcomeCell a={a} isAdmin={isAdmin} onWon={() => setClosing(a)} />
              </DataListRow>
            ))}
          </DataListBody>
        </DataList>
      )}
      </div>

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm text-text-muted">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          Página {page} de {data.meta.totalPages}
          <Button variant="ghost" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </Button>
        </div>
      )}

      <CloseLeadModal assignment={closing} commissionRate={commissionRate} onClose={() => setClosing(null)} />
    </div>
  );
}
