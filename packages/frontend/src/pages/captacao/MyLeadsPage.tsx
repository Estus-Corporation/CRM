import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { PhoneCall, CalendarCheck, Wallet, CheckCircle2, Plus } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { AddLeadModal } from '@/components/captacao/AddLeadModal';
import { Button } from '@/components/ui/Button';
import { SelectDropdown } from '@/components/ui/SelectDropdown';
import { useMyLeads, useMySummary } from '@/hooks/useCaptacao';
import type { CallStatus } from '@/services/captacao.service';
import { CALL_STATUS, CALL_STATUS_ORDER, formatBRL } from '@/lib/captacao';
import { LeadCard } from '@/components/captacao/LeadCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

type Scope = 'today' | 'open' | 'all';

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'open', label: 'Em aberto' },
  { value: 'all', label: 'Todos' },
];

const STATUS_OPTIONS: { value: CallStatus | ''; label: string }[] = [
  { value: '', label: 'Todos os status' },
  ...CALL_STATUS_ORDER.map((st) => ({ value: st, label: CALL_STATUS[st].label })),
];

type View = 'leads' | 'meetings';

/** Cada item do menu do captador é uma visão desta mesma lista */
const VIEWS: Record<View, { title: string; subtitle: string; emptyTitle: string; emptyText: string }> = {
  leads: {
    title: 'Meus leads',
    subtitle: 'Ligue para cada lead e registre o resultado — as anotações salvam sozinhas',
    emptyTitle: 'Nenhum lead para hoje',
    emptyText: 'Quando o administrador distribuir seus leads do dia, eles aparecem aqui.',
  },
  meetings: {
    title: 'Reuniões marcadas',
    subtitle: 'Leads em que você marcou reunião, com dia, horário e formato',
    emptyTitle: 'Nenhuma reunião marcada ainda',
    emptyText: 'Quando você marcar "Reunião marcada" num lead, ele aparece aqui.',
  },
};

function wonHint(won = 0) {
  if (won === 0) return 'Nenhum fechou negócio ainda';
  return won === 1 ? '1 fechou negócio' : `${won} fecharam negócio`;
}

export function MyLeadsPage({ view = 'leads' }: { view?: View }) {
  const config = VIEWS[view];
  const [scope, setScope] = useState<Scope>('today');
  const [status, setStatus] = useState<CallStatus | ''>('');
  const [addOpen, setAddOpen] = useState(false);
  // Reuniões: todos os leads com status "meeting" (o histórico completo é o filtro "Todos" de Meus leads)
  const effectiveScope = view === 'leads' ? scope : 'all';
  const effectiveStatus = view === 'meetings' ? 'meeting' : status || undefined;
  const { data: leads, isLoading } = useMyLeads(effectiveScope, effectiveStatus);
  const { data: summary } = useMySummary();
  const filtered = view === 'leads' ? scope !== 'today' || !!status : !!status;

  return (
    // mobile-sections: no celular 3 blocos separados — cabeçalho, resumo e a lista (ver globals.css)
    <div className="mobile-sections space-y-5 max-md:space-y-3">
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        actions={
          view === 'leads' && (
            // O captador também cadastra os leads que encontra por conta própria
            <Button size="lg" onClick={() => setAddOpen(true)} className="px-6 text-[15px] max-sm:w-full">
              <Plus size={18} strokeWidth={2.25} />
              Adicionar lead
            </Button>
          )
        }
      />
      <AddLeadModal open={addOpen} onClose={() => setAddOpen(false)} self />

      {view === 'leads' && (
        // Mesmo card de KPI do Dashboard (ícone no quadrado verde, hover com elevação)
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 max-sm:[&>*:last-child]:col-span-2">
          <KpiCard
            icon={PhoneCall}
            highlight
            label="Leads de hoje"
            value={summary?.today_total ?? 0}
            sub={`${Math.max((summary?.today_total ?? 0) - (summary?.today_concluded ?? 0), 0)} a concluir`}
          />
          <KpiCard icon={CalendarCheck} label="Reuniões" value={summary?.meetings ?? 0} sub={wonHint(summary?.won)} />
          <KpiCard
            icon={Wallet}
            label="Comissão a receber"
            value={formatBRL(summary?.commission_pending)}
            sub={`${formatBRL(summary?.commission_paid)} já recebido`}
          />
        </div>
      )}

      {/* Progresso, filtros e lista: um bloco só no celular */}
      <div className="space-y-5 max-md:space-y-3">
        {/* Progresso do dia: vidro translúcido (igual aos cards do Pipeline) — texto + 0/3, barra, check na ponta */}
        {view === 'leads' && (summary?.today_total ?? 0) > 0 && (
          <div className="flex items-center gap-4 rounded-xl border border-fg/[0.12] bg-fg/[0.05] px-5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_14px_-8px_rgba(0,0,0,0.35)] max-sm:gap-3">
            <p className="flex-shrink-0 text-sm">
              <span className="font-medium text-text-primary">Progresso de hoje</span>
              {/* Selo em volta do contador pra separar do texto */}
              <span className="ml-2.5 rounded-md border border-fg/[0.1] bg-fg/[0.05] px-2 py-0.5 text-[13px] tabular-nums text-text-secondary">
                {summary!.today_concluded}/{summary!.today_total}
              </span>
            </p>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-fg/[0.07]">
              <div
                className="h-full rounded-full bg-accent-green transition-[width] duration-500"
                style={{ width: `${Math.round((summary!.today_concluded / summary!.today_total) * 100)}%` }}
              />
            </div>
            <CheckCircle2 size={18} className="flex-shrink-0 text-accent-green" />
          </div>
        )}

        {/* Dois botões: período (só em Meus leads) e status da ligação */}
        {view !== 'meetings' && (
        <div className="flex flex-wrap items-center gap-2">
          {view === 'leads' && (
            <SelectDropdown title="Período" options={SCOPE_OPTIONS} value={scope} onChange={setScope} className="w-40 max-sm:flex-1" />
          )}
          <SelectDropdown title="Status" options={STATUS_OPTIONS} value={status} onChange={setStatus} className="w-52 max-sm:flex-1" />
        </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-2xl" />
            ))}
          </div>
        ) : !leads?.length ? (
          <div className="card">
            <EmptyState
              icon={view === 'meetings' ? CalendarCheck : PhoneCall}
              title={filtered ? 'Nenhum lead aqui' : config.emptyTitle}
              description={filtered ? 'Tente outro filtro.' : config.emptyText}
            />
          </div>
        ) : (
          <ul className="space-y-3">
            <AnimatePresence mode="popLayout" initial>
              {leads.map((lead, i) => (
                <LeadCard key={lead.id} lead={lead} index={i} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
