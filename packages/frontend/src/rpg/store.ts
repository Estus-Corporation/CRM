import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  type AreaKey, type AttrKey, type CareKey, type Goal, type HistoryEntry, type Mission,
  ACHIEVEMENTS, attrLevel, dayKey, levelFromXp, streak, uid,
} from './data';

/**
 * Tudo do Life RPG mora no navegador (localStorage, chave `life-rpg`). Sem backend por enquanto.
 * As conquistas não são gravadas: saem do estado (ver `useStats`).
 */
interface RpgState {
  name: string;
  totalXp: number;
  areas: Record<AreaKey, number>;
  care: Record<CareKey, number>;
  /** Dias com check-in de autocuidado feito */
  checkinDays: string[];
  attrXp: Record<AttrKey, number>;
  missions: Mission[];
  goals: Goal[];
  history: HistoryEntry[];

  setName: (name: string) => void;
  setArea: (key: AreaKey, value: number) => void;
  checkin: (values: Record<CareKey, number>) => void;
  addMission: (m: Omit<Mission, 'id' | 'doneDates' | 'createdAt'>) => void;
  updateMission: (id: string, m: Partial<Omit<Mission, 'id'>>) => void;
  removeMission: (id: string) => void;
  toggleMission: (id: string) => void;
  addGoal: (g: Pick<Goal, 'title' | 'target' | 'current' | 'rewardXp'>) => void;
  updateGoal: (id: string, g: Partial<Omit<Goal, 'id'>>) => void;
  stepGoal: (id: string, delta: number) => void;
  removeGoal: (id: string) => void;
  reset: () => void;
}

const now = () => new Date().toISOString();
const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(n)));

/** Missões para começar (o usuário edita/apaga à vontade) */
const SEEDS: Pick<Mission, 'title' | 'xp' | 'area' | 'attribute'>[] = [
  { title: 'Estudar / projetar (1h)', xp: 200, area: 'intellect', attribute: 'focus' },
  { title: 'Exercício físico (30 min)', xp: 150, area: 'health', attribute: 'energy' },
  { title: 'Planejar o dia (10 min)', xp: 50, area: 'discipline', attribute: 'routine' },
  { title: 'Leitura (20 min)', xp: 100, area: 'intellect', attribute: 'balance' },
];
const STARTER_MISSIONS: Mission[] = SEEDS.map((m) => ({ ...m, id: uid(), daily: true, doneDates: [], createdAt: now() }));

const INITIAL = {
  name: 'Lucca Viganon',
  totalXp: 0,
  areas: { health: 50, intellect: 50, career: 50, finance: 50, discipline: 50, personal: 50 },
  care: { sleep: 50, food: 50, exercise: 50, mind: 50, hygiene: 50, leisure: 50 },
  checkinDays: [] as string[],
  attrXp: { focus: 0, energy: 0, balance: 0, routine: 0 },
  missions: STARTER_MISSIONS,
  goals: [] as Goal[],
  history: [] as HistoryEntry[],
};

const log = (s: RpgState, e: Omit<HistoryEntry, 'id' | 'at'>): HistoryEntry[] =>
  [{ ...e, id: uid(), at: now() }, ...s.history].slice(0, 500);

/** Ganhar/perder XP; quando sobe de nível, registra no histórico */
function withXp(s: RpgState, delta: number, history: HistoryEntry[]) {
  const before = levelFromXp(s.totalXp).level;
  const totalXp = Math.max(0, s.totalXp + delta);
  const after = levelFromXp(totalXp).level;
  const h = after > before ? [{ id: uid(), at: now(), text: `Subiu para o nível ${after}!`, xp: 0, kind: 'level' as const }, ...history] : history;
  return { totalXp, history: h };
}

