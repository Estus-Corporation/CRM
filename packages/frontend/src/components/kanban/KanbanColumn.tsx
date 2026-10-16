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
  isCardDragActive?: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function KanbanColumn({
  stage,
  optimisticDeals,
  onAddDeal,
  onWon,
  onLost,
  onDealClick,
  isCardDragActive,
}: KanbanColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: stage.id,
    data: { type: 'column' },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteStageDeals(stage.id);

  // Flatten all loaded pages into a single array
  const serverDeals = data?.pages.flatMap((p) => p.deals) ?? [];
  // During drag we show optimistic state; otherwise show server data
  const deals = optimisticDeals ?? serverDeals;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('flex flex-col w-72 flex-shrink-0', isDragging && 'opacity-50')}
    >
      {/* Column header card */}
      <div
        className="card mb-3 overflow-hidden"
      >
        <span
          aria-hidden
          className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full"
          style={{ background: stage.color }}
        />
        <div className="flex items-start justify-between px-4 py-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-text-muted hover:text-text-primary transition-colors touch-none flex-shrink-0"
              tabIndex={-1}
            >
              <GripVertical size={13} />
            </button>
            <div className="min-w-0">
              <p
                className="text-xs font-bold tracking-widest uppercase truncate"
                style={{ color: stage.color }}
              >
                {stage.name}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">{formatCurrency(stage.totalValue)}</p>
            </div>
          </div>
          <span className="ml-2 flex-shrink-0 text-xs font-semibold text-text-muted bg-bg-border px-2 py-0.5 rounded-full">
            {stage.dealCount}
          </span>
        </div>
      </div>

      {/* Cards container */}
      <div
        className={cn(
          'flex-1 min-h-24 rounded-lg p-2 space-y-2 transition-colors',
          isOver && isCardDragActive ? 'bg-accent-green/5 ring-1 ring-accent-green/30' : 'bg-transparent',
        )}
      >
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
                onWon={(id, title) => onWon(id, title)}
                onLost={(id, title) => onLost(id, title)}
                onClick={onDealClick}
              />
            ))}
          </SortableContext>
        )}

        {hasNextPage && !optimisticDeals && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full flex items-center justify-center gap-2 px-2 py-2 rounded text-xs text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors disabled:opacity-50"
          >
            {isFetchingNextPage ? (
              <Loader2 size={12} className="animate-spin" />
            ) : null}
            {isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}
          </button>
        )}

        <button
          onClick={() => onAddDeal(stage.id)}
          className="w-full flex items-center gap-2 px-2 py-2 rounded text-xs text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors"
        >
          <Plus size={12} /> Novo negócio
        </button>
      </div>
    </div>
  );
}
