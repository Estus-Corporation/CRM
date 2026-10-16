import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trophy, X, Calendar, User } from 'lucide-react';
import type { Deal } from '@/services/pipeline.service';
import { cn } from '@/lib/utils';

interface KanbanCardProps {
  deal: Deal;
  onWon: (id: string, title: string) => void;
  onLost: (id: string, title: string) => void;
  onClick: (deal: Deal) => void;
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
}

function isOverdue(dateStr: string) {
  return new Date(dateStr) < new Date();
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

  const overdue = deal.expected_close && isOverdue(deal.expected_close);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'card card-interactive p-4 cursor-grab active:cursor-grabbing group',
        isDragging && 'opacity-40 ring-1 ring-accent-green',
      )}
      onClick={() => !isDragging && onClick(deal)}
    >
      {/* Title */}
      <p className="text-sm font-semibold text-text-primary leading-snug mb-3">{deal.title}</p>

      {/* Value */}
      <p className="text-base font-bold text-accent-green mb-1">
        {formatCurrency(Number(deal.value), deal.currency)}
      </p>

      {/* Contact name */}
      {deal.contact_name && (
        <p className="text-xs text-text-secondary mb-3">{deal.contact_name}</p>
      )}

      {/* Footer: owner + date */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-fg/[0.06]">
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <User size={11} className="flex-shrink-0" />
          <span className="truncate">{deal.owner_name ?? 'Desconhecido'}</span>
        </div>

        {deal.expected_close && (
          <div className={cn(
            'flex items-center gap-1 text-xs flex-shrink-0',
            overdue ? 'text-status-lost' : 'text-text-muted',
          )}>
            <Calendar size={11} className="flex-shrink-0" />
            <span>{new Date(deal.expected_close).toLocaleDateString('pt-BR')}</span>
          </div>
        )}
      </div>

      {/* Won / Lost actions — appear on hover */}
      <div
        className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onWon(deal.id, deal.title)}
          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-status-won/10 text-status-won hover:bg-status-won/20 transition-colors"
        >
          <Trophy size={10} /> Ganho
        </button>
        <button
          onClick={() => onLost(deal.id, deal.title)}
          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-status-lost/10 text-status-lost hover:bg-status-lost/20 transition-colors"
        >
          <X size={10} /> Perdido
        </button>
      </div>
    </div>
  );
}
