import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  defaultDropAnimationSideEffects,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DropAnimation,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Settings } from 'lucide-react';
import {
  useKanban,
  usePipelines,
  useCreateDeal,
  useMoveDeal,
  useMarkWon,
  useMarkLost,
  useMarkOpen,
  useCreatePipeline,
  useReorderStages,
  pipelineKeys,
  invalidateStageDeals,
} from '@/hooks/usePipeline';
import { useQueryClient } from '@tanstack/react-query';
import { KanbanColumn, StageHeader } from '@/components/kanban/KanbanColumn';
import { DealCardView } from '@/components/kanban/KanbanCard';
import { DealForm } from '@/components/kanban/DealForm';
import { PipelineSettingsModal } from '@/components/pipeline/PipelineSettingsModal';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { KanbanSkeleton } from '@/components/ui/Skeleton';
import type { StageMeta, Deal, StageDealsPage } from '@/services/pipeline.service';
import { dealsService, pipelineService } from '@/services/pipeline.service';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

// Ao soltar, a cópia desliza até o encaixe; o card original reaparece no fim
const dropAnimation: DropAnimation = {
  duration: 220,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0' } } }),
};

type StageDealsCache = { pages: StageDealsPage[]; pageParams: unknown[] };

/**
 * Colisão guiada pelo mouse: o card cai na coluna em que o cursor está (closestCorners usava os
 * cantos de colunas altas e às vezes mantinha o card na coluna de origem). Arrastando etapa,
 * só as colunas contam.
 */
const kanbanCollision: CollisionDetection = (args) => {
  if (args.active.data.current?.type === 'column') {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => c.data.current?.type === 'column'),
    });
  }
  const hits = pointerWithin(args);
  if (hits.length > 0) {
    // Cursor sobre um card: ele vence a coluna que o contém
    const card = hits.find((h) => args.droppableContainers.find((c) => c.id === h.id)?.data.current?.type === 'deal');
    return card ? [card] : hits;
  }
  return rectIntersection(args);
};

