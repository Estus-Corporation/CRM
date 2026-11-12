import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  type Collection, type CollectionKind, type Expense, type Item, type Mission, type UniverseKey, type WishCategory, type WishItem,
  UNIVERSES, dayKey, guessKind, hasStates, uid, universeStats,
} from './data';
import { idbStorage } from './idb';

export type ItemInput = Pick<Item, 'collectionId' | 'name' | 'note' | 'image' | 'status' | 'current' | 'target' | 'price' | 'link'>;
export type WishInput = Pick<WishItem, 'category' | 'name' | 'image' | 'price' | 'link' | 'note'>;
export type ExpenseInput = Pick<Expense, 'description' | 'amount' | 'date' | 'category' | 'note'>;
export type CollectionInput = Pick<Collection, 'group' | 'name' | 'kind' | 'stages'>;

interface Data {
  name: string;
  collections: Collection[];
  items: Item[];
  wishlist: WishItem[];
  expenses: Expense[];
  /** Da primeira versão, sem tela (guardado para não perder) */
  missions: Mission[];
}

interface RpgState extends Data {
  setName: (name: string) => void;
  addCollection: (universe: UniverseKey, c: CollectionInput) => string;
  updateCollection: (id: string, c: Partial<CollectionInput>) => void;
  removeCollection: (id: string) => void;
  addItem: (i: ItemInput) => void;
  updateItem: (id: string, i: Partial<ItemInput>) => void;
  /** Avança o andamento; ao bater o alvo vira "feito" */
  stepItem: (id: string, delta: number) => void;
  removeItem: (id: string) => void;

  addWish: (w: WishInput) => void;
  updateWish: (id: string, w: Partial<WishInput>) => void;
  removeWish: (id: string) => void;
  /** Marca como comprado; com valor, lança o gasto de hoje em Compras */
  buyWish: (id: string) => void;
  /** Volta para a lista (e apaga o gasto criado pela compra) */
  unbuyWish: (id: string) => void;

  addExpense: (e: ExpenseInput) => void;
  updateExpense: (id: string, e: Partial<ExpenseInput>) => void;
  removeExpense: (id: string) => void;

  importData: (raw: string) => boolean;
  exportData: () => string;
  reset: () => void;
}

const now = () => new Date().toISOString();

const seedCollections = (): Collection[] =>
  UNIVERSES.flatMap((u) => u.seeds.map(([group, name, kind]) => ({ id: uid(), universe: u.key, group, name, kind, createdAt: now() })));

const initial = (): Data => ({
  name: 'Lucca',
  collections: seedCollections(),
  items: [],
  wishlist: [],
  expenses: [],
  missions: [],
});

const clean = (i: Partial<ItemInput>): Partial<ItemInput> => ({
  ...i,
  ...(i.name !== undefined && { name: i.name.trim() }),
  ...(i.target !== undefined && { target: Math.max(1, Math.round(i.target)) }),
  ...(i.current !== undefined && { current: Math.max(0, Math.round(i.current)) }),
});

/** Ao mudar de etapa: em andamento no alvo vira feito; feito ganha data */
function transition(prev: Item, patch: Partial<ItemInput>): Item {
  let next: Item = { ...prev, ...clean(patch) };
  next.current = Math.min(next.current, next.target);
  if (next.status === 'progress' && next.current >= next.target && prev.status === 'progress' && patch.current !== undefined) next.status = 'owned';
  if (next.status === 'owned' && prev.status !== 'owned') next = { ...next, conquered: true, acquiredAt: now(), current: next.target };
  if (next.status !== 'owned') next.acquiredAt = null;
  return next;
}

/** Categoria da wishlist para um desejo antigo que estava numa coleção */
function wishCategoryFor(c: Collection | undefined): WishCategory {
  if (!c) return 'lifestyle';
  if (c.universe === 'selfcare') return c.group === 'Estilo' ? 'roupas' : 'autocuidado';
  if (c.universe === 'home') return c.name === 'Setup' ? 'tech' : 'ambiente';
  if (c.universe === 'leisure') return 'colecionaveis';
  if (c.universe === 'health') return 'fitness';
  return 'lifestyle';
}

/**
 * v5: cada coleção ganha um tipo. Desejos em coleções de "coisas" (e a antiga "Compras planejadas")
 * vão para a Wishlist; nos tipos sem etapas todo item vira "tenho".
 */
