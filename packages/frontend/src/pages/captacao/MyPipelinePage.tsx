import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { createPortal } from 'react-dom';
import { CalendarCheck, Handshake, Kanban, PhoneCall, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMyLeads, useUpdateMyLead } from '@/hooks/useCaptacao';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { cn, personName } from '@/lib/utils';
import type { MyLead, PipelineStage } from '@/services/captacao.service';

const STAGES: { key: PipelineStage; label: string; icon: LucideIcon; tone: string }[] = [
  { key: 'qualifying', label: 'Qualificando', icon: PhoneCall, tone: 'text-text-primary' },
  { key: 'treating', label: 'Tratando', icon: Handshake, tone: 'text-accent-amber' },
  { key: 'meeting', label: 'Reunião marcada', icon: CalendarCheck, tone: 'text-accent-green' },
];

function LeadCardView({ lead, dragging = false }: { lead: MyLead; dragging?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-fg/[0.12] bg-fg/[0.04] p-3.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-fg/[0.08]',
        dragging && 'shadow-xl',
      )}
    >
      <p className="truncate text-sm font-semibold text-text-primary">{lead.company_name || personName(lead.full_name)}</p>
      {lead.company_name && <p className="mt-0.5 truncate text-xs text-text-secondary">{personName(lead.full_name)}</p>}
      {lead.niche && <p className="mt-1.5 truncate text-xs text-text-muted">{lead.niche}</p>}
    </div>
  );
}

function DraggableLead({ lead, onOpen }: { lead: MyLead; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={cn('cursor-grab touch-none', isDragging && 'opacity-30')}
    >
      <LeadCardView lead={lead} />
    </div>
  );
}

function StageColumn({ stage, leads, onOpen }: { stage: (typeof STAGES)[number]; leads: MyLead[]; onOpen: (l: MyLead) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[320px] min-w-0 flex-col rounded-2xl border bg-fg/[0.03] p-3 transition-colors',
        isOver ? 'border-accent-green/50 bg-accent-green/[0.04]' : 'border-fg/[0.08]',
      )}
    >
      <div className="mb-3 flex items-center gap-2 px-1">
        <stage.icon size={17} className={stage.tone} />
        <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">{stage.label}</span>
        <span className="ml-auto rounded-md bg-fg/[0.07] px-2 py-0.5 text-xs tabular-nums text-text-secondary">{leads.length}</span>
      </div>
      <div className="flex-1 space-y-2.5">
        {leads.map((l) => (
          <DraggableLead key={l.id} lead={l} onOpen={() => onOpen(l)} />
        ))}
        {!leads.length && <p className="px-1 py-8 text-center text-xs text-text-muted">Arraste um lead para cá</p>}
      </div>
    </div>
  );
}

export function MyPipelinePage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: leads, isLoading } = useMyLeads('all', undefined);
  const update = useUpdateMyLead();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [dragId, setDragId] = useState<string | null>(null);
  // Movimento aplicado na hora (antes do servidor responder)
  const [overrides, setOverrides] = useState<Record<string, PipelineStage>>({});
  const [mobileStage, setMobileStage] = useState<PipelineStage>('qualifying');

  const grouped = useMemo(() => {
    const map: Record<PipelineStage, MyLead[]> = { qualifying: [], treating: [], meeting: [] };
    for (const l of leads ?? []) {
      const stage = overrides[l.id] ?? l.pipeline_stage;
      if (stage) map[stage].push(l);
    }
    for (const k of Object.keys(map) as PipelineStage[]) {
      map[k].sort((a, b) => (b.pipeline_at ?? '').localeCompare(a.pipeline_at ?? ''));
    }
    return map;
  }, [leads, overrides]);

  const total = grouped.qualifying.length + grouped.treating.length + grouped.meeting.length;
  const dragging = dragId ? (leads ?? []).find((l) => l.id === dragId) : null;

  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const stage = e.over?.id as PipelineStage | undefined;
    const lead = (leads ?? []).find((l) => l.id === e.active.id);
    if (!stage || !lead || (overrides[lead.id] ?? lead.pipeline_stage) === stage) return;
    setOverrides((o) => ({ ...o, [lead.id]: stage }));
    update.mutate(
      { id: lead.id, pipelineStage: stage },
      {
        onSettled: () =>
          setOverrides((o) => {
            const { [lead.id]: _drop, ...rest } = o;
            return rest;
          }),
      },
    );
  };

  const open = (l: MyLead) => navigate(`/meus-leads/lead/${l.id}`);

  return (
    <div className="mobile-sections space-y-5 max-md:space-y-3">
      <PageHeader title="Pipeline" subtitle="Leads que você enviou para o pipeline — arraste entre as fases" />

      {isLoading ? (
        <Skeleton className="h-80 w-full rounded-2xl" />
      ) : total === 0 ? (
        <div className="card">
          <EmptyState
            icon={Kanban}
            title="Nenhum lead no pipeline"
            description='Abra um lead em Meus leads e clique em "Enviar para o pipeline".'
          />
        </div>
      ) : isMobile ? (
        // Celular: uma fase por vez (sem rolagem lateral)
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {STAGES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setMobileStage(s.key)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-xs',
                  mobileStage === s.key ? 'border-accent-green/40 bg-accent-green/10 text-text-primary' : 'border-fg/[0.1] text-text-secondary',
                )}
              >
                <s.icon size={15} className={s.tone} />
                {s.label} · {grouped[s.key].length}
              </button>
            ))}
          </div>
          <div className="space-y-2.5">
            {grouped[mobileStage].map((l) => (
              <button key={l.id} type="button" onClick={() => open(l)} className="block w-full">
                <LeadCardView lead={l} />
              </button>
            ))}
            {!grouped[mobileStage].length && <p className="py-8 text-center text-xs text-text-muted">Nenhum lead nesta fase</p>}
          </div>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
          <div className="grid grid-cols-3 gap-4">
            {STAGES.map((s) => (
              <StageColumn key={s.key} stage={s} leads={grouped[s.key]} onOpen={open} />
            ))}
          </div>
          {/* Portal no body: a pasta tem backdrop-filter e deslocaria o overlay */}
          {createPortal(<DragOverlay>{dragging && <LeadCardView lead={dragging} dragging />}</DragOverlay>, document.body)}
        </DndContext>
      )}
    </div>
  );
}
