import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Phone, PhoneCall, CalendarCheck, Wallet, CheckCircle2, ChevronDown } from 'lucide-react';
import { useMyLeads, useMySummary } from '@/hooks/useCaptacao';
import type { CallStatus } from '@/services/captacao.service';
import { CALL_STATUS, CALL_STATUS_ORDER, formatBRL } from '@/lib/captacao';
import { LeadCard } from '@/components/captacao/LeadCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

type Scope = 'today' | 'open' | 'all';

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'open', label: 'Em aberto' },
  { value: 'all', label: 'Todos' },
];

function StatCard({ icon: Icon, label, value, hint }: { icon: typeof Phone; label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
        <Icon size={14} />
        {label}
      </div>
      <p className="mt-2 truncate text-2xl font-semibold tabular-nums text-text-primary sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

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
  // Reuniões: todos os leads com status "meeting" (o histórico completo é o filtro "Todos" de Meus leads)
  const effectiveScope = view === 'leads' ? scope : 'all';
  const effectiveStatus = view === 'meetings' ? 'meeting' : status || undefined;
  const { data: leads, isLoading } = useMyLeads(effectiveScope, effectiveStatus);
  const { data: summary } = useMySummary();
  const filtered = view === 'leads' ? scope !== 'today' || !!status : !!status;

  return (
    // mobile-sections: no celular 3 blocos separados — cabeçalho, resumo e a lista (ver globals.css)
    <div className="mobile-sections space-y-5 max-md:space-y-3">
      <PageHeader title={config.title} subtitle={config.subtitle} />

      {view === 'leads' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 max-sm:[&>*:last-child]:col-span-2">
          <StatCard
            icon={PhoneCall}
            label="Leads de hoje"
            value={String(summary?.today_total ?? 0)}
            hint={`${Math.max((summary?.today_total ?? 0) - (summary?.today_concluded ?? 0), 0)} a concluir`}
          />
          <StatCard icon={CalendarCheck} label="Reuniões" value={String(summary?.meetings ?? 0)} hint={wonHint(summary?.won)} />
          <StatCard
            icon={Wallet}
            label="Comissão a receber"
            value={formatBRL(summary?.commission_pending)}
            hint={`${formatBRL(summary?.commission_paid)} já recebido`}
          />
        </div>
      )}

      {/* Progresso, filtros e lista: um bloco só no celular */}
      <div className="space-y-5 max-md:space-y-3">
        {/* Progresso do dia: quantos leads de hoje já foram concluídos */}
        {view === 'leads' && (summary?.today_total ?? 0) > 0 && (
          <div className="card flex items-center gap-4 px-5 py-3.5">
            <CheckCircle2 size={18} className="flex-shrink-0 text-accent-green" />
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="font-medium text-text-primary">Progresso de hoje</span>
                <span className="tabular-nums text-text-secondary">
                  <strong className="text-text-primary">{summary!.today_concluded}</strong> de {summary!.today_total} concluídos
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-fg/[0.07]">
                <div
                  className="h-full rounded-full bg-accent-green transition-[width] duration-500"
                  style={{ width: `${Math.round((summary!.today_concluded / summary!.today_total) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {view !== 'meetings' && (
        <div className="flex flex-wrap items-center gap-3">
          {view === 'leads' && (
            <SegmentedControl
              layoutId="my-leads-scope"
              options={SCOPE_OPTIONS}
              value={scope}
              onChange={setScope}
              className="max-sm:w-full max-sm:[&>button]:flex-1"
            />
          )}
          {/* Celular: um botão só com todas as opções (seletor nativo do sistema) */}
          <label className="relative basis-full sm:hidden">
            <span className="sr-only">Filtrar por status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CallStatus | '')}
              className="input-base h-10 w-full appearance-none pr-9 text-sm"
            >
              {(['', ...CALL_STATUS_ORDER] as const).map((s) => (
                <option key={s || 'all'} value={s}>
                  {s ? CALL_STATUS[s].label : 'Todos os status'}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
          </label>
          <div className="hidden flex-wrap gap-1.5 sm:flex">
            {(['', ...CALL_STATUS_ORDER] as const).map((s) => (
              <button
                key={s || 'all'}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  'h-8 rounded-full px-3 text-xs font-medium transition-colors',
                  status === s ? 'bg-fg/[0.1] text-text-primary' : 'text-text-muted hover:text-text-primary',
                )}
              >
                {s ? CALL_STATUS[s].label : 'Todos os status'}
              </button>
            ))}
          </div>
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