function toV5(d: Data & Record<string, any>): Data {
  const { history: _h, trophies: _t, seenAchievements: _s, celebrations: _c, totalXp: _x, universeXp: _u, ...rest } = d;
  let collections: Collection[] = (rest.collections ?? []).map((c: Collection) => ({ ...c, kind: c.kind ?? guessKind(c.universe, c.name) }));
  const planned = collections.filter((c) => c.universe === 'finance' && c.name.trim().toLowerCase() === 'compras planejadas');
  const byId = new Map(collections.map((c) => [c.id, c]));
  const plannedIds = new Set(planned.map((c) => c.id));
  const wishlist: WishItem[] = [...(rest.wishlist ?? [])];
  const items: Item[] = [];
  for (const raw of (rest.items ?? []) as Item[]) {
    const { xpAwarded: _xp, ...i } = raw as Item & { xpAwarded?: number };
    const c = byId.get(i.collectionId);
    const kind: CollectionKind = c?.kind ?? 'things';
    if (plannedIds.has(i.collectionId) || (kind === 'things' && i.status !== 'owned')) {
      wishlist.push({
        id: i.id, category: wishCategoryFor(plannedIds.has(i.collectionId) ? undefined : c), name: i.name, image: i.image, price: i.price,
        link: i.link, note: i.note, boughtAt: null, expenseId: null, createdAt: i.createdAt,
      });
      continue;
    }
    items.push(hasStates(kind) || i.status === 'owned' ? i : { ...i, status: 'owned', acquiredAt: i.acquiredAt ?? i.createdAt });
  }
  collections = collections.filter((c) => !plannedIds.has(c.id));
  return {
    name: rest.name ?? 'Lucca',
    collections,
    items,
    wishlist,
    expenses: rest.expenses ?? [],
    missions: rest.missions ?? [],
  };
}

/** v1 (áreas/metas) → formato de coleções; v2+ já tem coleções */
function migrate(old: any, version: number): Data {
  if (version >= 2) return toV5({ ...initial(), ...old, collections: old?.collections ?? initial().collections });
  const base = initial();
  const metas = base.collections.find((c) => c.universe === 'purpose' && c.name === 'Metas de vida')!;
  const items: Item[] = (old?.goals ?? []).map((g: any) => {
    const done = !!g.completedAt;
    return {
      id: g.id, collectionId: metas.id, name: g.title, note: '', image: null, status: done ? 'owned' : 'progress', current: g.current, target: g.target,
      price: null, link: '', conquered: done, acquiredAt: g.completedAt, createdAt: g.createdAt,
    };
  });
  return { ...base, name: old?.name ?? base.name, missions: old?.missions ?? [], items };
}

const DATA_KEYS: (keyof Data)[] = ['name', 'collections', 'items', 'wishlist', 'expenses', 'missions'];
const pickData = (s: RpgState): Data => Object.fromEntries(DATA_KEYS.map((k) => [k, s[k]])) as unknown as Data;

const cleanExpense = <T extends Partial<ExpenseInput>>(e: T): T => ({
  ...e,
  ...(e.description !== undefined && { description: e.description.trim() }),
  ...(e.amount !== undefined && { amount: Math.round(Math.abs(e.amount) * 100) / 100 }),
});

const cleanCollection = <T extends Partial<CollectionInput>>(c: T): T => ({
  ...c,
  ...(c.name !== undefined && { name: c.name.trim() }),
  ...(c.group !== undefined && { group: c.group.trim() }),
});

