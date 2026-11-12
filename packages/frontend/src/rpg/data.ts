import {
  Brain, Briefcase, ListChecks, NotebookPen, Package, PiggyBank, Target, TrendingUp, Car, CircleDollarSign, Coffee, Compass, Dumbbell, Gamepad2, Gem, GraduationCap, Headphones, HeartPulse, Home, Lamp,
  Receipt, Repeat, Shirt, ShoppingBag, Sparkles, Users, UtensilsCrossed, Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ── Universos da vida ───────────────────────────────────────────────────────

export type UniverseKey = 'selfcare' | 'growth' | 'career' | 'finance' | 'health' | 'relations' | 'leisure' | 'home' | 'purpose';

export interface Universe {
  key: UniverseKey;
  label: string;
  /** Linha curta (mapa e cards) */
  short: string;
  /** O que entra no universo (lista do CRM) */
  detail: string;
  icon: LucideIcon;
  /** Coleções criadas na primeira vez: [grupo, nome, tipo] (grupo vazio = sem grupo) */
  seeds: [string, string, CollectionKind][];
}

export const UNIVERSES: Universe[] = [
  {
    key: 'selfcare', label: 'Auto-Cuidado', short: 'Estilo, higiene, aparência e bem-estar', icon: Shirt,
    detail: 'Estilo (roupas, tênis, acessórios), aroma (perfumes e higiene), cuidados com pele, cabelo, aparência e rotina pessoal.',
    seeds: [['Estilo', 'Roupas', 'things'], ['Estilo', 'Tênis', 'things'], ['Estilo', 'Acessórios', 'things'], ['Aroma', 'Perfumes', 'things'], ['Aroma', 'Higiene', 'things'], ['Cuidados', 'Pele', 'notes'], ['Cuidados', 'Cabelo', 'notes'], ['Cuidados', 'Rotina pessoal', 'notes']],
  },
  {
    key: 'growth', label: 'Desenvolvimento Pessoal', short: 'Conhecimento, disciplina e habilidades', icon: Brain,
    detail: 'Habilidades que deseja aprender, idiomas, livros, comunicação, disciplina, inteligência emocional e evolução pessoal.',
    seeds: [['', 'Habilidades', 'goals'], ['', 'Idiomas', 'goals'], ['', 'Livros', 'tracker'], ['', 'Comunicação', 'goals'], ['', 'Disciplina', 'goals'], ['', 'Inteligência emocional', 'goals']],
  },
  {
    key: 'career', label: 'Carreira & Negócios', short: 'Empresas, projetos e objetivos', icon: Briefcase,
    detail: 'Empresas, desenvolvimento de software, projetos, clientes, portfólio, marketing e metas profissionais.',
    seeds: [['', 'Empresas', 'notes'], ['', 'Projetos', 'tracker'], ['', 'Clientes', 'notes'], ['', 'Portfólio', 'notes'], ['', 'Marketing', 'notes'], ['', 'Metas profissionais', 'goals']],
  },
  {
    key: 'finance', label: 'Financeiro', short: 'Dinheiro, patrimônio e planejamento', icon: Wallet,
    detail: 'Gastos do dia a dia, fontes de renda, investimentos, reservas e o patrimônio que deseja construir.',
    seeds: [['', 'Fontes de renda', 'income'], ['', 'Investimentos', 'money'], ['', 'Reservas', 'money'], ['', 'Patrimônio', 'money']],
  },
  {
    key: 'health', label: 'Saúde & Corpo', short: 'Corpo, alimentação, sono e exercícios', icon: HeartPulse,
    detail: 'Treinos, evolução física, alimentação, sono, disposição, mobilidade e acompanhamento de saúde.',
    seeds: [['', 'Treinos', 'notes'], ['', 'Evolução física', 'goals'], ['', 'Alimentação', 'notes'], ['', 'Sono', 'notes'], ['', 'Exames e saúde', 'notes']],
  },
  {
    key: 'relations', label: 'Relacionamentos', short: 'Família, amizades e vida social', icon: Users,
    detail: 'Família, amizades, relacionamento amoroso, contatos importantes, momentos especiais e experiências compartilhadas.',
    seeds: [['', 'Família', 'notes'], ['', 'Amizades', 'notes'], ['', 'Relacionamento', 'notes'], ['', 'Contatos importantes', 'notes'], ['', 'Momentos especiais', 'notes']],
  },
  {
    key: 'leisure', label: 'Lazer & Criatividade', short: 'Jogos, hobbies e entretenimento', icon: Gamepad2,
    detail: 'Mangá, desenho, jogos, animes, músicas, filmes, experiências e projetos criativos pessoais.',
    seeds: [['', 'Mangás', 'tracker'], ['', 'Desenho', 'goals'], ['', 'Jogos', 'tracker'], ['', 'Animes', 'tracker'], ['', 'Músicas', 'notes'], ['', 'Filmes', 'tracker'], ['', 'Projetos criativos', 'tracker']],
  },
  {
    key: 'home', label: 'Ambiente & Vida Prática', short: 'Casa, organização e rotina', icon: Home,
    detail: 'Casa, setup, móveis e objetos, organização, documentos e rotina do dia a dia.',
    seeds: [['', 'Casa', 'things'], ['', 'Setup', 'things'], ['', 'Organização', 'goals'], ['', 'Rotina', 'notes']],
  },
  {
    key: 'purpose', label: 'Propósito & Futuro', short: 'Sonhos, valores e conquistas', icon: Compass,
    detail: 'Sonhos, valores, metas de vida, lugares para conhecer e as grandes conquistas que marcam quem você é.',
    seeds: [['', 'Sonhos', 'goals'], ['', 'Valores', 'notes'], ['', 'Metas de vida', 'goals'], ['', 'Lugares', 'tracker'], ['', 'Grandes conquistas', 'notes']],
  },
];

export const universeOf = (key: UniverseKey) => UNIVERSES.find((u) => u.key === key)!;

// ── Coleções e itens ────────────────────────────────────────────────────────

/**
 * Situação do item. O nome mostrado depende do tipo da coleção
 * (num livro: Quero / Em andamento / Feito; numa meta: Planejado / Em andamento / Conquistado).
 */
export type ItemStatus = 'owned' | 'wish' | 'progress';

/**
 * Cada coleção tem um formato próprio (nem tudo é "inventário / desejo / evolução"):
 * - things: coisas que você tem (o que quer comprar vai para a Wishlist)
 * - tracker: lista para acompanhar (livros, jogos, lugares): quero → em andamento → feito
 * - goals: metas com progresso: planejado → em andamento → conquistado
 * - notes: registros livres (pessoas, rotinas, valores, momentos)
 * - money: saldos (investimentos, reservas, patrimônio)
 * - income: quanto entra por mês (Fontes de renda)
 */
export type CollectionKind = 'things' | 'tracker' | 'goals' | 'notes' | 'money' | 'income';

export interface KindInfo {
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Só listas e metas têm etapas */
  states?: Record<ItemStatus, string>;
  /** Nome de um item ("Novo …") */
  noun: string;
}

export const KIND_INFO: Record<CollectionKind, KindInfo> = {
  things: { label: 'Coisas que tenho', hint: 'Roupas, perfumes, setup: o que já é seu. O que você quer comprar vai para a Wishlist.', icon: Package, noun: 'item' },
  tracker: { label: 'Lista para acompanhar', hint: 'Livros, jogos, filmes, lugares: quero → em andamento → feito.', icon: ListChecks, noun: 'item', states: { wish: 'Quero', progress: 'Em andamento', owned: 'Feito' } },
  goals: { label: 'Metas', hint: 'Objetivos com progresso: planejado → em andamento → conquistado.', icon: Target, noun: 'meta', states: { wish: 'Planejado', progress: 'Em andamento', owned: 'Conquistado' } },
  notes: { label: 'Anotações', hint: 'Registros livres: pessoas, rotinas, valores, momentos.', icon: NotebookPen, noun: 'anotação' },
  money: { label: 'Valores', hint: 'Saldos que você acompanha: investimentos, reservas, patrimônio.', icon: PiggyBank, noun: 'valor' },
  income: { label: 'Renda mensal', hint: 'Quanto entra por mês. Entra no saldo do mês junto com os gastos.', icon: TrendingUp, noun: 'fonte de renda' },
};

export const KIND_ORDER: CollectionKind[] = ['things', 'tracker', 'goals', 'notes', 'money', 'income'];
export const hasStates = (k: CollectionKind) => k === 'tracker' || k === 'goals';
export const isMoney = (k: CollectionKind) => k === 'money' || k === 'income';
/** Ordem das etapas na tela */
export const STATE_ORDER: ItemStatus[] = ['wish', 'progress', 'owned'];

export interface Collection {
  id: string;
  universe: UniverseKey;
  /** Agrupador opcional (ex.: "Estilo" em Auto-Cuidado → Estilo → Tênis) */
  group: string;
  name: string;
  kind: CollectionKind;
  /** Listas e metas: modelo das etapas ('' ou ausente = pelo nome, 'default' = padrão do formato, ou id de STAGE_PRESETS) */
  stages?: string;
  createdAt: string;
}

/**
 * Nome das etapas conforme o que a lista guarda (anime = Para assistir / Assistindo / Assistidos).
 * A coleção pode escolher um modelo; sem escolha, vale o que bater com o nome dela.
 */
export interface StagePreset {
  id: string;
  label: string;
  states: Record<ItemStatus, string>;
  /** Pedaços do nome da coleção que puxam este modelo */
  match: string[];
}

export const STAGE_PRESETS: StagePreset[] = [
  { id: 'watch', label: 'Assistir', states: { wish: 'Para assistir', progress: 'Assistindo', owned: 'Assistidos' }, match: ['anime', 'filme', 'série', 'serie', 'dorama', 'documentário', 'desenho animado'] },
  { id: 'read', label: 'Ler', states: { wish: 'Para ler', progress: 'Lendo', owned: 'Lidos' }, match: ['livro', 'mangá', 'manga', 'manhwa', 'hq', 'quadrinho', 'leitura'] },
  { id: 'play', label: 'Jogar', states: { wish: 'Para jogar', progress: 'Jogando', owned: 'Zerados' }, match: ['jogo', 'game'] },
  { id: 'listen', label: 'Ouvir', states: { wish: 'Para ouvir', progress: 'Ouvindo', owned: 'Ouvidos' }, match: ['música', 'musica', 'álbum', 'album', 'podcast'] },
  { id: 'visit', label: 'Visitar', states: { wish: 'Quero ir', progress: 'Planejando', owned: 'Visitados' }, match: ['lugar', 'viage', 'destino', 'restaurante'] },
  { id: 'learn', label: 'Aprender', states: { wish: 'Quero aprender', progress: 'Aprendendo', owned: 'Aprendidos' }, match: ['idioma', 'habilidade', 'curso'] },
  { id: 'make', label: 'Fazer', states: { wish: 'Ideias', progress: 'Fazendo', owned: 'Concluídos' }, match: ['projeto', 'desenho'] },
];

/** Etapas de uma coleção: modelo escolhido → modelo pelo nome → padrão do formato */
export function stageLabels(c: Pick<Collection, 'kind' | 'name' | 'stages'>): Record<ItemStatus, string> {
  const fallback = KIND_INFO[c.kind].states ?? KIND_INFO.tracker.states!;
  if (c.stages === 'default') return fallback;
  const chosen = STAGE_PRESETS.find((p) => p.id === c.stages);
  if (chosen) return chosen.states;
  const name = c.name.toLowerCase();
  return STAGE_PRESETS.find((p) => p.match.some((m) => name.includes(m)))?.states ?? fallback;
}

export interface Item {
  id: string;
  collectionId: string;
  name: string;
  note: string;
  /** data URL (comprimida) ou URL externa */
  image: string | null;
  /** Só conta em listas e metas; nos outros tipos é sempre 'owned' */
  status: ItemStatus;
  /** Em andamento: quanto já foi (ex.: 3 de 12 capítulos, 60 de 100%) */
  current: number;
  target: number;
  /** Coisas: quanto pagou · Valores/Renda: o valor */
  price: number | null;
  link: string;
  conquered: boolean;
  /** Coisas: desde quando tem · Listas/metas: quando terminou */
  acquiredAt: string | null;
  createdAt: string;
}

/** Missões da versão anterior: ficam guardadas, mas sem tela por enquanto */
export interface Mission {
  id: string;
  title: string;
  xp: number;
  universe: UniverseKey | null;
  daily: boolean;
  doneDates: string[];
  createdAt: string;
}

// ── Progresso ───────────────────────────────────────────────────────────────

export interface CollectionStats {
  total: number;
  done: number;
  doing: number;
  todo: number;
  /** Listas e metas: % feito (em andamento conta pela fração) */
  pct: number;
  /** Valores e renda: soma */
  amount: number;
}

export function collectionStats(items: Item[]): CollectionStats {
  const done = items.filter((i) => i.status === 'owned').length;
  const doing = items.filter((i) => i.status === 'progress');
  const partial = doing.reduce((n, i) => n + Math.min(1, i.current / Math.max(1, i.target)), 0);
  const total = items.length;
  return {
    total,
    done,
    doing: doing.length,
    todo: items.filter((i) => i.status === 'wish').length,
    pct: total ? Math.round(((done + partial) / total) * 100) : 0,
    amount: items.reduce((n, i) => n + (i.price ?? 0), 0),
  };
}

export interface UniverseStats {
  /** Itens em todas as coleções */
  total: number;
  /** Coisas que tem */
  things: number;
  /** Listas e metas */
  done: number;
  doing: number;
  todo: number;
  /** % feito nas listas e metas */
  pct: number;
}

export function universeStats(collections: Collection[], items: Item[]): UniverseStats {
  const kindOf = new Map(collections.map((c) => [c.id, c.kind]));
  const mine = items.filter((i) => kindOf.has(i.collectionId));
  const tracked = collectionStats(mine.filter((i) => hasStates(kindOf.get(i.collectionId)!)));
  return {
    total: mine.length,
    things: mine.filter((i) => kindOf.get(i.collectionId) === 'things').length,
    done: tracked.done,
    doing: tracked.doing,
    todo: tracked.todo,
    pct: tracked.pct,
  };
}

/** Tipo de uma coleção antiga (sem tipo), pelo nome das coleções iniciais */
export function guessKind(universe: UniverseKey, name: string): CollectionKind {
  const seed = UNIVERSES.find((u) => u.key === universe)?.seeds.find(([, n]) => n.toLowerCase() === name.trim().toLowerCase());
  return seed?.[2] ?? 'things';
}

// ── Wishlist ────────────────────────────────────────────────────────────────

export type WishCategory = 'lifestyle' | 'fitness' | 'ambiente' | 'colecionaveis' | 'tech' | 'autocuidado' | 'roupas';

export const WISH_CATEGORIES: { key: WishCategory; label: string; icon: LucideIcon }[] = [
  { key: 'lifestyle', label: 'Lifestyle', icon: Coffee },
  { key: 'fitness', label: 'Fitness', icon: Dumbbell },
  { key: 'ambiente', label: 'Ambiente', icon: Lamp },
  { key: 'colecionaveis', label: 'Colecionáveis', icon: Gem },
  { key: 'tech', label: 'Tech & Gadgets', icon: Headphones },
  { key: 'autocuidado', label: 'Auto-Cuidado', icon: Sparkles },
  { key: 'roupas', label: 'Roupas & Acessórios', icon: Shirt },
];

export const wishCategoryOf = (key: WishCategory) => WISH_CATEGORIES.find((c) => c.key === key) ?? WISH_CATEGORIES[0];

export interface WishItem {
  id: string;
  category: WishCategory;
  name: string;
  image: string | null;
  price: number | null;
  link: string;
  note: string;
  /** Comprado: sai da lista de pendentes (e, se tinha valor, vira gasto) */
  boughtAt: string | null;
  /** Gasto criado ao marcar como comprado (para desfazer junto) */
  expenseId: string | null;
  createdAt: string;
}

// ── Gastos (Financeiro) ─────────────────────────────────────────────────────

export type ExpenseCategory = 'food' | 'transport' | 'home' | 'bills' | 'shopping' | 'leisure' | 'health' | 'education' | 'subscriptions' | 'other';

export const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string; icon: LucideIcon }[] = [
  { key: 'food', label: 'Alimentação', icon: UtensilsCrossed },
  { key: 'transport', label: 'Transporte', icon: Car },
  { key: 'home', label: 'Moradia', icon: Home },
  { key: 'bills', label: 'Contas', icon: Receipt },
  { key: 'shopping', label: 'Compras', icon: ShoppingBag },
  { key: 'leisure', label: 'Lazer', icon: Gamepad2 },
  { key: 'health', label: 'Saúde', icon: HeartPulse },
  { key: 'education', label: 'Educação', icon: GraduationCap },
  { key: 'subscriptions', label: 'Assinaturas', icon: Repeat },
  { key: 'other', label: 'Outros', icon: CircleDollarSign },
];

export const expenseCategoryOf = (key: ExpenseCategory) => EXPENSE_CATEGORIES.find((c) => c.key === key) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];

export interface Expense {
  id: string;
  description: string;
  /** Em reais */
  amount: number;
  /** YYYY-MM-DD (dia local) */
  date: string;
  category: ExpenseCategory;
  note: string;
  createdAt: string;
}

/** "1.234,56" / "1234.56" / "50" → número (ou null) */
export function parseMoney(raw: string): number | null {
  const t = raw.replace(/[^\d.,-]/g, '');
  if (!t) return null;
  const thousands = t.includes(',') || /^\d{1,3}(\.\d{3})+$/.test(t);
  const n = Number(thousands ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : null;
}

// ── Datas e utilidades ──────────────────────────────────────────────────────

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: n % 1 ? 2 : 0 });
