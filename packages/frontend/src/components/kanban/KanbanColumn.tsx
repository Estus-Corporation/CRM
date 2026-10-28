import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ClipboardCheck, FileText, Flag, GripVertical, Handshake, Loader2, Plus, Trophy, Users, type LucideIcon } from 'lucide-react';
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

/** Ícone da etapa pelo nome (pipeline padrão); etapas personalizadas caem na bandeira */
function stageIcon(name: string): LucideIcon {
  const n = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (n.includes('prospec') || n.includes('lead')) return Users;
  if (n.includes('qualif')) return ClipboardCheck;
  if (n.includes('propost')) return FileText;
  if (n.includes('negoci')) return Handshake;
  if (n.includes('fecha') || n.includes('ganh')) return Trophy;
  return Flag;
}

/** Cabeçalho da coluna — também usado na cópia que segue o mouse ao reordenar etapas */
export function StageHeader({ stage, dragHandle }: { stage: StageMeta; dragHandle?: React.ReactNode }) {
  return (
    // "Cabeça" mais larga que a coluna: passa 6px de cada lado de propósito; o corpo segue na largura normal
    <div className="relative z-[1] -mx-4 -mt-2.5 rounded-[20px] border border-fg/[0.08] bg-bg-surface px-5 pb-3 pt-4 shadow-[0_10px_24px_-14px_rgba(0,0,0,0.6)]">
      {/* Nome grande + contagem; o valor total fica no rodapé da coluna */}
      <div className="flex items-center gap-2">
        {dragHandle}
        {(() => {
          const Icon = stageIcon(stage.name);
          return <Icon size={21} strokeWidth={2.3} className="flex-shrink-0 text-text-primary" />;
        })()}
        <p className="ml-1 min-w-0 flex-1 truncate text-[17px] font-bold tracking-[-0.01em] text-text-primary">{stage.name}</p>
        <span className="flex h-7 min-w-7 flex-shrink-0 items-center justify-center rounded-full bg-fg/[0.1] px-2 text-[13px] font-bold tabular-nums text-text-primary">
          {stage.dealCount}
        </span>
      </div>
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

      {/* Rodapé fixo na base da coluna: total em jogo na etapa */}
      <div className="sticky bottom-0 -mx-2.5 -mb-2.5 mt-auto flex items-center justify-between rounded-b-[23px] border-t border-fg/[0.06] bg-bg-surface/80 px-4 py-3 backdrop-blur-md">
        <span className="text-[12px] font-medium text-text-muted">Total em jogo</span>
        <span className="text-[15px] font-semibold tabular-nums text-text-primary">{formatCurrency(stage.totalValue)}</span>
      </div>
    </div>
  );
}
