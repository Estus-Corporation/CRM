import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ListChecks, Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { AREAS, ATTRIBUTES, dayKey, type AreaKey, type AttrKey, type Mission } from '../data';
import { useRpg } from '../store';
import { PageTitle, Panel } from '../ui';

/** Missões que aparecem hoje: as diárias e as avulsas ainda não feitas (ou feitas hoje) */
export function todaysMissions(missions: Mission[]) {
  const today = dayKey();
  return missions.filter((m) => m.daily || m.doneDates.length === 0 || m.doneDates.includes(today));
}

const XP_OPTIONS = [25, 50, 100, 150, 200, 300];

type Draft = { title: string; xp: number; area: AreaKey | ''; attribute: AttrKey | ''; daily: boolean };
const EMPTY: Draft = { title: '', xp: 100, area: '', attribute: '', daily: true };

function MissionModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Mission | null }) {
  const { addMission, updateMission } = useRpg();
  const [d, setD] = useState<Draft>(EMPTY);
  // Abre com os dados da missão (ou vazio)
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const key = open ? editing?.id ?? 'new' : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (open) setD(editing ? { title: editing.title, xp: editing.xp, area: editing.area ?? '', attribute: editing.attribute ?? '', daily: editing.daily } : EMPTY);
  }

  const save = () => {
    if (!d.title.trim()) return;
    const m = { title: d.title.trim(), xp: d.xp, area: d.area || null, attribute: d.attribute || null, daily: d.daily };
    if (editing) updateMission(editing.id, m);
    else addMission(m);
    onClose();
  };

  const chip = (active: boolean) =>
    cn('rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors', active ? 'border-accent-green/50 bg-accent-green/15 text-accent-green' : 'border-fg/[0.1] text-text-secondary hover:bg-fg/[0.05]');

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar missão' : 'Nova missão'} description="Uma tarefa que vale XP quando você conclui.">
      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">O que fazer</label>
          <input autoFocus value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Ex.: Correr 5 km" maxLength={80} className="input-base h-10 w-full text-sm" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Recompensa</label>
          <div className="flex flex-wrap gap-2">
            {XP_OPTIONS.map((xp) => (
              <button key={xp} type="button" onClick={() => setD({ ...d, xp })} className={chip(d.xp === xp)}>+{xp} XP</button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Área da vida que sobe</label>
          <div className="flex flex-wrap gap-2">
            {AREAS.map((a) => (
              <button key={a.key} type="button" onClick={() => setD({ ...d, area: d.area === a.key ? '' : a.key })} className={chip(d.area === a.key)}>{a.label}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Atributo que ganha o XP</label>
          <div className="flex flex-wrap gap-2">
            {ATTRIBUTES.map((a) => (
              <button key={a.key} type="button" onClick={() => setD({ ...d, attribute: d.attribute === a.key ? '' : a.key })} className={chip(d.attribute === a.key)}>{a.label}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setD({ ...d, daily: true })} className={chip(d.daily)}>Todo dia</button>
          <button type="button" onClick={() => setD({ ...d, daily: false })} className={chip(!d.daily)}>Uma vez</button>
        </div>
        <div className="flex justify-end gap-2 border-t border-fg/[0.06] pt-4">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!d.title.trim()}>{editing ? 'Salvar' : 'Criar missão'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function MissionRow({ m, onEdit, locked = false }: { m: Mission; onEdit: () => void; locked?: boolean }) {
  const { toggleMission, removeMission } = useRpg();
  // Avulsa já feita em outro dia: mostra como feita e não deixa marcar de novo
  const done = locked || m.doneDates.includes(dayKey());
  const area = AREAS.find((a) => a.key === m.area);
  const attr = ATTRIBUTES.find((a) => a.key === m.attribute);
  return (
    <motion.li layout className={cn('group flex items-center gap-3 rounded-2xl border p-3.5 transition-colors', done ? 'border-accent-green/30 bg-accent-green/[0.06]' : 'border-fg/[0.08] bg-fg/[0.03]')}>
      <button
        type="button"
        onClick={() => !locked && toggleMission(m.id)}
        disabled={locked}
        aria-label={done ? 'Desmarcar' : 'Concluir'}
        className={cn('flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border transition-colors', done ? 'border-accent-green bg-accent-green text-[rgb(var(--on-accent))]' : 'border-fg/[0.25] hover:border-accent-green')}
      >
        {done && <Check size={16} strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-[14.5px] font-medium', done ? 'text-text-secondary line-through decoration-fg/30' : 'text-text-primary')}>{m.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-text-muted">
          {m.daily && <span className="flex items-center gap-1"><Repeat size={11} /> diária</span>}
          {area && <span>{area.label} +1</span>}
          {attr && <span>{attr.label}</span>}
          {m.doneDates.length > 0 && <span>· feita {m.doneDates.length}x</span>}
        </p>
      </div>
      <span className="flex-shrink-0 rounded-full bg-fg/[0.06] px-2.5 py-1 text-xs font-semibold tabular-nums text-text-primary">+{m.xp} XP</span>
      <div className="flex flex-shrink-0 gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
        <button type="button" onClick={onEdit} aria-label="Editar" className="rounded-lg p-1.5 text-text-muted hover:bg-fg/[0.06] hover:text-text-primary"><Pencil size={14} /></button>
        <button type="button" onClick={() => removeMission(m.id)} aria-label="Excluir" className="rounded-lg p-1.5 text-text-muted hover:bg-status-lost/10 hover:text-status-lost"><Trash2 size={14} /></button>
      </div>
    </motion.li>
  );
}

export function Missions() {
  const missions = useRpg((s) => s.missions);
  const [modal, setModal] = useState<{ open: boolean; editing: Mission | null }>({ open: false, editing: null });
  const today = todaysMissions(missions);
  const done = today.filter((m) => m.doneDates.includes(dayKey()));
  const finished = missions.filter((m) => !m.daily && m.doneDates.length > 0 && !m.doneDates.includes(dayKey()));
  const xpToday = done.reduce((n, m) => n + m.xp, 0);

  return (
    <div className="space-y-5">
      <PageTitle
        title="Missões"
        subtitle="Conclua as missões do dia para ganhar XP e subir as áreas da vida."
        actions={<Button onClick={() => setModal({ open: true, editing: null })}><Plus size={16} /> Nova missão</Button>}
      />
      <Panel icon={ListChecks} title="Hoje" subtitle={`${done.length} de ${today.length} concluídas · +${xpToday} XP ganhos hoje`}>
        {today.length ? (
          <ul className="space-y-2">
            {today.map((m) => <MissionRow key={m.id} m={m} onEdit={() => setModal({ open: true, editing: m })} />)}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-text-muted">Nenhuma missão. Crie a primeira!</p>
        )}
      </Panel>
      {finished.length > 0 && (
        <Panel title="Concluídas (uma vez)">
          <ul className="space-y-2">
            {finished.map((m) => <MissionRow key={m.id} m={m} locked onEdit={() => setModal({ open: true, editing: m })} />)}
          </ul>
        </Panel>
      )}
      <MissionModal open={modal.open} editing={modal.editing} onClose={() => setModal({ open: false, editing: null })} />
    </div>
  );
}