export const useRpg = create<RpgState>()(
  persist(
    (set) => ({
      ...INITIAL,

      setName: (name) => set({ name }),
      setArea: (key, value) => set((s) => ({ areas: { ...s.areas, [key]: clamp(value) } })),

      checkin: (values) =>
        set((s) => {
          const today = dayKey();
          const first = !s.checkinDays.includes(today);
          const care = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, clamp(v)])) as Record<CareKey, number>;
          if (!first) return { care };
          // Primeiro check-in do dia vale XP
          const history = log(s, { text: 'Check-in de autocuidado', xp: 50, kind: 'checkin' });
          return { care, checkinDays: [...s.checkinDays, today], ...withXp(s, 50, history) };
        }),

      addMission: (m) => set((s) => ({ missions: [...s.missions, { ...m, id: uid(), doneDates: [], createdAt: now() }] })),
      updateMission: (id, m) => set((s) => ({ missions: s.missions.map((x) => (x.id === id ? { ...x, ...m } : x)) })),
      removeMission: (id) => set((s) => ({ missions: s.missions.filter((x) => x.id !== id) })),

      // Marcar/desmarcar a missão de hoje: XP no total e no atributo, +1 na área (desfaz ao desmarcar)
      toggleMission: (id) =>
        set((s) => {
          const m = s.missions.find((x) => x.id === id);
          if (!m) return {};
          const today = dayKey();
          const done = m.doneDates.includes(today);
          const sign = done ? -1 : 1;
          const missions = s.missions.map((x) =>
            x.id === id ? { ...x, doneDates: done ? x.doneDates.filter((d) => d !== today) : [...x.doneDates, today] } : x,
          );
          const attrXp = m.attribute ? { ...s.attrXp, [m.attribute]: Math.max(0, s.attrXp[m.attribute] + sign * m.xp) } : s.attrXp;
          const areas = m.area ? { ...s.areas, [m.area]: clamp(s.areas[m.area] + sign) } : s.areas;
          const history = done
            ? s.history.filter((h) => !(h.kind === 'mission' && h.text === m.title && h.at.startsWith(today)))
            : log(s, { text: m.title, xp: m.xp, kind: 'mission' });
          return { missions, attrXp, areas, ...withXp(s, sign * m.xp, history) };
        }),

      addGoal: (g) => set((s) => ({ goals: [...s.goals, { ...g, id: uid(), completedAt: null, createdAt: now() }] })),
      updateGoal: (id, g) => set((s) => ({ goals: s.goals.map((x) => (x.id === id ? { ...x, ...g } : x)) })),
      removeGoal: (id) => set((s) => ({ goals: s.goals.filter((x) => x.id !== id) })),

      // Avançar a meta; ao bater o alvo pela primeira vez, ganha o bônus
      stepGoal: (id, delta) =>
        set((s) => {
          const g = s.goals.find((x) => x.id === id);
          if (!g) return {};
          const current = Math.max(0, Math.min(g.target, g.current + delta));
          const reached = current >= g.target && !g.completedAt;
          const goals = s.goals.map((x) => (x.id === id ? { ...x, current, completedAt: reached ? now() : current < x.target ? null : x.completedAt } : x));
          if (!reached) return { goals };
          const history = log(s, { text: `Meta concluída: ${g.title}`, xp: g.rewardXp, kind: 'goal' });
          return { goals, ...withXp(s, g.rewardXp, history) };
        }),

      reset: () => set({ ...INITIAL, missions: STARTER_MISSIONS.map((m) => ({ ...m, id: uid(), doneDates: [] })) }),
    }),
    { name: 'life-rpg', storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);

/** Números derivados usados em várias telas */
export function useStats() {
  const s = useRpg();
  const lvl = levelFromXp(s.totalXp);
  const activeDays = new Set(s.missions.flatMap((m) => m.doneDates));
  const totalMissions = s.missions.reduce((n, m) => n + m.doneDates.length, 0);
  const areaAvg = Math.round(Object.values(s.areas).reduce((a, b) => a + b, 0) / 6);
  const careAvg = Math.round(Object.values(s.care).reduce((a, b) => a + b, 0) / 6);
  const attrLevels = Object.fromEntries(Object.entries(s.attrXp).map(([k, v]) => [k, attrLevel(v)])) as Record<AttrKey, ReturnType<typeof attrLevel>>;
  const input = {
    level: lvl.level,
    totalMissions,
    streak: streak(activeDays),
    goalsDone: s.goals.filter((g) => g.completedAt).length,
    checkins: s.checkinDays.length,
    maxArea: Math.max(...Object.values(s.areas)),
    maxAttrLevel: Math.max(...Object.values(attrLevels).map((a) => a.level)),
    careAvg,
  };
  const unlocked = new Set(ACHIEVEMENTS.filter((a) => a.test(input)).map((a) => a.id));
  return { ...lvl, ...input, areaAvg, attrLevels, unlocked, checkedInToday: s.checkinDays.includes(dayKey()) };
}
