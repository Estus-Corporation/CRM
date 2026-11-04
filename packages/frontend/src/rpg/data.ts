import type { LucideIcon } from 'lucide-react';
import {
  Apple, BedDouble, Brain, Briefcase, Coffee, Droplets, Dumbbell, Flame, Gem, Heart, HeartPulse, Medal, Repeat,
  Scale, Sparkles, Star, Target, Trophy, Wallet, Zap, BookOpen, Crown, Shield, Sunrise,
} from 'lucide-react';

// ── Tipos ───────────────────────────────────────────────────────────────────

export type AreaKey = 'health' | 'intellect' | 'career' | 'finance' | 'discipline' | 'personal';
export type CareKey = 'sleep' | 'food' | 'exercise' | 'mind' | 'hygiene' | 'leisure';
export type AttrKey = 'focus' | 'energy' | 'balance' | 'routine';

export interface Mission {
  id: string;
  title: string;
  xp: number;
  /** Área da vida que sobe ao concluir (+1 ponto) */
  area: AreaKey | null;
  /** Atributo que ganha o XP da missão */
  attribute: AttrKey | null;
  /** Diária: volta a ficar pendente todo dia; avulsa: some da lista de hoje depois de feita */
  daily: boolean;
  /** Dias (yyyy-MM-dd) em que foi concluída */
  doneDates: string[];
  createdAt: string;
}

export interface Goal {
  id: string;
  title: string;
  current: number;
  target: number;
  /** Ao bater a meta: XP de bônus (uma vez) */
  rewardXp: number;
  completedAt: string | null;
  createdAt: string;
}

export interface HistoryEntry {
  id: string;
  at: string;
  text: string;
  xp: number;
  kind: 'mission' | 'goal' | 'checkin' | 'level' | 'achievement';
}

// ── Catálogo ────────────────────────────────────────────────────────────────

export const AREAS: { key: AreaKey; label: string; icon: LucideIcon }[] = [
  { key: 'health', label: 'Saúde', icon: HeartPulse },
  { key: 'intellect', label: 'Intelecto', icon: Brain },
  { key: 'career', label: 'Carreira', icon: Briefcase },
  { key: 'finance', label: 'Finanças', icon: Wallet },
  { key: 'discipline', label: 'Disciplina', icon: Shield },
  { key: 'personal', label: 'Vida pessoal', icon: Heart },
];

export const CARE: { key: CareKey; label: string; icon: LucideIcon; hint: string }[] = [
  { key: 'sleep', label: 'Sono', icon: BedDouble, hint: 'Dormiu bem e no horário?' },
  { key: 'food', label: 'Alimentação', icon: Apple, hint: 'Comeu comida de verdade, sem exagero?' },
  { key: 'exercise', label: 'Exercício', icon: Dumbbell, hint: 'Mexeu o corpo hoje?' },
  { key: 'mind', label: 'Saúde mental', icon: Sparkles, hint: 'Como está a cabeça?' },
  { key: 'hygiene', label: 'Higiene', icon: Droplets, hint: 'Cuidou de você e do seu espaço?' },
  { key: 'leisure', label: 'Lazer', icon: Coffee, hint: 'Teve um tempo só seu?' },
];

export const ATTRIBUTES: { key: AttrKey; label: string; icon: LucideIcon }[] = [
  { key: 'focus', label: 'Foco', icon: Target },
  { key: 'energy', label: 'Energia', icon: Zap },
  { key: 'balance', label: 'Equilíbrio', icon: Scale },
  { key: 'routine', label: 'Rotina', icon: Repeat },
];

// ── Nível e XP ──────────────────────────────────────────────────────────────

/** XP para ir do nível n ao n+1: 250 × n (nível 12 → 13 pede 3.000) */
export const xpToNext = (level: number) => 250 * level;

