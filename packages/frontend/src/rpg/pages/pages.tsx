import { useState } from 'react';
import { motion } from 'framer-motion';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Flag, Heart, History as HistoryIcon, Layers, Lock, Minus, Plus, RotateCcw, Sparkles, Star, Target, Trash2, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { ACHIEVEMENTS, AREAS, CARE, type CareKey, type HistoryEntry } from '../data';
import { useRpg, useStats } from '../store';
import { PageTitle, Panel, ProgressBar, RadarPanelChart, Ring, Slider } from '../ui';

// ── Áreas da vida ───────────────────────────────────────────────────────────

export function Areas() {
  const { areas, setArea } = useRpg();
  const st = useStats();
  return (
    <div className="space-y-5">
      <PageTitle title="Áreas da vida" subtitle="Dê uma nota honesta de 0 a 100 para cada área. As missões sobem esses números aos poucos." />
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel icon={Layers} title="Seu mapa" className="lg:col-span-2">
          <RadarPanelChart height={300} data={AREAS.map((a) => ({ label: a.label, value: areas[a.key] }))} />
          <div className="mt-2 flex items-center justify-center gap-4">
            <Ring value={st.areaAvg} size={84} />
            <p className="max-w-[180px] text-sm text-text-secondary">Média das seis áreas. Equilíbrio vale mais que um pico só.</p>
          </div>
        </Panel>
        <Panel title="Ajustar" subtitle="Arraste para mudar" className="lg:col-span-3">
          <ul className="space-y-5">
            {AREAS.map(({ key, label, icon: Icon }) => (
              <li key={key}>
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-fg/[0.06] text-text-primary"><Icon size={16} /></span>
                  <span className="flex-1 text-sm font-medium text-text-primary">{label}</span>
                  <span className="text-sm font-semibold tabular-nums text-text-primary">{areas[key]}%</span>
                </div>
                <Slider value={areas[key]} onChange={(v) => setArea(key, v)} />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

// ── Autocuidado (check-in diário) ───────────────────────────────────────────

export function SelfCare() {
  const { care, checkin } = useRpg();
  const st = useStats();
  const [draft, setDraft] = useState<Record<CareKey, number>>(care);
  const [saved, setSaved] = useState(false);
  const save = () => {
    checkin(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  return (
    <div className="space-y-5">
      <PageTitle title="Autocuidado" subtitle="Um check-in rápido por dia. O primeiro do dia vale +50 XP." />
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel icon={Heart} title="Como você está" className="lg:col-span-2">
          <RadarPanelChart tone="amber" height={300} data={CARE.map((c) => ({ label: c.label, value: draft[c.key] }))} />
          <div className="mt-2 flex items-center justify-center gap-4">
            <Ring value={Math.round(Object.values(draft).reduce((a, b) => a + b, 0) / 6)} tone="amber" size={84} />
            <p className="max-w-[180px] text-sm text-text-secondary">{st.checkins} check-ins feitos até hoje.</p>
          </div>
        </Panel>
        <Panel title="Check-in de hoje" subtitle={st.checkedInToday ? 'Já feito hoje — dá pra ajustar' : 'Ainda não feito hoje'} className="lg:col-span-3">
          <ul className="space-y-5">
            {CARE.map(({ key, label, icon: Icon, hint }) => (
              <li key={key}>
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-fg/[0.06] text-text-primary"><Icon size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">{label}</p>
                    <p className="truncate text-xs text-text-muted">{hint}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-text-primary">{draft[key]}%</span>
                </div>
                <Slider tone="amber" value={draft[key]} onChange={(v) => setDraft({ ...draft, [key]: v })} />
              </li>
            ))}
          </ul>
          <Button onClick={save} className="mt-6 w-full">
            {saved ? <><CheckCircle2 size={16} /> Salvo</> : st.checkedInToday ? 'Atualizar check-in' : 'Salvar check-in · +50 XP'}
          </Button>
        </Panel>
      </div>
    </div>
  );
}

// ── Metas ───────────────────────────────────────────────────────────────────

function GoalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addGoal = useRpg((s) => s.addGoal);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState(10);
  const [rewardXp, setRewardXp] = useState(300);
  const save = () => {
    if (!title.trim() || target < 1) return;
    addGoal({ title: title.trim(), target, current: 0, rewardXp });
    setTitle('');
    setTarget(10);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Nova meta" description="Algo que você completa em passos, com bônus de XP no fim.">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Meta</label>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Ler 12 livros no ano" maxLength={100} className="input-base h-10 w-full text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Quantos passos</label>
            <input type="number" min={1} max={10000} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="input-base h-10 w-full text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Bônus (XP)</label>
            <input type="number" min={0} max={10000} step={50} value={rewardXp} onChange={(e) => setRewardXp(Number(e.target.value))} className="input-base h-10 w-full text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-fg/[0.06] pt-4">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!title.trim() || target < 1}>Criar meta</Button>
        </div>
      </div>
    </Modal>
  );
}

export function Goals() {
  const { goals, stepGoal, removeGoal } = useRpg();
  const [open, setOpen] = useState(false);
  const active = goals.filter((g) => !g.completedAt);
  const done = goals.filter((g) => g.completedAt);
  return (
    <div className="space-y-5">
      <PageTitle title="Metas" subtitle="Objetivos maiores, divididos em passos." actions={<Button onClick={() => setOpen(true)}><Plus size={16} /> Nova meta</Button>} />
      {active.length === 0 && done.length === 0 ? (
        <Panel>
          <div className="py-10 text-center">
            <Flag size={28} className="mx-auto text-text-muted" />
            <p className="mt-3 text-sm text-text-secondary">Nenhuma meta ainda.</p>
            <Button onClick={() => setOpen(true)} className="mt-4"><Plus size={16} /> Criar a primeira</Button>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {[...active, ...done].map((g) => {
            const complete = !!g.completedAt;
            return (
              <motion.div layout key={g.id}>
                <Panel className={cn(complete && 'border-accent-green/30')}>
                  <div className="flex items-start gap-3">
                    <span className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl', complete ? 'bg-accent-green text-[rgb(var(--on-accent))]' : 'bg-fg/[0.06] text-text-primary')}>
                      {complete ? <Trophy size={17} /> : <Target size={17} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-text-primary">{g.title}</p>
                      <p className="mt-0.5 text-xs text-text-muted">{complete ? `Concluída em ${format(new Date(g.completedAt!), 'd MMM yyyy', { locale: ptBR })}` : `Bônus ao concluir: +${g.rewardXp} XP`}</p>
                    </div>
                    <button type="button" onClick={() => removeGoal(g.id)} aria-label="Excluir meta" className="rounded-lg p-1.5 text-text-muted hover:bg-status-lost/10 hover:text-status-lost"><Trash2 size={14} /></button>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <ProgressBar value={g.current} max={g.target} tone={complete ? 'green' : 'white'} className="flex-1" />
                    <span className="text-sm tabular-nums text-text-secondary">{g.current} / {g.target}</span>
                  </div>
                  {!complete && (
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => stepGoal(g.id, -1)} disabled={g.current === 0} aria-label="Voltar um passo"><Minus size={14} /></Button>
                      <Button size="sm" onClick={() => stepGoal(g.id, 1)}><Plus size={14} /> 1 passo</Button>
                    </div>
                  )}
                </Panel>
              </motion.div>
            );
          })}
        </div>
      )}
      <GoalModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

// ── Conquistas ──────────────────────────────────────────────────────────────

export function Achievements() {
  const { unlocked } = useStats();
  return (
    <div className="space-y-5">
      <PageTitle title="Conquistas" subtitle={`${unlocked.size} de ${ACHIEVEMENTS.length} desbloqueadas`} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {ACHIEVEMENTS.map(({ id, title, text, icon: Icon }, i) => {
          const on = unlocked.has(id);
          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i * 0.03, 0.3) } }}
              className={cn(
                'relative overflow-hidden rounded-[20px] border p-4 text-center',
                on ? 'border-accent-amber/35 bg-gradient-to-b from-accent-amber/[0.12] to-bg-surface/70' : 'border-fg/[0.07] bg-bg-surface/50',
              )}
            >
              <span className={cn('mx-auto flex h-12 w-12 items-center justify-center rounded-2xl', on ? 'bg-accent-amber text-[#1a1203] shadow-[0_10px_24px_-10px_rgb(var(--accent-amber)/0.8)]' : 'bg-fg/[0.05] text-text-muted')}>
                {on ? <Icon size={22} /> : <Lock size={18} />}
              </span>
              <p className={cn('mt-3 text-sm font-semibold', on ? 'text-text-primary' : 'text-text-secondary')}>{title}</p>
              <p className="mt-1 text-xs text-text-muted">{text}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Histórico ───────────────────────────────────────────────────────────────

const KIND_ICON: Record<HistoryEntry['kind'], typeof Star> = { mission: CheckCircle2, goal: Target, checkin: Heart, level: Star, achievement: Trophy };

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  return format(d, "EEEE, d 'de' MMMM", { locale: ptBR });
}

export function History() {
  const history = useRpg((s) => s.history);
  const groups = history.reduce<{ label: string; items: HistoryEntry[] }[]>((acc, h) => {
    const label = dayLabel(h.at);
    const last = acc[acc.length - 1];
    if (last?.label === label) last.items.push(h);
    else acc.push({ label, items: [h] });
    return acc;
  }, []);
  return (
    <div className="space-y-5">
      <PageTitle title="Histórico" subtitle="Tudo o que você conquistou, do mais recente ao mais antigo." />
      {groups.length === 0 ? (
        <Panel>
          <div className="py-10 text-center">
            <HistoryIcon size={28} className="mx-auto text-text-muted" />
            <p className="mt-3 text-sm text-text-secondary">Nada por aqui ainda. Conclua uma missão!</p>
          </div>
        </Panel>
      ) : (
        groups.map((g) => {
          const xp = g.items.reduce((n, h) => n + h.xp, 0);
          return (
            <Panel key={g.label} title={g.label.charAt(0).toUpperCase() + g.label.slice(1)} subtitle={`+${xp.toLocaleString('pt-BR')} XP`}>
              <ul className="space-y-1">
                {g.items.map((h) => {
                  const Icon = KIND_ICON[h.kind];
                  return (
                    <li key={h.id} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm">
                      <Icon size={16} className={h.kind === 'level' ? 'text-accent-amber' : 'text-accent-green'} />
                      <span className="min-w-0 flex-1 truncate text-text-primary">{h.text}</span>
                      <span className="text-xs tabular-nums text-text-muted">{format(new Date(h.at), 'HH:mm')}</span>
                      {h.xp > 0 && <span className="w-16 text-right text-xs font-semibold tabular-nums text-text-secondary">+{h.xp} XP</span>}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          );
        })
      )}
    </div>
  );
}

// ── Configurações ───────────────────────────────────────────────────────────

export function Settings() {
  const { name, setName, reset } = useRpg();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="max-w-xl space-y-5">
      <PageTitle title="Configurações" />
      <Panel icon={Sparkles} title="Personagem">
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Nome</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="input-base h-10 w-full text-sm" />
        <p className="mt-2 text-xs text-text-muted">Os dados ficam salvos só neste navegador.</p>
      </Panel>
      <Panel icon={RotateCcw} title="Recomeçar" subtitle="Apaga XP, missões, metas e histórico deste navegador.">
        {confirm ? (
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => { reset(); setConfirm(false); }}>Apagar tudo</Button>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Cancelar</Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirm(true)}>Recomeçar do zero</Button>
        )}
      </Panel>
    </div>
  );
}
