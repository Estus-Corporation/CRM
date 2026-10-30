import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CalendarCheck, Handshake, PhoneCall, User, type LucideIcon } from 'lucide-react';
import { usePipelineLeads, useSetPipelineStage } from '@/hooks/useCaptacao';
import type { PipelineLead, PipelineStage } from '@/services/captacao.service';
import { cn, personName, shortName } from '@/lib/utils';

/** Fases da pré-venda (as mesmas do pipeline do captador); a cor vai no traço do cabeçalho */
const PHASES: { key: PipelineStage; label: string; icon: LucideIcon; color: string }[] = [
  { key: 'qualifying', label: 'Qualificando', icon: PhoneCall, color: '#9ca3af' },
  { key: 'treating', label: 'Tratando', icon: Handshake, color: '#f5b544' },
  { key: 'meeting', label: 'Reunião marcada', icon: CalendarCheck, color: '#72d296' },
];

function LeadView({ lead, overlay = false }: { lead: PipelineLead; overlay?: boolean }) {
  const title = lead.company_name || personName(lead.full_name);
  return (
    <div
      className={cn(
        'rounded-2xl border border-fg/[0.1] bg-fg/[0.035] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition-colors hover:bg-fg/[0.06]',
        overlay && 'rotate-[1.5deg] bg-bg-surface shadow-[0_28px_56px_-16px_rgba(0,0,0,0.75)]',
      )}
    >
      <p className="truncate text-[14.5px] font-semibold text-text-primary">{title}</p>
      {lead.company_name && lead.company_name !== lead.full_name && (
        <p className="mt-0.5 truncate text-xs text-text-secondary">{personName(lead.full_name)}</p>
      )}
      <div className="mt-2.5 flex items-center gap-2 border-t border-fg/[0.06] pt-2.5 text-xs text-text-muted">
        {lead.niche && <span className="min-w-0 truncate rounded-md bg-fg/[0.06] px-1.5 py-0.5 text-text-secondary">{lead.niche}</span>}
        <span className="ml-auto flex flex-shrink-0 items-center gap-1" title="Captador">
          <User size={12} />
          {lead.captador_name ? shortName(lead.captador_name) : '—'}
        </span>
      </div>
    </div>
  );
}

function DraggableLead({ lead, onOpen }: { lead: PipelineLead; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={onOpen} className={cn('cursor-grab touch-none', isDragging && 'opacity-30')}>
      <LeadView lead={lead} />
    </div>
  );
}

function PhaseHeader({ phase, count }: { phase: (typeof PHASES)[number]; count: number }) {
  return (
    // Mesma "cabeça" das etapas de negócio (KanbanColumn/StageHeader)
    <div className="relative z-[1] -mx-4 -mt-2.5 rounded-[20px] border border-fg/[0.08] bg-bg-surface px-5 pb-3 pt-4 shadow-[0_10px_24px_-14px_rgba(0,0,0,0.6)]">
      <div className="flex items-center gap-2">
        <phase.icon size={21} strokeWidth={2.3} className="flex-shrink-0 text-text-primary" />
        <p className="ml-1 min-w-0 flex-1 truncate text-[17px] font-bold tracking-[-0.01em] text-text-primary">{phase.label}</p>
        <span className="flex h-7 min-w-7 flex-shrink-0 items-center justify-center rounded-full bg-fg/[0.1] px-2 text-[13px] font-bold tabular-nums text-text-primary">
          {count}
        </span>
      </div>
      <div className="mt-2.5 h-[2px] rounded-full" style={{ background: `linear-gradient(90deg, ${phase.color}, ${phase.color}00)` }} />
    </div>
  );
}

function PhaseColumn({ phase, leads, onOpen }: { phase: (typeof PHASES)[number]; leads: PipelineLead[]; onOpen: (l: PipelineLead) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: phase.key });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 flex-shrink-0 flex-col gap-2.5 rounded-[24px] border border-dashed p-2.5 transition-colors duration-200 max-md:w-full',
        isOver ? 'border-accent-green/50 bg-accent-green/[0.05]' : 'border-fg/[0.1] bg-fg/[0.015]',
      )}
    >
      <PhaseHeader phase={phase} count={leads.length} />
      <div className="flex min-h-24 flex-1 flex-col gap-2.5">
        {leads.map((l) => (
          <DraggableLead key={l.id} lead={l} onOpen={() => onOpen(l)} />
        ))}
        {!leads.length && <p className="px-2 py-6 text-center text-xs text-text-muted">Arraste um lead para cá</p>}
      </div>
    </div>
  );
}

/**
 * Pré-venda dentro do Pipeline (admin/gerente): as fases do captador antes das etapas de negócio.
 * Lead ganho (reunião confirmada) sai daqui e vira negócio na 1ª etapa, automaticamente (backend).
 * `phase` (celular): mostra só aquela fase, sem arrastar.
 */
export function PreSaleColumns({ phase }: { phase?: PipelineStage }) {
  const navigate = useNavigate();
  const { data: leads = [] } = usePipelineLeads();
  const move = useSetPipelineStage();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [dragId, setDragId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<PipelineStage, PipelineLead[]> = { qualifying: [], treating: [], meeting: [] };
    for (const l of leads) map[l.pipeline_stage]?.push(l);
    return map;
  }, [leads]);

  const open = (l: PipelineLead) => navigate(`/captacao/lead/${l.contact_id}`);

  if (phase) {
    const p = PHASES.find((x) => x.key === phase)!;
    return (
      <div className="space-y-2.5">
        {grouped[phase].map((l) => (
          <button key={l.id} type="button" onClick={() => open(l)} className="block w-full text-left">
            <LeadView lead={l} />
          </button>
        ))}
        {!grouped[phase].length && <p className="py-8 text-center text-xs text-text-muted">Nenhum lead em {p.label.toLowerCase()}</p>}
      </div>
    );
  }

  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const stage = e.over?.id as PipelineStage | undefined;
    const lead = leads.find((l) => l.id === e.active.id);
    if (stage && lead && lead.pipeline_stage !== stage) move.mutate({ id: lead.id, stage });
  };
  const dragging = dragId ? leads.find((l) => l.id === dragId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
      {PHASES.map((p) => (
        <PhaseColumn key={p.key} phase={p} leads={grouped[p.key]} onOpen={open} />
      ))}
      {createPortal(
        <DragOverlay zIndex={80}>{dragging && <div className="w-[268px]"><LeadView lead={dragging} overlay /></div>}</DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}

export const PRE_SALE_PHASES = PHASES;