/** Nível atual e o XP dentro dele a partir do XP total acumulado */
export function levelFromXp(totalXp: number) {
  let level = 1;
  let rest = Math.max(0, totalXp);
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level += 1;
  }
  return { level, inLevel: rest, needed: xpToNext(level) };
}

/** Atributos sobem de nível mais rápido: 100 × n */
export function attrLevel(xp: number) {
  let level = 1;
  let rest = Math.max(0, xp);
  while (rest >= 100 * level) {
    rest -= 100 * level;
    level += 1;
  }
  return { level, inLevel: rest, needed: 100 * level };
}

export const TITLES: [number, string][] = [
  [1, 'Aprendiz'],
  [5, 'Aventureiro'],
  [10, 'Veterano'],
  [15, 'Mestre'],
  [25, 'Lenda'],
];
export const titleFor = (level: number) => [...TITLES].reverse().find(([min]) => level >= min)?.[1] ?? 'Aprendiz';

// ── Datas ───────────────────────────────────────────────────────────────────

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Sequência de dias seguidos (até hoje ou ontem) com pelo menos uma missão feita */
export function streak(activeDays: Set<string>) {
  const d = new Date();
  if (!activeDays.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (activeDays.has(dayKey(d))) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ── Conquistas (derivadas do estado; nada é gravado à parte) ────────────────

export interface AchievementInput {
  level: number;
  totalMissions: number;
  streak: number;
  goalsDone: number;
  checkins: number;
  maxArea: number;
  maxAttrLevel: number;
  careAvg: number;
}

export const ACHIEVEMENTS: { id: string; title: string; text: string; icon: LucideIcon; test: (s: AchievementInput) => boolean }[] = [
  { id: 'first-mission', title: 'Primeiro passo', text: 'Conclua sua primeira missão', icon: Sunrise, test: (s) => s.totalMissions >= 1 },
  { id: 'missions-25', title: 'Persistente', text: 'Conclua 25 missões', icon: Medal, test: (s) => s.totalMissions >= 25 },
  { id: 'missions-100', title: 'Incansável', text: 'Conclua 100 missões', icon: Crown, test: (s) => s.totalMissions >= 100 },
  { id: 'streak-3', title: 'Aquecendo', text: '3 dias seguidos com missão feita', icon: Flame, test: (s) => s.streak >= 3 },
  { id: 'streak-7', title: 'Semana de ferro', text: '7 dias seguidos com missão feita', icon: Flame, test: (s) => s.streak >= 7 },
  { id: 'streak-30', title: 'Hábito formado', text: '30 dias seguidos com missão feita', icon: Gem, test: (s) => s.streak >= 30 },
  { id: 'level-5', title: 'Aventureiro', text: 'Chegue ao nível 5', icon: Star, test: (s) => s.level >= 5 },
  { id: 'level-10', title: 'Veterano', text: 'Chegue ao nível 10', icon: Trophy, test: (s) => s.level >= 10 },
  { id: 'goal-1', title: 'Meta batida', text: 'Conclua uma meta', icon: Target, test: (s) => s.goalsDone >= 1 },
  { id: 'goal-5', title: 'Estrategista', text: 'Conclua 5 metas', icon: BookOpen, test: (s) => s.goalsDone >= 5 },
  { id: 'checkin-7', title: 'Autoconhecimento', text: 'Faça 7 check-ins de autocuidado', icon: Heart, test: (s) => s.checkins >= 7 },
  { id: 'care-80', title: 'Bem cuidado', text: 'Média de autocuidado acima de 80%', icon: HeartPulse, test: (s) => s.careAvg >= 80 },
  { id: 'area-90', title: 'Especialista', text: 'Leve uma área da vida a 90%', icon: Sparkles, test: (s) => s.maxArea >= 90 },
  { id: 'attr-10', title: 'Atributo lendário', text: 'Leve um atributo ao nível 10', icon: Zap, test: (s) => s.maxAttrLevel >= 10 },
];
