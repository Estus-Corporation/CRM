import type { ReactNode } from 'react';
import { ChevronRight, Lock, Sparkles, UserPlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { LeadRequestsPage } from '@/pages/lead-requests/LeadRequestsPage';
import { cn } from '@/lib/utils';

function Option({
  icon,
  title,
  text,
  badge,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  badge?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group flex w-full items-center gap-4 rounded-2xl border border-fg/[0.1] bg-fg/[0.03] p-4 text-left transition-colors',
        disabled ? 'cursor-not-allowed opacity-55' : 'hover:border-accent-green/45 hover:bg-accent-green/[0.05]',
      )}
    >
      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px] border border-accent-green/20 bg-gradient-to-br from-accent-green/[0.22] to-accent-green/[0.06] text-accent-green shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold text-text-primary">{title}</span>
          {badge && (
            <span className="rounded-full bg-accent-green/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-accent-green">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-text-secondary">{text}</span>
      </span>
      {disabled ? (
        <Lock size={16} className="flex-shrink-0 text-text-muted" />
      ) : (
        <ChevronRight size={18} className="flex-shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent-green" />
      )}
    </button>
  );
}

/**
 * "Adicionar lead" da Distribuir leads: pergunta como — à mão (formulário) ou automático (o Radar
 * busca empresas por nicho e cidade e elas entram na fila). Automático é só pra admin.
 */
export function AddLeadChooser({
  open,
  onClose,
  onManual,
  onAuto,
  canAuto,
}: {
  open: boolean;
  onClose: () => void;
  onManual: () => void;
  onAuto: () => void;
  canAuto: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Adicionar leads" description="Como você quer trazer os leads pra fila de distribuição?">
      <div className="space-y-3">
        <Option
          icon={<UserPlus size={22} strokeWidth={1.9} />}
          title="Manual"
          text="Cadastre um lead que você já tem: nome, telefone, empresa, nicho…"
          onClick={() => {
            onClose();
            onManual();
          }}
        />
        <Option
          icon={<Sparkles size={22} strokeWidth={1.9} />}
          title="Automático"
          badge="Radar · IA"
          text={
            canAuto
              ? 'Diga o nicho e a cidade: o Radar busca as empresas, pontua e entrega os leads na fila sozinho.'
              : 'Só administradores pedem buscas automáticas ao Radar.'
          }
          disabled={!canAuto}
          onClick={() => {
            onClose();
            onAuto();
          }}
        />
      </div>
    </Modal>
  );
}

/** Busca automática: o formulário do pedido ao Radar + os pedidos feitos (andamento e entregas) */
export function AutoLeadsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-w-3xl"
      title="Buscar leads automaticamente"
    >
      <div className="-mx-6 max-h-[min(70vh,680px)] overflow-y-auto px-6 pb-1">
        <LeadRequestsPage embedded />
      </div>
    </Modal>
  );
}
