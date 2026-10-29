import { useEffect, useState } from 'react';
import { useStickyState } from '@/hooks/useStickyState';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, Trophy, XCircle, Undo2, Trash2, ClipboardList, CheckCircle2, Circle, Building2, CalendarDays, Headset, Phone, BellRing } from 'lucide-react';
import {
  useAssignments,
  useCaptadores,
  useCloseAssignment,
  useSetCommissionPaid,
} from '@/hooks/useCaptacao';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { contactsService } from '@/services/contacts.service';
import { useDebounce } from '@/hooks/useDebounce';
import type { Assignment, CallStatus } from '@/services/captacao.service';
import { CALL_STATUS, CALL_STATUS_ORDER, formatBRL, formatDay, LOST_REASON_LABEL, WHATSAPP_STATUS } from '@/lib/captacao';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { DataListSkeleton, listSpring } from '@/components/ui/DataList';
import { CloseLeadModal } from './CloseLeadModal';
import { WhatsAppIcon } from '@/components/ui/BrandIcons';
import { cn, shortName } from '@/lib/utils';

const GRID =
  'grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,1.3fr)] xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.5fr)_minmax(0,0.6fr)_minmax(0,1.3fr)]';

const shortDate = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Em que pé o captador deixou o lead: pendente, em aguardo, ganhou/perdeu (encerrado = admin já decidiu) */
function StatusChip({ a }: { a: Assignment }) {
  const s = a.outcome
    ? { label: 'Encerrado', className: 'bg-fg/[0.08] text-text-secondary', dot: 'bg-text-muted' }
    : a.concluded_at && a.lead_result === 'won'
      ? { label: 'Ganhou', className: 'bg-accent-green/15 text-accent-green', dot: 'bg-accent-green', at: a.concluded_at }
    : a.concluded_at && a.lead_result === 'lost'
      ? { label: a.lost_reason ? `Perdeu · ${LOST_REASON_LABEL[a.lost_reason]}` : 'Perdeu', className: 'bg-status-lost/15 text-status-lost', dot: 'bg-status-lost', at: a.concluded_at }
    : a.concluded_at
      ? { label: 'Concluído', className: 'bg-accent-green/15 text-accent-green', dot: 'bg-accent-green', at: a.concluded_at }
      : a.on_hold_at
        ? { label: 'Em aguardo', className: 'bg-accent-amber/15 text-accent-amber', dot: 'bg-accent-amber', at: a.on_hold_at }
        : { label: 'Pendente', className: 'border border-dashed border-fg/[0.2] text-text-muted', dot: 'bg-text-muted' };
  const at = 'at' in s ? s.at : undefined;
  return (
    <span
      className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', s.className)}
      title={at ? `${s.label} em ${shortDate(at)}` : undefined}
    >
      <span className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', s.dot)} />
      <span className="truncate">{s.label}</span>
    </span>
  );
}

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

  // Lead em aberto: Fechou / Não fechou num bloco só (remover do captador = botão direito no card)
  const iconBtn = 'flex h-10 w-11 items-center justify-center text-text-secondary transition-colors';
  return (
    <div className="flex justify-end">
      <div className="flex divide-x divide-fg/[0.08] overflow-hidden rounded-xl border border-fg/[0.1] bg-fg/[0.03]">
        <button type="button" onClick={onWon} title="Fechou negócio" className={cn(iconBtn, 'hover:bg-accent-green/10 hover:text-accent-green')}>
          <Trophy size={19} />
        </button>
        <button
          type="button"
          onClick={() => close.mutate({ id: a.id, outcome: 'lost' })}
          disabled={close.isPending}
          title="Não fechou"
          className={cn(iconBtn, 'hover:bg-status-lost/10 hover:text-status-lost')}
        >
          <XCircle size={19} />
        </button>
      </div>
    </div>
  );
}

