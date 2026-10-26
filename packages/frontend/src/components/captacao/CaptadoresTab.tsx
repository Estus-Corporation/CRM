import { motion } from 'framer-motion';
import { HandCoins, ListChecks, Users } from 'lucide-react';
import { useCaptadores, usePayAllCommissions } from '@/hooks/useCaptacao';
import { formatBRL } from '@/lib/captacao';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { DataList, DataListBody, DataListHead, DataListRow, DataListSkeleton, listSpring } from '@/components/ui/DataList';

const GRID =
  'grid-cols-[minmax(0,1fr)_120px] md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.6fr))_minmax(0,1fr)_150px] lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,0.6fr))_minmax(0,1fr)_minmax(0,1fr)_150px]';

interface Props {
  isAdmin: boolean;
  onNewCaptador: () => void;
  onViewLeads: (captadorId: string) => void;
}

/** Visão por captador: produção do dia, reuniões, fechamentos e comissões a pagar */
export function CaptadoresTab({ isAdmin, onNewCaptador, onViewLeads }: Props) {
  const { data: captadores = [], isLoading } = useCaptadores();
  const payAll = usePayAllCommissions();

  const totals = captadores.reduce(
    (acc, c) => ({
      meetings: acc.meetings + c.meetings,
      won: acc.won + c.won,
      wonValue: acc.wonValue + c.won_value,
      pending: acc.pending + c.commission_pending,
      paid: acc.paid + c.commission_paid,
    }),
    { meetings: 0, won: 0, wonValue: 0, pending: 0, paid: 0 },
  );

  if (isLoading) return <DataListSkeleton grid={GRID} cells={4} rows={3} />;

  if (captadores.length === 0) {
    return (
      <div>
      <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={listSpring}>
        <EmptyState
          icon={Users}
          title="Nenhum captador ainda"
          description="Convide quem vai ligar para os leads pelo e-mail. A pessoa aceita o convite na caixa de entrada, e cada captador só enxerga os leads que você atribuir a ele."
          action={isAdmin ? { label: 'Adicionar captador', onClick: onNewCaptador } : undefined}
        />
      </motion.div>
      </div>
    );
  }

  return (
    // mobile-split: no celular cada parte vira um bloco translúcido separado (ver globals.css)
    <div className="mobile-split space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-medium text-text-secondary">Reuniões marcadas</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-text-primary">{totals.meetings}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-text-secondary">Negócios fechados</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-text-primary">{totals.won}</p>
          <p className="mt-1 text-xs text-text-muted">{formatBRL(totals.wonValue)} em vendas</p>
        </div>
        <div className="card kpi-highlight p-4">
          <p className="text-xs font-medium text-text-secondary">Comissões a pagar</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-accent-amber">{formatBRL(totals.pending)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-text-secondary">Comissões pagas</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-text-primary">{formatBRL(totals.paid)}</p>
        </div>
      </div>

      <div>
      <DataList outlined={false}>
        <DataListHead grid={GRID}>
          <span>Captador</span>
          <span className="hidden md:block">Hoje</span>
          <span className="hidden lg:block">A ligar</span>
          <span className="hidden md:block">Reuniões</span>
          <span className="hidden md:block">Fechados</span>
          <span className="hidden md:block">A pagar</span>
          <span className="hidden lg:block">Pago</span>
          <span />
        </DataListHead>
        <DataListBody>
          {captadores.map((c, i) => (
            <DataListRow key={c.id} grid={GRID} index={i}>
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={c.full_name} src={c.avatar_url} className="h-9 w-9 flex-shrink-0 text-[13px]" />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-[14.5px] font-medium text-text-primary">
                    {c.full_name}
                    {!c.is_active && <span className="text-[11px] font-normal text-text-muted">(inativo)</span>}
                  </p>
                  <p className="truncate text-xs text-text-muted">{c.email}</p>
                </div>
              </div>
              <span className="hidden text-sm tabular-nums text-text-secondary md:block">{c.today}</span>
              <span className="hidden text-sm tabular-nums text-text-secondary lg:block">{c.pending}</span>
              <span className="hidden text-sm tabular-nums text-accent-green md:block">{c.meetings}</span>
              <span className="hidden text-sm tabular-nums text-text-secondary md:block">
                {c.won}
                {c.won > 0 && <span className="block text-xs text-text-muted">{formatBRL(c.won_value)}</span>}
              </span>
              <span className="hidden text-sm font-medium tabular-nums text-accent-amber md:block">
                {formatBRL(c.commission_pending)}
              </span>
              <span className="hidden text-sm tabular-nums text-text-secondary lg:block">{formatBRL(c.commission_paid)}</span>
              <div className="flex justify-end gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => onViewLeads(c.id)} title="Ver leads deste captador">
                  <ListChecks size={14} />
                  <span className="hidden xl:inline">Leads</span>
                </Button>
                {isAdmin && c.commission_pending > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={payAll.isPending}
                    onClick={() => {
                      if (confirm(`Marcar ${formatBRL(c.commission_pending)} como pago para ${c.full_name}?`)) {
                        payAll.mutate(c.id);
                      }
                    }}
                    title="Marcar todas as comissões em aberto como pagas"
                  >
                    <HandCoins size={14} />
                    Pagar
                  </Button>
                )}
              </div>
            </DataListRow>
          ))}
        </DataListBody>
      </DataList>
      </div>
    </div>
  );
}
