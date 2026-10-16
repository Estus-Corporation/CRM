import { useState, useEffect, useRef } from 'react';
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
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { GripVertical, Plus, Settings } from 'lucide-react';
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
import { KanbanColumn } from '@/components/kanban/KanbanColumn';
import { KanbanCard } from '@/components/kanban/KanbanCard';
import { DealForm } from '@/components/kanban/DealForm';
import { PipelineSettingsModal } from '@/components/pipeline/PipelineSettingsModal';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { KanbanSkeleton } from '@/components/ui/Skeleton';
import type { StageMeta, Deal } from '@/services/pipeline.service';
import { dealsService, pipelineService } from '@/services/pipeline.service';
import { toast } from 'sonner';

export function PipelinePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: pipelines, isLoading: loadingPipelines } = usePipelines();
  const [activePipelineId, setActivePipelineId] = useState<string>('');
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [defaultStageId, setDefaultStageId] = useState<string>('');
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [activeStage, setActiveStage] = useState<StageMeta | null>(null);
  const [localStages, setLocalStages] = useState<StageMeta[]>([]);

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

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveDeal(null);
    setActiveStage(null);

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

    if (originStageId === overStageId) {
      // Same-column reorder
      const stageDeals = optimisticDealsMap?.[originStageId] ?? getCachedDeals(originStageId);
      const oldIdx = stageDeals.findIndex((d) => d.id === active.id);
      const overIdx = stageDeals.findIndex((d) => d.id === over.id);
      setOptimisticDealsMap(null);
      if (oldIdx === -1 || overIdx === -1 || oldIdx === overIdx) return;
      const reordered = arrayMove(stageDeals, oldIdx, overIdx);
      // Optimistically update cache
      qc.setQueryData(pipelineKeys.stageDeals(originStageId), (old: { pages: { deals: Deal[] }[] } | undefined) => {
        if (!old) return old;
        const allDeals = old.pages.flatMap((p) => p.deals);
        const map = new Map(reordered.map((d, i) => [d.id, i]));
        const sorted = [...allDeals].sort((a, b) => (map.get(a.id) ?? 0) - (map.get(b.id) ?? 0));
        return { ...old, pages: [{ ...old.pages[0], deals: sorted }] };
      });
      await dealsService.reorder(originStageId, reordered.map((d) => d.id));
      invalidateStageDeals(qc, [originStageId]);
    } else {
      // Cross-column move
      const destDeals = optimisticDealsMap?.[overStageId] ?? getCachedDeals(overStageId);
      const position = destDeals.findIndex((d) => d.id === over.id);
      setOptimisticDealsMap(null);
      try {
        await moveDeal.mutateAsync({ id: String(active.id), stageId: overStageId, position });
        invalidateStageDeals(qc, [originStageId, overStageId]);
        // Invalidate kanban meta to update counts/values
        qc.invalidateQueries({ queryKey: pipelineKeys.kanban(activePipelineId) });
      } catch {
        invalidateStageDeals(qc, [originStageId, overStageId]);
        qc.invalidateQueries({ queryKey: pipelineKeys.kanban(activePipelineId) });
      }
    }
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
        <h1 className="text-2xl font-semibold text-text-primary">Pipeline</h1>
        <div className="card p-12 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-text-secondary text-sm">Nenhum pipeline ainda. Crie um para começar.</p>
          <Button onClick={handleCreateFirstPipeline} disabled={createPipeline.isPending}>
            <Plus size={14} /> Criar pipeline
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-text-primary">Pipeline</h1>
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
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings size={14} /> Configurações
          </Button>
          <Button size="sm" onClick={() => openDealModal(localStages[0]?.id ?? '')}>
            <Plus size={14} /> Novo negócio
          </Button>
        </div>
      </div>

      {loadingKanban ? (
        <KanbanSkeleton columns={localStages.length || 3} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
            <SortableContext items={localStages.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
              {localStages.map((stage) => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  optimisticDeals={optimisticDealsMap?.[stage.id]}
                  onAddDeal={openDealModal}
                  onWon={(id, title) => handleMarkWon(id, title)}
                  onLost={(id, title) => handleMarkLost(id, title)}
                  onDealClick={(deal) => navigate(`/deals/${deal.id}`)}
                  isCardDragActive={activeDeal !== null}
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

          <DragOverlay>
            {activeDeal && (
              <KanbanCard
                deal={activeDeal}
                onWon={() => {}}
                onLost={() => {}}
                onClick={() => {}}
              />
            )}
            {activeStage && (
              <div className="flex flex-col w-72 flex-shrink-0 rotate-1 opacity-90">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <GripVertical size={14} className="text-text-muted" />
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: activeStage.color }} />
                  <span className="text-sm font-medium text-text-primary">{activeStage.name}</span>
                  <span className="text-xs text-text-muted bg-bg-surface px-1.5 py-0.5 rounded">
                    {activeStage.dealCount}
                  </span>
                </div>
                <div className="flex-1 min-h-24 rounded-lg bg-bg-surface/50 ring-1 ring-accent-green/40" />
              </div>
            )}
          </DragOverlay>
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