export const useRpg = create<RpgState>()(
  persist(
    (set, get) => ({
      ...initial(),

      setName: (name) => set({ name }),

      addCollection: (universe, c) => {
        const id = uid();
        set((s) => ({ collections: [...s.collections, { ...cleanCollection(c), id, universe, createdAt: now() }] }));
        return id;
      },
      updateCollection: (id, c) =>
        set((s) => {
          const prev = s.collections.find((x) => x.id === id);
          // Trocou para um tipo sem etapas: tudo vira "tenho"
          const flatten = c.kind && prev && c.kind !== prev.kind && !hasStates(c.kind);
          return {
            collections: s.collections.map((x) => (x.id === id ? { ...x, ...cleanCollection(c) } : x)),
            items: flatten ? s.items.map((i) => (i.collectionId === id ? transition(i, { status: 'owned' }) : i)) : s.items,
          };
        }),
      removeCollection: (id) =>
        set((s) => ({ collections: s.collections.filter((c) => c.id !== id), items: s.items.filter((i) => i.collectionId !== id) })),

      addItem: (input) =>
        set((s) => {
          const i = { ...input, ...clean(input) } as ItemInput;
          const item: Item = { ...i, id: uid(), current: Math.min(i.current, i.target), conquered: false, createdAt: now(), acquiredAt: i.status === 'owned' ? now() : null };
          return { items: [item, ...s.items] };
        }),
      updateItem: (id, patch) => set((s) => ({ items: s.items.map((x) => (x.id === id ? transition(x, patch) : x)) })),
      stepItem: (id, delta) =>
        set((s) => ({ items: s.items.map((x) => (x.id === id ? transition(x, { current: Math.max(0, x.current + delta) }) : x)) })),
      removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      addWish: (w) =>
        set((s) => ({ wishlist: [{ ...w, name: w.name.trim(), id: uid(), boughtAt: null, expenseId: null, createdAt: now() }, ...s.wishlist] })),
      updateWish: (id, w) =>
        set((s) => ({ wishlist: s.wishlist.map((x) => (x.id === id ? { ...x, ...w, ...(w.name !== undefined && { name: w.name.trim() }) } : x)) })),
      removeWish: (id) => set((s) => ({ wishlist: s.wishlist.filter((x) => x.id !== id) })),
      buyWish: (id) =>
        set((s) => {
          const w = s.wishlist.find((x) => x.id === id);
          if (!w || w.boughtAt) return {};
          const expense: Expense | null = w.price
            ? { id: uid(), description: w.name, amount: w.price, date: dayKey(), category: 'shopping', note: 'Da wishlist', createdAt: now() }
            : null;
          return {
            wishlist: s.wishlist.map((x) => (x.id === id ? { ...x, boughtAt: now(), expenseId: expense?.id ?? null } : x)),
            expenses: expense ? [expense, ...s.expenses] : s.expenses,
          };
        }),
      unbuyWish: (id) =>
        set((s) => {
          const w = s.wishlist.find((x) => x.id === id);
          if (!w) return {};
          return {
            wishlist: s.wishlist.map((x) => (x.id === id ? { ...x, boughtAt: null, expenseId: null } : x)),
            expenses: w.expenseId ? s.expenses.filter((e) => e.id !== w.expenseId) : s.expenses,
          };
        }),

      addExpense: (e) => set((s) => ({ expenses: [{ ...cleanExpense(e), id: uid(), createdAt: now() }, ...s.expenses] })),
      updateExpense: (id, e) => set((s) => ({ expenses: s.expenses.map((x) => (x.id === id ? { ...x, ...cleanExpense(e) } : x)) })),
      removeExpense: (id) =>
        set((s) => ({
          expenses: s.expenses.filter((x) => x.id !== id),
          wishlist: s.wishlist.map((w) => (w.expenseId === id ? { ...w, expenseId: null } : w)),
        })),

      exportData: () => JSON.stringify({ app: 'life-rpg', version: 5, exportedAt: now(), data: pickData(get()) }),
      importData: (raw) => {
        try {
          const parsed = JSON.parse(raw);
          const data = parsed?.data ?? parsed;
          if (!Array.isArray(data?.collections) || !Array.isArray(data?.items)) return false;
          set(migrate(data, 2));
          return true;
        } catch {
          return false;
        }
      },
      reset: () => set(initial()),
    }),
    {
      name: 'life-rpg',
      storage: createJSONStorage(() => idbStorage),
      version: 5,
      migrate: (old, version) => migrate(old, version),
      partialize: (s) => pickData(s),
    },
  ),
);

// Primeira visita: grava logo as coleções iniciais (senão os ids mudariam a cada recarga até a primeira edição)
useRpg.persist.onFinishHydration((s) => useRpg.setState({ name: s.name }));

/** Os dados vêm do IndexedDB (assíncrono): esperar antes de mostrar/gravar qualquer coisa */
export function useHydrated() {
  const [ok, setOk] = useState(() => useRpg.persist.hasHydrated());
  useEffect(() => {
    if (ok) return;
    const off = useRpg.persist.onFinishHydration(() => setOk(true));
    if (useRpg.persist.hasHydrated()) setOk(true);
    return off;
  }, [ok]);
  return ok;
}

/** Mês (YYYY-MM) de uma data YYYY-MM-DD */
export const monthOf = (date: string) => date.slice(0, 7);

/** Números derivados usados em várias telas */
export function useStats() {
  const s = useRpg();
  const universes = Object.fromEntries(
    UNIVERSES.map((u) => [u.key, universeStats(s.collections.filter((c) => c.universe === u.key), s.items)]),
  ) as Record<UniverseKey, ReturnType<typeof universeStats>>;
  const kindOf = new Map(s.collections.map((c) => [c.id, c.kind]));
  const sumKind = (k: CollectionKind) => s.items.filter((i) => kindOf.get(i.collectionId) === k).reduce((n, i) => n + (i.price ?? 0), 0);
  const pendingWishes = s.wishlist.filter((w) => !w.boughtAt);
  const month = dayKey().slice(0, 7);
  const monthSpent = s.expenses.filter((e) => monthOf(e.date) === month).reduce((n, e) => n + e.amount, 0);
  const monthlyIncome = sumKind('income');
  const tracked = Object.values(universes);
  return {
    things: tracked.reduce((n, u) => n + u.things, 0),
    doing: tracked.reduce((n, u) => n + u.doing, 0),
    done: tracked.reduce((n, u) => n + u.done, 0),
    wishes: pendingWishes.length,
    wishTotal: pendingWishes.reduce((n, w) => n + (w.price ?? 0), 0),
    monthSpent,
    monthlyIncome,
    monthBalance: monthlyIncome - monthSpent,
    savings: sumKind('money'),
    universes,
    lifePct: Math.round(tracked.reduce((n, u) => n + u.pct, 0) / UNIVERSES.length),
  };
}
