import { motion } from 'framer-motion';
import { HeadLabel } from '@/components/ui/HeadLabel';
import { CheckCircle2, Clock, HandCoins, Trophy, Wallet, Building2, CalendarDays, CircleDot } from 'lucide-react';
import { useMyLeads, useMySummary } from '@/hooks/useCaptacao';
import { formatBRL } from '@/lib/captacao';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { DataList, DataListBody, DataListHead, DataListRow, DataListSkeleton, listSpring } from '@/components/ui/DataList';

const GRID =
  'grid-cols-[minmax(0,1fr)_110px_100px] md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.9fr)]';

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

/** Captador: leads que fecharam negócio e a comissão de cada um (a receber / paga) */
export function MyCommissionsPage() {
  const { data: leads = [], isLoading } = useMyLeads('won');
  const { data: summary } = useMySummary();

  return (
    // mobile-sections: no celular 3 blocos separados — cabeçalho, resumo e a lista (ver globals.css)
    <div className="mobile-sections space-y-5 max-md:space-y-3">
      <PageHeader
        title="Minhas comissões"
        subtitle="Cada lead seu que fechou negócio gera comissão — aqui você acompanha o que já foi pago"
      />

      {/* Celular: 2 colunas, o último card ocupa a linha inteira — tudo visível, sem arrastar */}
      {/* Mesmo card de KPI do Dashboard (ícone no quadrado à esquerda) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 max-sm:[&>*:last-child]:col-span-2">
        <KpiCard icon={Wallet} highlight label="A receber" value={formatBRL(summary?.commission_pending)} />
        <KpiCard icon={HandCoins} label="Já recebido" value={formatBRL(summary?.commission_paid)} />
        <KpiCard icon={Trophy} label="Negócios fechados" value={summary?.won ?? 0} />
      </div>

      {/* div: no celular vira o bloco translúcido e a lista fica dentro */}
      <div>
        {isLoading ? (
          <DataListSkeleton grid={GRID} cells={3} rows={3} />
        ) : leads.length === 0 ? (
          <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={listSpring}>
            <EmptyState
              icon={Trophy}
              title="Nenhuma comissão ainda"
              description="Quando um lead que você captou fechar negócio, a comissão aparece aqui."
            />
          </motion.div>
        ) : (
          <DataList outlined={false}>
            <DataListHead grid={GRID}>
              <span><HeadLabel icon={Building2}>Lead</HeadLabel></span>
              <span className="hidden md:block"><HeadLabel icon={CalendarDays}>Fechado em</HeadLabel></span>
              <span><HeadLabel icon={Wallet}>Comissão</HeadLabel></span>
              <span><HeadLabel icon={CircleDot}>Status</HeadLabel></span>
            </DataListHead>
            <DataListBody>
              {leads.map((l, i) => (
                <DataListRow key={l.id} grid={GRID} index={i}>
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-medium text-text-primary">{l.full_name}</p>
                    {l.company_name && <p className="truncate text-xs text-text-muted">{l.company_name}</p>}
                  </div>
                  <span className="hidden text-sm tabular-nums text-text-secondary md:block">{formatDate(l.closed_at)}</span>
                  <span className="text-sm font-medium tabular-nums text-text-primary">{formatBRL(l.commission_value)}</span>
                  {l.commission_paid_at ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-accent-green">
                      <CheckCircle2 size={13} className="flex-shrink-0" />
                      <span className="truncate">Paga {formatDate(l.commission_paid_at)}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-accent-amber">
                      <Clock size={13} className="flex-shrink-0" />A receber
                    </span>
                  )}
                </DataListRow>
              ))}
            </DataListBody>
          </DataList>
        )}
      </div>
    </div>
  );
}