export function PipelinePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: pipelines, isLoading: loadingPipelines } = usePipelines();
  const [activePipelineId, setActivePipelineId] = useState<string>('');
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isMobile = useIsMobile();
  const [mobileStageId, setMobileStageId] = useState<string | null>(null);
  const [defaultStageId, setDefaultStageId] = useState<string>('');
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [activeStage, setActiveStage] = useState<StageMeta | null>(null);
  const [localStages, setLocalStages] = useState<StageMeta[]>([]);
  // Coluna sob o card arrastado (destaque na cor da etapa)
  const [overStageId, setOverStageId] = useState<string | null>(null);

  // Optimistic deals per stage used only during active drag to prevent flicker
  const [optimisticDealsMap, setOptimisticDealsMap] = useState<Record<string, Deal[]> | null>(null);

  // Track original stage of dragged card before handleDragOver changes it
  const dragOriginStageId = useRef<string | null>(null);

  const { data: kanban, isLoading: loadingKanban } = useKanban(activePipelineId);
  const createDeal = useCreateDeal();
  const moveDeal = useMoveDeal();
  const markWon = useMarkWon();
  const markLost = useMarkLost();
  const markOpen = useMarkOpen();
  const createPipeline = useCreatePipeline();
  const reorderStages = useReorderStages();

  useEffect(() => {
    if (pipelines && pipelines.length > 0 && !activePipelineId) {
      const def = pipelines.find((p) => p.is_default) ?? pipelines[0];
      setActivePipelineId(def.id);
    }
  }, [pipelines, activePipelineId]);

  useEffect(() => {
    if (kanban) setLocalStages(kanban);
  }, [kanban]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  /** Grava a lista de uma etapa direto no cache (a tela atualiza na hora, antes do servidor) */
  function writeStageDeals(stageId: string, deals: Deal[]) {
    qc.setQueryData<StageDealsCache>(pipelineKeys.stageDeals(stageId), (old) => {
      if (!old) return old;
      const [first, ...rest] = old.pages;
      // Tudo numa página só: as demais ficam vazias pra não duplicar cards
      return { ...old, pages: [{ ...first, deals }, ...rest.map((pg) => ({ ...pg, deals: [] }))] };
    });
  }

  // Resolve loaded deals for a stage from the query cache
  function getCachedDeals(stageId: string): Deal[] {
    const cached = qc.getQueryData<{ pages: { deals: Deal[] }[] }>(
      pipelineKeys.stageDeals(stageId),
    );
    return cached?.pages.flatMap((p) => p.deals) ?? [];
  }

  const handleDragStart = ({ active }: DragStartEvent) => {
    if (active.data.current?.type === 'column') {
      const stage = localStages.find((s) => s.id === active.id);
      if (stage) setActiveStage(stage);
      dragOriginStageId.current = null;
      return;
    }

    // Build a snapshot of all deals from cache for the optimistic map
    const snapshot: Record<string, Deal[]> = {};
    for (const s of localStages) {
      snapshot[s.id] = getCachedDeals(s.id);
    }

    const originStage = Object.entries(snapshot).find(([, deals]) =>
      deals.some((d) => d.id === active.id),
    );
    dragOriginStageId.current = originStage?.[0] ?? null;

    const deal = originStage?.[1].find((d) => d.id === active.id) ?? null;
    if (deal) setActiveDeal(deal);

    setOptimisticDealsMap(snapshot);
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || active.data.current?.type === 'column' || !optimisticDealsMap) return;

    const activeStageId = Object.entries(optimisticDealsMap).find(([, deals]) =>
      deals.some((d) => d.id === active.id),
    )?.[0];
    const overStageId =
      localStages.find((s) => s.id === over.id)?.id ??
      Object.entries(optimisticDealsMap).find(([, deals]) =>
        deals.some((d) => d.id === over.id),
      )?.[0];

    setOverStageId(overStageId ?? null);
    if (!activeStageId || !overStageId || activeStageId === overStageId) return;

    setOptimisticDealsMap((prev) => {
      if (!prev) return prev;
      const deal = prev[activeStageId].find((d) => d.id === active.id)!;
      return {
        ...prev,
        [activeStageId]: prev[activeStageId].filter((d) => d.id !== active.id),
        [overStageId]: [...prev[overStageId], { ...deal, stage_id: overStageId }],
      };
    });
  };

  const handleDragCancel = () => {
    setActiveDeal(null);
    setActiveStage(null);
    setOverStageId(null);
    setOptimisticDealsMap(null);
    dragOriginStageId.current = null;
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveDeal(null);
    setActiveStage(null);
    setOverStageId(null);

    if (!over) {
      setOptimisticDealsMap(null);
      return;
    }

    // Column reorder
    if (active.data.current?.type === 'column') {
      setOptimisticDealsMap(null);
      if (active.id === over.id) return;
      const oldIdx = localStages.findIndex((s) => s.id === active.id);
      const newIdx = localStages.findIndex((s) => s.id === over.id);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;
      const reordered = arrayMove(localStages, oldIdx, newIdx);
      setLocalStages(reordered);
      await reorderStages.mutateAsync({ pipelineId: activePipelineId, stageIds: reordered.map((s) => s.id) });
      return;
    }

    const originStageId = dragOriginStageId.current;
    dragOriginStageId.current = null;

    const overStageId =
      localStages.find((s) => s.id === over.id)?.id ??
      Object.entries(optimisticDealsMap ?? {}).find(([, deals]) =>
        deals.some((d) => d.id === over.id),
      )?.[0];

    if (!originStageId || !overStageId) {
      setOptimisticDealsMap(null);
      return;
    }

    const snapshot = optimisticDealsMap ?? {};
    setOptimisticDealsMap(null);

    if (originStageId === overStageId) {
      // Mesma coluna: só reordena
      const stageDeals = snapshot[originStageId] ?? getCachedDeals(originStageId);
      const oldIdx = stageDeals.findIndex((d) => d.id === active.id);
      const overIdx = stageDeals.findIndex((d) => d.id === over.id);
      if (oldIdx === -1 || overIdx === -1 || oldIdx === overIdx) return;
      const reordered = arrayMove(stageDeals, oldIdx, overIdx);
      writeStageDeals(originStageId, reordered);
      dealsService
        .reorder(originStageId, reordered.map((d) => d.id))
        .catch(() => toast.error('Não foi possível salvar a ordem'))
        .finally(() => invalidateStageDeals(qc, [originStageId]));
      return;
    }

    // Outra coluna: move no cache na hora e salva em segundo plano
    const deal = getCachedDeals(originStageId).find((d) => d.id === active.id) ?? activeDeal;
    if (!deal) return;
    const origin = getCachedDeals(originStageId).filter((d) => d.id !== active.id);
    const dest = (snapshot[overStageId] ?? getCachedDeals(overStageId)).filter((d) => d.id !== active.id);
    const overIdx = dest.findIndex((d) => d.id === over.id);
    const position = overIdx === -1 ? dest.length : overIdx;
    dest.splice(position, 0, { ...deal, stage_id: overStageId });
    writeStageDeals(originStageId, origin);
    writeStageDeals(overStageId, dest);

    const value = Number(deal.value) || 0;
    qc.setQueryData<StageMeta[]>(pipelineKeys.kanban(activePipelineId), (stages) =>
      stages?.map((st) =>
        st.id === originStageId
          ? { ...st, dealCount: Math.max(0, st.dealCount - 1), totalValue: st.totalValue - value }
          : st.id === overStageId
            ? { ...st, dealCount: st.dealCount + 1, totalValue: st.totalValue + value }
            : st,
      ),
    );

    moveDeal
      .mutateAsync({ id: String(active.id), stageId: overStageId, position })
      .catch(() => toast.error('Não foi possível mover o negócio'))
      .finally(() => {
        invalidateStageDeals(qc, [originStageId, overStageId]);
        qc.invalidateQueries({ queryKey: pipelineKeys.kanban(activePipelineId) });
      });
  };

  const handleMarkWon = (id: string, title: string) => {
    const stageId = Object.entries(
      Object.fromEntries(localStages.map((s) => [s.id, getCachedDeals(s.id)])),
    ).find(([, deals]) => deals.some((d) => d.id === id))?.[0];

    markWon.mutate(id, {
      onSuccess: () => {
        toast.success(`"${title}" marcado como Ganho!`, {
          action: { label: 'Desfazer', onClick: () => markOpen.mutate(id) },
        });
        if (stageId) invalidateStageDeals(qc, [stageId]);
        qc.invalidateQueries({ queryKey: pipelineKeys.kanban(activePipelineId) });
      },
    });
  };

  const handleMarkLost = (id: string, title: string) => {
    const stageId = Object.entries(
      Object.fromEntries(localStages.map((s) => [s.id, getCachedDeals(s.id)])),
    ).find(([, deals]) => deals.some((d) => d.id === id))?.[0];

    markLost.mutate({ id }, {
      onSuccess: () => {
        toast.error(`"${title}" marcado como Perdido`, {
          action: { label: 'Desfazer', onClick: () => markOpen.mutate(id) },
        });
        if (stageId) invalidateStageDeals(qc, [stageId]);
        qc.invalidateQueries({ queryKey: pipelineKeys.kanban(activePipelineId) });
      },
    });
  };

  const openDealModal = (stageId: string) => {
    setDefaultStageId(stageId);
    setDealModalOpen(true);
  };

  const handleCreateDeal = async (data: {
    title: string; stageId: string; value?: number; expectedClose?: string;
    contactId?: string; ownerId?: string;
  }) => {
    await createDeal.mutateAsync({
      title: data.title,
      pipelineId: activePipelineId,
      stageId: data.stageId,
      value: data.value,
      expectedClose: data.expectedClose,
      contactId: data.contactId || undefined,
      ownerId: data.ownerId || undefined,
    });
    invalidateStageDeals(qc, [data.stageId]);
    qc.invalidateQueries({ queryKey: pipelineKeys.kanban(activePipelineId) });
    setDealModalOpen(false);
  };

  const handleCreateFirstPipeline = async () => {
    const pipeline = await createPipeline.mutateAsync({ name: 'Pipeline de Vendas' });
    const defaultStages = [
      { name: 'Qualificação', color: '#F5B547' },
      { name: 'Proposta',     color: '#D99A3A' },
      { name: 'Negociação',   color: '#38B27E' },
      { name: 'Fechamento',   color: '#4FD69C' },
    ];
    for (const stage of defaultStages) {
      await pipelineService.createStage(pipeline.id, stage);
    }
    setActivePipelineId(pipeline.id);
  };

  if (loadingPipelines) return <KanbanSkeleton columns={4} />;

  if (!pipelines || pipelines.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="page-title">Pipeline</h1>
        <div className="card p-12 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-text-secondary text-sm">Nenhum pipeline ainda. Crie um para começar.</p>
          <Button onClick={handleCreateFirstPipeline} disabled={createPipeline.isPending}>
            <Plus size={14} /> Criar pipeline
          </Button>
        </div>
      </div>
    );
  }

  // Celular: uma etapa por vez (escolhida na grade de etapas), sem rolar o kanban para o lado
  const mobileStage = localStages.find((s) => s.id === mobileStageId) ?? localStages[0];
  const visibleStages = isMobile && mobileStage ? [mobileStage] : localStages;

  return (
    // mobile-sections: no celular cabeçalho, etapas e kanban viram blocos translúcidos (ver globals.css)
    <div className="mobile-sections space-y-4 flex-1 flex flex-col max-md:space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title">Pipeline</h1>
          <div className="flex gap-1">
            {pipelines.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePipelineId(p.id)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  activePipelineId === p.id
                    ? 'bg-accent-green text-bg-darker font-medium'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
          <p className="mt-1.5 text-sm text-text-secondary">Arraste os negócios entre as etapas para acompanhar cada venda.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="lg" onClick={() => setSettingsOpen(true)} aria-label="Configurações" className="px-5 text-[15px]">
            <Settings size={18} /> <span className="max-md:hidden">Configurações</span>
          </Button>
          <Button size="lg" onClick={() => openDealModal((isMobile ? mobileStage?.id : localStages[0]?.id) ?? '')} className="px-6 text-[15px]">
            <Plus size={18} strokeWidth={2.25} /> Novo negócio
          </Button>
        </div>
      </div>

      {/* Celular: todas as etapas visíveis numa grade; tocar mostra os negócios daquela etapa */}
      {isMobile && localStages.length > 0 && (
        <div className="grid flex-shrink-0 grid-cols-2 gap-2">
          {localStages.map((s) => {
            const active = s.id === mobileStage?.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setMobileStageId(s.id)}
                className={cn(
                  'flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors',
                  active ? 'border-transparent bg-fg/[0.08]' : 'border-fg/[0.07] hover:bg-fg/[0.04]',
                )}
                style={active ? { boxShadow: `inset 0 0 0 1.5px ${s.color}` } : undefined}
              >
                <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className={cn('min-w-0 flex-1 truncate text-[13px] font-medium', active ? 'text-text-primary' : 'text-text-secondary')}>
                  {s.name}
                </span>
                <span className="flex-shrink-0 rounded-md bg-fg/[0.06] px-1.5 text-[11px] tabular-nums text-text-muted">{s.dealCount}</span>
              </button>
            );
          })}
        </div>
      )}

      {loadingKanban ? (
        <KanbanSkeleton columns={localStages.length || 3} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={kanbanCollision}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {/* gap-7: a "cabeça" de cada etapa passa 6px pra fora, então o vão visível fica ~16px */}
          <div className="flex gap-7 overflow-x-auto px-1.5 pb-4 flex-1 max-md:overflow-visible max-md:[&>*]:!w-full">
            <SortableContext items={visibleStages.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
              {visibleStages.map((stage) => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  optimisticDeals={optimisticDealsMap?.[stage.id]}
                  onAddDeal={openDealModal}
                  onWon={(id, title) => handleMarkWon(id, title)}
                  onLost={(id, title) => handleMarkLost(id, title)}
                  onDealClick={(deal) => navigate(`/deals/${deal.id}`)}
                  isDropTarget={activeDeal !== null && overStageId === stage.id}
                />
              ))}
            </SortableContext>

            {localStages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted text-sm">
                <p>Nenhuma etapa ainda.</p>
                <Button size="sm" variant="secondary" onClick={() => setSettingsOpen(true)}>
                  <Settings size={14} /> Adicionar etapas
                </Button>
              </div>
            )}
          </div>

          {/* Portal no body: a área principal tem backdrop-filter, que vira referência de position:fixed
              e deixava a cópia deslocada do mouse */}
          {createPortal(
            <DragOverlay dropAnimation={dropAnimation} zIndex={80}>
              {activeDeal && (
                <div className="w-[268px]">
                  <DealCardView
                    deal={activeDeal}
                    overlay
                  />
                </div>
              )}
              {activeStage && (
                <div className="w-72 rotate-[1.5deg] rounded-2xl border border-accent-green/40 bg-bg-surface shadow-[0_28px_56px_-16px_rgba(0,0,0,0.75)]">
                  <StageHeader stage={activeStage} />
                  <div className="mx-2 mb-2 h-24 rounded-xl bg-fg/[0.03]" />
                </div>
              )}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
      )}

      <Modal open={dealModalOpen} onClose={() => setDealModalOpen(false)} title="Novo negócio">
        <DealForm
          stages={localStages}
          defaultStageId={defaultStageId}
          onSubmit={handleCreateDeal}
          onCancel={() => setDealModalOpen(false)}
          isSubmitting={createDeal.isPending}
        />
      </Modal>

      {activePipelineId && (
        <PipelineSettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          pipelineId={activePipelineId}
          pipelineName={pipelines?.find((p) => p.id === activePipelineId)?.name ?? 'Pipeline'}
          stages={localStages}
        />
      )}
    </div>
  );
}
