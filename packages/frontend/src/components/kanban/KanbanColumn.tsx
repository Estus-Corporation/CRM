import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Loader2, Plus } from 'lucide-react';
import type { StageMeta, Deal } from '@/services/pipeline.service';
import { useInfiniteStageDeals } from '@/hooks/usePipeline';
import { KanbanCard } from './KanbanCard';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  stage: StageMeta;
  // Optimistic deals injected during drag (replaces server data while dragging)
  optimisticDeals?: Deal[];
  onAddDeal: (stageId: string) => void;
  onWon: (id: string, title: string) => void;
  onLost: (id: string, title: string) => void;
  onDealClick: (deal: Deal) => void;
  /** Um card está sendo arrastado por cima desta coluna */
  isDropTarget?: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

/** Cabeçalho da coluna — também usado na cópia que segue o mouse ao reordenar etapas */
export function StageHeader({ stage, dragHandle }: { stage: StageMeta; dragHandle?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-fg/[0.06] bg-bg-surface px-3.5 pb-3 pt-3.5">
      <div className="flex items-center gap-2">
        {dragHandle}
        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: stage.color, boxShadow: `0 0 0 3px ${stage.color}26` }} />
        <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-text-primary">{stage.name}</p>
        <span className="flex-shrink-0 rounded-full bg-fg/[0.07] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-text-secondary">
          {stage.dealCount}
        </span>
      </div>
      <p className="mt-1 pl-[18px] text-xs tabular-nums text-text-muted">{formatCurrency(stage.totalValue)}</p>
      <div className="mt-2.5 h-[2px] rounded-full" style={{ background: `linear-gradient(90deg, ${stage.color}, ${stage.color}00)` }} />
    </div>
  );
}

export function KanbanColumn({
  stage,
  optimisticDeals,
  onAddDeal,
  onWon,
  onLost,
  onDealClick,
  isDropTarget,
}: KanbanColumnProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
    data: { type: 'column' },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDropTarget ? { boxShadow: `inset 0 0 0 1.5px ${stage.color}80`, background: `${stage.color}0d` } : {}),
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteStageDeals(stage.id);

  // Flatten all loaded pages into a single array
  const serverDeals = data?.pages.flatMap((p) => p.deals) ?? [];
  // During drag we show optimistic state; otherwise show server data
  const deals = optimisticDeals ?? serverDeals;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        // Bloco transparente com cards sólidos dentro e respiro interno
        'group/col flex w-72 flex-shrink-0 flex-col gap-2.5 rounded-[24px] border border-fg/[0.05] bg-fg/[0.025] p-2.5 transition-[background-color,box-shadow] duration-200',
        isDragging && 'opacity-40',
      )}
    >
      <StageHeader
        stage={stage}
        dragHandle={
          <button
            {...attributes}
            {...listeners}
            className="-ml-1 flex-shrink-0 cursor-grab touch-none text-text-muted opacity-0 transition-opacity hover:text-text-primary active:cursor-grabbing group-hover/col:opacity-100 max-md:hidden"
            tabIndex={-1}
            aria-label="Arrastar etapa"
          >
            <GripVertical size={14} />
          </button>
        }
      />

      <div className="flex min-h-24 flex-1 flex-col gap-2.5">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={16} className="animate-spin text-text-muted" />
          </div>
        ) : (
          <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            {deals.map((deal) => (
              <KanbanCard
                key={deal.id}
                deal={deal}
                onWon={onWon}
                onLost={onLost}
                onClick={onDealClick}
              />
            ))}
          </SortableContext>
        )}

        {hasNextPage && !optimisticDeals && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs text-text-muted transition-colors hover:bg-fg/[0.04] hover:text-text-primary disabled:opacity-50"
          >
            {isFetchingNextPage && <Loader2 size={12} className="animate-spin" />}
            {isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
          </button>
        )}

        <button
          onClick={() => onAddDeal(stage.id)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-fg/[0.1] px-2 py-2.5 text-xs font-medium text-text-muted transition-colors hover:border-fg/[0.2] hover:bg-fg/[0.03] hover:text-text-primary"
        >
          <Plus size={13} /> Novo negócio
        </button>
      </div>
    </div>
  );
}
