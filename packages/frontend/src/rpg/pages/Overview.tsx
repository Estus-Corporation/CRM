import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, Check, Flag, Flame, Heart, Layers, ListChecks, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AREAS, ATTRIBUTES, CARE, dayKey, titleFor } from '../data';
import { useRpg, useStats } from '../store';
import { Panel, PercentList, ProgressBar, RadarPanelChart, Ring } from '../ui';
import { todaysMissions } from './Missions';

export function Overview() {
  const s = useRpg();
  const st = useStats();
  const today = dayKey();
  const missions = todaysMissions(s.missions).slice(0, 5);
  const goal = s.goals.find((g) => !g.completedAt);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Herói: nome, nível e XP */}
      <section className="relative overflow-hidden rounded-[22px] border border-fg/[0.08] bg-gradient-to-br from-accent-green/[0.1] via-bg-surface/70 to-bg-surface/70 p-5 md:p-6 lg:col-span-12">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent-green/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-x-10 gap-y-4">
          <div className="min-w-0">
            <h1 className="font-display text-[26px] font-semibold tracking-[-0.01em] text-text-primary md:text-[30px]">{s.name}</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Nível {st.level} <span className="mx-1.5 text-text-muted">·</span> {titleFor(st.level)}
            </p>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-xs text-text-muted">Sequência</p>
              <p className="mt-0.5 flex items-center gap-1.5 font-semibold text-text-primary">
                <Flame size={15} className="text-accent-amber" />
                {st.streak} {st.streak === 1 ? 'dia' : 'dias'}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Missões feitas</p>
              <p className="mt-0.5 font-semibold tabular-nums text-text-primary">{st.totalMissions}</p>
            </div>
          </div>
          <div className="min-w-[220px] flex-1">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="font-medium text-text-secondary">XP</span>
              <span className="tabular-nums text-text-secondary">
                {st.inLevel.toLocaleString('pt-BR')} / {st.needed.toLocaleString('pt-BR')}
              </span>
            </div>
            <ProgressBar value={st.inLevel} max={st.needed} tone="white" className="h-2.5" />
          </div>
        </div>
      </section>

      <Panel icon={Layers} title="Áreas da vida" subtitle="Seu progresso nas principais áreas" className="lg:col-span-4"
        action={<Link to="/areas" className="text-xs font-medium text-accent-green hover:underline">Ajustar</Link>}>
        <RadarPanelChart data={AREAS.map((a) => ({ label: a.label, value: s.areas[a.key] }))} />
      </Panel>

      <Panel icon={Heart} title="Autocuidado" subtitle="Seu bem-estar físico e mental" className="lg:col-span-4"
        action={
          <Link to="/autocuidado" className={cn('text-xs font-medium hover:underline', st.checkedInToday ? 'text-text-muted' : 'text-accent-amber')}>
            {st.checkedInToday ? 'Check-in feito' : 'Fazer check-in'}
          </Link>
        }>
        <RadarPanelChart tone="amber" data={CARE.map((c) => ({ label: c.label, value: s.care[c.key] }))} />
      </Panel>

      <div className="grid gap-4 lg:col-span-4">
        <Panel icon={BarChart3} title="Progresso geral">
          <div className="flex items-center gap-5">
            <Ring value={st.areaAvg} />
            <PercentList items={AREAS.map((a) => ({ label: a.label, value: s.areas[a.key], icon: a.icon }))} />
          </div>
        </Panel>
        <Panel icon={Heart} title="Autocuidado">
          <div className="flex items-center gap-5">
            <Ring value={st.careAvg} tone="amber" />
            <PercentList items={CARE.map((c) => ({ label: c.label, value: s.care[c.key], icon: c.icon }))} />
          </div>
        </Panel>
      </div>

      <Panel icon={Zap} title="Atributos principais" className="lg:col-span-4">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          {ATTRIBUTES.map(({ key, label, icon: Icon }) => {
            const a = st.attrLevels[key];
            return (
              <div key={key} className="flex flex-col items-center rounded-2xl border border-fg/[0.08] bg-fg/[0.03] px-2 pb-3 pt-4 text-center">
                <Icon size={22} className="text-text-primary" />
                <p className="mt-2 text-sm font-semibold text-text-primary">{label}</p>
                <p className="text-xs text-text-muted">Nv. {a.level}</p>
                <ProgressBar value={a.inLevel} max={a.needed} className="mt-2.5 h-1 w-full" />
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel icon={ListChecks} title="Missões de hoje" className="lg:col-span-4"
        action={<Link to="/missoes" className="text-xs font-medium text-accent-green hover:underline">Ver todas</Link>}>
        {missions.length ? (
          <ul className="space-y-1.5">
            {missions.map((m) => {
              const done = m.doneDates.includes(today);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => s.toggleMission(m.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                      done ? 'bg-accent-green/[0.08]' : 'hover:bg-fg/[0.04]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors',
                        done ? 'border-accent-green bg-accent-green text-[rgb(var(--on-accent))]' : 'border-fg/[0.25]',
                      )}
                    >
                      {done && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                          <Check size={13} strokeWidth={3} />
                        </motion.span>
                      )}
                    </span>
                    <span className={cn('min-w-0 flex-1 truncate', done ? 'text-text-secondary line-through decoration-fg/30' : 'text-text-primary')}>{m.title}</span>
                    <span className="flex-shrink-0 text-xs tabular-nums text-text-muted">+{m.xp} XP</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-text-muted">Nenhuma missão para hoje.</p>
        )}
      </Panel>

      <Panel icon={Flag} title="Meta atual" className="lg:col-span-4"
        action={<Link to="/metas" className="text-xs font-medium text-accent-green hover:underline">Metas</Link>}>
        {goal ? (
          <div>
            <p className="text-sm text-text-secondary">{goal.title}</p>
            <div className="mt-4 flex items-center gap-3">
              <ProgressBar value={goal.current} max={goal.target} tone="white" className="flex-1" />
              <span className="text-sm tabular-nums text-text-secondary">
                {goal.current} / {goal.target}
              </span>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => s.stepGoal(goal.id, 1)} className="rounded-lg bg-accent-green/15 px-3 py-1.5 text-xs font-semibold text-accent-green hover:bg-accent-green/25">
                +1 progresso
              </button>
              <span className="self-center text-xs text-text-muted">Bônus ao concluir: +{goal.rewardXp} XP</span>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-sm text-text-muted">Nenhuma meta em andamento.</p>
            <Link to="/metas" className="mt-2 inline-block text-sm font-medium text-accent-green hover:underline">Criar uma meta</Link>
          </div>
        )}
      </Panel>
    </div>
  );
}
