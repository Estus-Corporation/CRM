import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, Trophy, User, UserRound, X } from 'lucide-react';
import type { Deal } from '@/services/pipeline.service';
import { cn } from '@/lib/utils';

interface KanbanCardProps {
  deal: Deal;
  onWon: (id: string, title: string) => void;
  onLost: (id: string, title: string) => void;
  onClick: (deal: Deal) => void;
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

/** Prazo do negócio: atrasado (vermelho), vence em até 3 dias (âmbar) ou normal */
function dueState(dateStr?: string) {
  if (!dateStr) return null;
  const due = new Date(dateStr);
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  const label = due.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  if (days < 0) return { label: `Atrasado · ${label}`, className: 'bg-status-lost/[0.12] text-status-lost' };
  if (days <= 3) return { label: days === 0 ? 'Vence hoje' : `Vence ${label}`, className: 'bg-accent-amber/[0.14] text-accent-amber' };
  return { label, className: 'bg-fg/[0.05] text-text-muted' };
}

/**
 * Aparência do card (sem drag): usada na lista e na cópia que segue o mouse (DragOverlay).
 * A cópia não pode chamar useSortable — por isso a visão é separada do wrapper arrastável.
 */
export function DealCardView({
  deal,
  overlay = false,
  onWon,
  onLost,
}: {
  deal: Deal;
  overlay?: boolean;
  onWon?: (id: string, title: string) => void;
  onLost?: (id: string, title: string) => void;
}) {
  const due = dueState(deal.expected_close);

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-fg/[0.07] bg-bg-surface p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.18)] transition-[border-color,box-shadow] duration-200',
        overlay
          ? 'rotate-[2deg] scale-[1.03] cursor-grabbing border-accent-green/40 shadow-[0_28px_56px_-16px_rgba(0,0,0,0.75)]'
          : 'hover:border-fg/[0.14] hover:shadow-[0_14px_28px_-14px_rgba(0,0,0,0.6)]',
      )}
    >

      <p className={cn('line-clamp-2 text-[14px] font-semibold leading-snug text-text-primary', !overlay && 'pr-14')}>
        {deal.title}
      </p>
      {deal.contact_name && (
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-text-secondary">
          <User size={11} className="flex-shrink-0 text-text-muted" />
          <span className="truncate">{deal.contact_name}</span>
        </p>
      )}

      <p className="mt-3 text-[17px] font-bold tabular-nums tracking-tight text-accent-green">
        {formatCurrency(Number(deal.value), deal.currency)}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-fg/[0.06] pt-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <UserRound size={14} strokeWidth={1.75} className="flex-shrink-0 text-text-muted" />
          <span className="truncate text-xs text-text-secondary">{deal.owner_name?.split(' ')[0] ?? 'Sem responsável'}</span>
        </div>
        {due && (
          <span className={cn('flex flex-shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium', due.className)}>
            <Calendar size={10} />
            {due.label}
          </span>
        )}
      </div>

      {/* Ganho / Perdido: ícones no canto, aparecem no hover (sempre visíveis no celular) */}
      {!overlay && onWon && onLost && (
        <div
          className="absolute right-2.5 top-2.5 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 max-md:opacity-100"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onWon(deal.id, deal.title)}
            title="Marcar como ganho"
            aria-label="Marcar como ganho"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-status-won/10 text-status-won transition-colors hover:bg-status-won/20"
          >
            <Trophy size={13} />
          </button>
          <button
            type="button"
            onClick={() => onLost(deal.id, deal.title)}
            title="Marcar como perdido"
            aria-label="Marcar como perdido"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-status-lost/10 text-status-lost transition-colors hover:bg-status-lost/20"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

export function KanbanCard({ deal, onWon, onLost, onClick }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    data: { type: 'deal', deal },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab touch-manipulation active:cursor-grabbing"
      onClick={() => !isDragging && onClick(deal)}
    >
      {/* Enquanto arrasta, o lugar do card vira um encaixe tracejado (a cópia segue o mouse) */}
      {isDragging ? (
        <div className="relative">
          <div className="invisible">
            <DealCardView deal={deal} />
          </div>
          <div className="absolute inset-0 rounded-xl border-2 border-dashed border-accent-green/40 bg-accent-green/[0.05]" />
        </div>
      ) : (
        <DealCardView deal={deal} onWon={onWon} onLost={onLost} />
      )}
    </div>
  );
}