/** Tudo que os captadores registraram: o admin decide aqui se fechou e quanto */
export function TrackingTab({ isAdmin, commissionRate, captadorId, onCaptadorChange }: Props) {
  const { data: captadores = [] } = useCaptadores();
  const [outcome, setOutcome] = useStickyState<OutcomeFilter>('captacao.tracking.outcome', 'open');
  const [status, setStatus] = useStickyState<CallStatus | ''>('captacao.tracking.status', '');
  const [search, setSearch] = useStickyState('captacao.tracking.search', '');
  const [page, setPage] = useStickyState('captacao.tracking.page', 1);
  const [closing, setClosing] = useState<Assignment | null>(null);
  const debouncedSearch = useDebounce(search, 300);
  const navigate = useNavigate();
  // Botão direito no card: menu com "Excluir lead" (apaga o contato e o vínculo com o captador)
  const qc = useQueryClient();
  const deleteLead = useMutation({
    mutationFn: (contactId: string) => contactsService.delete(contactId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['captacao'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Lead excluído');
    },
    onError: () => toast.error('Não foi possível excluir o lead'),
  });
  const [menu, setMenu] = useState<{ x: number; y: number; a: Assignment } | null>(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

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
                {shortName(c.full_name)}
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
        // Cards no padrão de Meus leads; clicar abre a página do lead
        <ul className="space-y-3">
          {rows.map((a, i) => (
            <motion.li
              key={a.id}
              layout
              initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { ...listSpring, delay: Math.min(i * 0.03, 0.3) } }}
              transition={listSpring}
              onClick={() => navigate(`/captacao/lead/${a.contact_id}`)}
              onContextMenu={(e) => {
                if (a.outcome) return;
                e.preventDefault();
                setMenu({ x: Math.min(e.clientX, window.innerWidth - 230), y: Math.min(e.clientY, window.innerHeight - 60), a });
              }}
              // Vidro leve do cabeçalho do calendário (sem backdrop-blur: dentro da pasta ele deixa o fundo sólido)
              className="group flex cursor-pointer flex-wrap items-center gap-4 overflow-hidden rounded-2xl border border-fg/[0.1] bg-fg/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-fg/[0.16] hover:bg-fg/[0.055] md:px-5"
            >
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-fg/[0.08] text-text-primary">
                <Building2 size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15.5px] font-semibold text-text-primary">{a.full_name}</p>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-text-muted">
                  {a.company_name && a.company_name !== a.full_name && (
                    <span className="flex min-w-0 max-w-full items-center gap-1">
                      <Building2 size={12} className="flex-shrink-0" />
                      <span className="truncate">{a.company_name}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1" title="Captador">
                    <Headset size={12} className="flex-shrink-0" />
                    {a.captador_name ? shortName(a.captador_name) : '(removido)'}
                  </span>
                  <span className="flex items-center gap-1" title="Recebido em">
                    <CalendarDays size={12} className="flex-shrink-0" />
                    {formatDay(a.assigned_for)}
                  </span>
                </div>
                {a.call_notes && (
                  <p className="mt-1.5 line-clamp-1 text-xs text-text-secondary" title={a.call_notes}>
                    {a.call_notes}
                  </p>
                )}
              </div>

              {/* Situação: só o status em destaque; ligação e mensagem numa linha discreta embaixo */}
              <div className="flex min-w-0 flex-shrink-0 flex-col items-start gap-1.5 max-md:w-full md:w-[200px]">
                <StatusChip a={a} />
                <div className="flex min-w-0 max-w-full items-center gap-3 text-xs text-text-muted">
                  <span className="flex min-w-0 items-center gap-1" title="Ligação">
                    <Phone size={12} className="flex-shrink-0" />
                    <span className="truncate">{a.call_status === 'pending' ? '—' : CALL_STATUS[a.call_status].label}</span>
                  </span>
                  {(a.whatsapp_at || a.whatsapp_status) && (
                    <span
                      className="flex min-w-0 items-center gap-1"
                      title={a.whatsapp_at ? `WhatsApp aberto ${a.whatsapp_count}x — último em ${shortDate(a.whatsapp_at)}` : 'Mensagem no WhatsApp'}
                    >
                      <WhatsAppIcon size={12} className="flex-shrink-0 text-[#25D366]/80" />
                      <span className="truncate">{a.whatsapp_status ? WHATSAPP_STATUS[a.whatsapp_status].label : 'Enviada'}</span>
                    </span>
                  )}
                  {a.attempts_count > 0 && <span title="Tentativas registradas">{a.attempts_count}x</span>}
                </div>
                {/* Retorno combinado (vermelho = atrasado) */}
                {a.next_contact_at && !a.concluded_at && !a.outcome && (
                  <span
                    className={cn(
                      'flex items-center gap-1 text-xs font-medium',
                      new Date(a.next_contact_at) < new Date() ? 'text-status-lost' : 'text-accent-amber',
                    )}
                    title="Retorno marcado pelo captador"
                  >
                    <BellRing size={12} />
                    Retorno {shortDate(a.next_contact_at)}
                  </span>
                )}
              </div>

              {/* Fechamento: os botões não abrem a página */}
              <div className="flex-shrink-0 max-sm:w-full" onClick={(e) => e.stopPropagation()}>
                <OutcomeCell a={a} isAdmin={isAdmin} onWon={() => setClosing(a)} />
              </div>
            </motion.li>
          ))}
        </ul>
      )}
      {menu &&
        createPortal(
          <div
            data-floating
            style={{ left: menu.x, top: menu.y }}
            className="glass-panel fixed z-[100] w-[220px] rounded-xl p-1.5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                const target = menu.a;
                setMenu(null);
                if (confirm(`Excluir o lead ${target.full_name}? Isso apaga o lead e não dá pra desfazer.`)) deleteLead.mutate(target.contact_id);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-status-lost transition-colors hover:bg-status-lost/10"
            >
              <Trash2 size={14} />
              Excluir lead
            </button>
          </div>,
          document.body,
        )}
      </div>

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm text-text-muted">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          Página {page} de {data.meta.totalPages}
          <Button variant="ghost" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>
            Próxima
          </Button>
        </div>
      )}

      <CloseLeadModal assignment={closing} commissionRate={commissionRate} onClose={() => setClosing(null)} />
    </div>
  );
}
