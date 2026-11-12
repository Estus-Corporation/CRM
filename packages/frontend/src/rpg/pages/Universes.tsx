import { useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, ExternalLink, Gift, ImagePlus, Link2, Minus, Pencil, Play, Plus, Receipt, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import {
  type Collection, type CollectionKind, type Item, type ItemStatus, type Universe, type UniverseKey,
  KIND_INFO, KIND_ORDER, STAGE_PRESETS, STATE_ORDER, UNIVERSES, stageLabels, brl, collectionStats, hasStates, isMoney, parseMoney, universeOf,
} from '../data';
import { compressImage } from '../idb';
import { type ItemInput, useRpg, useStats } from '../store';
import { ItemImage, Panel, ProgressBar } from '../ui';
import { ExpensesView } from './Expenses';

const EXPENSES_ID = 'gastos';
const fmtDay = (iso: string) => format(new Date(iso), "d 'de' MMM yyyy", { locale: ptBR });
const FEMININE = new Set(['anotação', 'meta', 'fonte de renda']);

// ── Página do universo ──────────────────────────────────────────────────────

export function UniversePage() {
  const { key } = useParams();
  const u = UNIVERSES.find((x) => x.key === key);
  if (!u) return <Navigate to="/" replace />;
  return <UniverseView u={u} />;
}

/** Resumo no canto do cabeçalho: dinheiro no Financeiro, contagens nos outros */
function HeaderSummary({ u }: { u: Universe }) {
  const st = useStats();
  const us = st.universes[u.key];
  const tracked = us.done + us.doing + us.todo;
  const cells: { label: string; value: string | number; tone?: string }[] =
    u.key === 'finance'
      ? [
          { label: 'Renda por mês', value: brl(st.monthlyIncome) },
          { label: 'Gastos no mês', value: brl(st.monthSpent) },
          { label: 'Saldo do mês', value: brl(st.monthBalance), tone: st.monthBalance < 0 ? 'text-status-lost' : st.monthlyIncome ? 'text-accent-green' : undefined },
          { label: 'Guardado', value: brl(st.savings) },
        ]
      : [
          ...(us.things ? [{ label: 'Coisas', value: us.things }] : []),
          ...(tracked ? [{ label: 'Em andamento', value: us.doing }, { label: 'Feitos', value: us.done }, { label: 'Concluído', value: `${us.pct}%` }] : []),
          ...(!us.things && !tracked ? [{ label: 'Registros', value: us.total }] : []),
        ];
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex">
      {cells.map((c) => (
        <div key={c.label} className="min-w-0">
          <p className={cn('text-lg font-semibold tabular-nums text-text-primary', c.tone)}>{c.value}</p>
          <p className="text-[11px] text-text-muted">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

/** Número pequeno ao lado de cada coleção na lista da esquerda */
function collectionMetric(c: Collection, items: Item[]) {
  const cs = collectionStats(items);
  if (!cs.total) return '';
  if (isMoney(c.kind)) return brl(cs.amount);
  if (hasStates(c.kind)) return `${cs.pct}%`;
  return String(cs.total);
}

function UniverseView({ u }: { u: Universe }) {
  const { collections: all, items } = useRpg();
  const monthSpent = useStats().monthSpent;
  const collections = all.filter((c) => c.universe === u.key);
  const [params, setParams] = useSearchParams();
  const [colModal, setColModal] = useState<{ open: boolean; editing: Collection | null }>({ open: false, editing: null });

  const selectedId = params.get('c');
  // Financeiro: "Gastos" fica na mesma lista das coleções e abre por padrão
  const isFinance = u.key === 'finance';
  const showExpenses = isFinance && (!selectedId || selectedId === EXPENSES_ID);
  const selected =
    collections.find((c) => c.id === selectedId) ??
    collections.find((c) => items.some((i) => i.collectionId === c.id)) ??
    collections[0] ??
    null;
  const select = (id: string) => setParams({ c: id }, { replace: true });

  const groups = useMemo(() => {
    const map = new Map<string, Collection[]>();
    for (const c of collections) map.set(c.group, [...(map.get(c.group) ?? []), c]);
    return [...map.entries()];
  }, [collections]);

  const Icon = u.icon;
  const rowClass = (active: boolean) =>
    cn('flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
      active ? 'bg-fg/[0.08] text-text-primary' : 'text-text-secondary hover:bg-fg/[0.04] hover:text-text-primary');

  return (
    <div className="space-y-4">
      <section className="rounded-[22px] border border-fg/[0.08] bg-bg-surface/70 p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-fg/[0.06] text-text-primary">
              <Icon size={26} strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em] text-text-primary md:text-[28px]">{u.label}</h1>
              <p className="mt-0.5 text-sm text-text-secondary">{u.detail}</p>
            </div>
          </div>
          <HeaderSummary u={u} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Panel title={u.label} subtitle={`${collections.length + (isFinance ? 1 : 0)} coleções`} bodyClassName="px-3 pb-3"
          action={
            <button type="button" onClick={() => setColModal({ open: true, editing: null })} aria-label="Nova coleção"
              className="rounded-lg p-1.5 text-text-secondary hover:bg-fg/[0.06] hover:text-text-primary">
              <Plus size={17} />
            </button>
          }>
          <div className="space-y-3">
            {isFinance && (
              <button type="button" onClick={() => select(EXPENSES_ID)} className={rowClass(showExpenses)}>
                <Receipt size={15} className="flex-shrink-0 text-text-muted" />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">Gastos</span>
                <span className="text-[11px] tabular-nums text-text-muted">{monthSpent ? brl(monthSpent) : ''}</span>
              </button>
            )}
            {groups.map(([group, cols]) => (
              <div key={group || '_'}>
                {group && <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{group}</p>}
                <ul className="grid grid-cols-2 gap-1 lg:grid-cols-1">
                  {cols.map((c) => {
                    const KindIcon = KIND_INFO[c.kind].icon;
                    return (
                      <li key={c.id}>
                        <button type="button" onClick={() => select(c.id)} className={rowClass(!showExpenses && selected?.id === c.id)}>
                          <KindIcon size={15} className="flex-shrink-0 text-text-muted" />
                          <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{c.name}</span>
                          <span className="text-[11px] tabular-nums text-text-muted max-lg:hidden">{collectionMetric(c, items.filter((i) => i.collectionId === c.id))}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {!collections.length && !isFinance && <p className="px-2 py-6 text-center text-sm text-text-muted">Crie a primeira coleção.</p>}
          </div>
        </Panel>

        {showExpenses ? (
          <ExpensesView />
        ) : selected ? (
          <CollectionView key={selected.id} collection={selected} universe={u} onEdit={() => setColModal({ open: true, editing: selected })} />
        ) : (
          <Panel>
            <div className="py-14 text-center">
              <Icon size={30} className="mx-auto text-text-muted" />
              <p className="mt-3 text-sm text-text-secondary">Nenhuma coleção neste universo ainda.</p>
              <Button className="mt-4" onClick={() => setColModal({ open: true, editing: null })}><Plus size={16} /> Nova coleção</Button>
            </div>
          </Panel>
        )}
      </div>

      <CollectionModal
        open={colModal.open}
        editing={colModal.editing}
        universe={u.key}
        onClose={() => setColModal({ open: false, editing: null })}
        onCreated={select}
      />
    </div>
  );
}

// ── Coleção: o formato muda conforme o tipo ─────────────────────────────────

function CollectionView({ collection, universe, onEdit }: { collection: Collection; universe: Universe; onEdit: () => void }) {
  const items = useRpg((s) => s.items).filter((i) => i.collectionId === collection.id);
  const info = KIND_INFO[collection.kind];
  const cs = collectionStats(items);
  const [modal, setModal] = useState<{ open: boolean; editing: Item | null; status: ItemStatus }>({ open: false, editing: null, status: 'owned' });
  const open = (editing: Item | null = null, status: ItemStatus = 'owned') => setModal({ open: true, editing, status });
  const KindIcon = info.icon;

  return (
    <Panel bodyClassName="p-4 md:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-text-muted">
            {universe.label}{collection.group && <> <span className="mx-1">→</span> {collection.group}</>}
          </p>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
            {collection.name}
            <button type="button" onClick={onEdit} aria-label="Editar coleção" className="rounded-md p-1 text-text-muted hover:bg-fg/[0.06] hover:text-text-primary">
              <Pencil size={13} />
            </button>
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
            <KindIcon size={12} /> {info.label}
          </p>
        </div>
        <Button onClick={() => open(null, hasStates(collection.kind) ? 'wish' : 'owned')}><Plus size={16} /> Adicionar</Button>
      </div>

      <div className="mt-5">
        {hasStates(collection.kind) ? (
          <StagesBody collection={collection} items={items} universe={universe} pct={cs.pct} onOpen={open} />
        ) : items.length === 0 ? (
          <Empty text={info.hint} label={`Adicionar ${info.noun}`} onAdd={() => open()} />
        ) : collection.kind === 'things' ? (
          <ThingsBody items={items} universe={universe} onOpen={open} />
        ) : collection.kind === 'notes' ? (
          <NotesBody items={items} universe={universe} onOpen={open} />
        ) : (
          <MoneyBody items={items} income={collection.kind === 'income'} total={cs.amount} onOpen={open} />
        )}
      </div>

      <ItemModal
        open={modal.open}
        editing={modal.editing}
        collection={collection}
        defaultStatus={modal.status}
        onClose={() => setModal((m) => ({ ...m, open: false, editing: null }))}
      />
    </Panel>
  );
}

function Empty({ text, label, onAdd }: { text: string; label: string; onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-fg/[0.12] py-12 text-center">
      <p className="mx-auto max-w-xs text-sm text-text-secondary">{text}</p>
      <Button variant="secondary" size="sm" className="mt-4" onClick={onAdd}><Plus size={14} /> {label}</Button>
    </div>
  );
}

/** Coisas que tenho: galeria de fotos */
function ThingsBody({ items, universe, onOpen }: { items: Item[]; universe: Universe; onOpen: (i: Item) => void }) {
  return (
    <>
      <motion.ul layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence initial={false}>
          {items.map((i) => (
            <motion.li key={i.id} layout initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="min-w-0">
              <button type="button" onClick={() => onOpen(i)} className="group block w-full text-left">
                <ItemImage src={i.image} icon={universe.icon} className="aspect-square w-full rounded-2xl border border-fg/[0.08] transition-transform duration-300 group-hover:scale-[1.02]" />
                <p className="mt-2 truncate text-center text-[13.5px] font-medium text-text-primary">{i.name}</p>
                <p className="min-h-[16px] text-center text-xs text-text-muted">
                  {[i.price != null && brl(i.price), i.acquiredAt && `desde ${format(new Date(i.acquiredAt), 'MMM yyyy', { locale: ptBR })}`].filter(Boolean).join(' · ')}
                </p>
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
      <Link to="/wishlist" className="mt-5 flex items-center justify-center gap-1.5 text-xs text-text-muted hover:text-text-primary">
        <Gift size={13} /> Quer algo novo? Coloque na Wishlist
      </Link>
    </>
  );
}

/**
 * Listas e metas: etapas com o nome certo (Para assistir / Assistindo / Assistidos…).
 * Mostra tudo, separado por etapa; os 3 botões filtram uma etapa só (clicar de novo volta a mostrar tudo).
 */
function StagesBody({ collection, items, universe, pct, onOpen }: {
  collection: Collection; items: Item[]; universe: Universe; pct: number; onOpen: (i: Item | null, status?: ItemStatus) => void;
}) {
  const states = stageLabels(collection);
  const [filter, setFilter] = useState<ItemStatus | null>(null);
  const done = items.filter((i) => i.status === 'owned').length;
  const sections = (filter ? [filter] : STATE_ORDER).map((s) => ({
    status: s,
    list: items
      .filter((i) => i.status === s)
      .sort((a, b) => (s === 'owned' ? (b.acquiredAt ?? '').localeCompare(a.acquiredAt ?? '') : b.createdAt.localeCompare(a.createdAt))),
  }));
  const visible = filter ? sections : sections.filter((x) => x.list.length);

  return (
    <>
      {items.length > 0 && (
        <div className="mb-5 flex items-center gap-3">
          <ProgressBar value={pct} max={100} tone="white" className="flex-1" />
          <span className="text-sm tabular-nums text-text-secondary">{done}/{items.length} · {pct}%</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-fg/[0.1] bg-fg/[0.04] p-1">
        {STATE_ORDER.map((s) => {
          const count = items.filter((i) => i.status === s).length;
          const active = filter === s;
          return (
            <button key={s} type="button" onClick={() => setFilter(active ? null : s)} aria-pressed={active}
              title={active ? 'Clique de novo para ver todos' : undefined}
              className={cn('flex items-center justify-center gap-1.5 truncate rounded-lg px-2 py-2 text-[13px] font-medium transition-colors',
                active ? 'bg-accent-green text-[rgb(var(--on-accent))]' : 'text-text-secondary hover:bg-fg/[0.05] hover:text-text-primary')}>
              <span className="truncate">{states[s]}</span>
              {count > 0 && <span className={cn('text-[11px] tabular-nums', active ? 'opacity-80' : 'text-text-muted')}>{count}</span>}
            </button>
          );
        })}
      </div>
      {filter && (
        <button type="button" onClick={() => setFilter(null)} className="mt-2 text-xs text-text-muted hover:text-text-primary">Mostrar todos</button>
      )}

      <div className="mt-5 space-y-6">
        {visible.length === 0 ? (
          <Empty text={KIND_INFO[collection.kind].hint} label={`Adicionar em ${states.wish}`} onAdd={() => onOpen(null, 'wish')} />
        ) : (
          visible.map(({ status, list }) => (
            <section key={status}>
              {!filter && (
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                  {states[status]} <span className="ml-1 tabular-nums">{list.length}</span>
                </p>
              )}
              {list.length === 0 ? (
                <Empty
                  text={status === 'progress' ? 'Nada em andamento agora.' : status === 'owned' ? 'O que você terminar aparece aqui.' : KIND_INFO[collection.kind].hint}
                  label={`Adicionar em ${states[status]}`}
                  onAdd={() => onOpen(null, status)}
                />
              ) : status === 'progress' ? (
                <ProgressRows list={list} universe={universe} doneLabel={states.owned} onOpen={onOpen} />
              ) : (
                <StageCards list={list} status={status} label={states[status]} universe={universe} onOpen={onOpen} />
              )}
            </section>
          ))
        )}
      </div>
    </>
  );
}

function ProgressRows({ list, universe, doneLabel, onOpen }: { list: Item[]; universe: Universe; doneLabel: string; onOpen: (i: Item) => void }) {
  const { updateItem, stepItem } = useRpg();
  return (
    <ul className="space-y-2">
      {list.map((i) => {
        const step = i.target >= 50 ? 5 : 1;
        return (
          <motion.li layout key={i.id} className="flex items-center gap-3 rounded-2xl border border-fg/[0.08] bg-fg/[0.03] p-3">
            <button type="button" onClick={() => onOpen(i)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <ItemImage src={i.image} icon={universe.icon} className="h-12 w-12 flex-shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{i.name}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <ProgressBar value={i.current} max={i.target} className="h-1.5 flex-1" />
                  <span className="text-xs tabular-nums text-text-muted">{i.target === 100 ? `${Math.round((i.current / i.target) * 100)}%` : `${i.current}/${i.target}`}</span>
                </div>
              </div>
            </button>
            <div className="flex flex-shrink-0 gap-1">
              <button type="button" onClick={() => stepItem(i.id, -step)} disabled={i.current === 0} aria-label="Voltar"
                className="rounded-lg border border-fg/[0.1] p-1.5 text-text-secondary hover:bg-fg/[0.06] disabled:opacity-40"><Minus size={14} /></button>
              <button type="button" onClick={() => stepItem(i.id, step)} aria-label="Avançar"
                className="rounded-lg border border-fg/[0.1] p-1.5 text-text-secondary hover:bg-fg/[0.06]"><Plus size={14} /></button>
              <button type="button" onClick={() => updateItem(i.id, { status: 'owned' })} aria-label={doneLabel} title={doneLabel}
                className="rounded-lg bg-accent-green/15 p-1.5 text-accent-green hover:bg-accent-green/25"><Check size={14} /></button>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}

function StageCards({ list, status, label, universe, onOpen }: { list: Item[]; status: ItemStatus; label: string; universe: Universe; onOpen: (i: Item) => void }) {
  const updateItem = useRpg((s) => s.updateItem);
  return (
    <motion.ul layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <AnimatePresence initial={false}>
        {list.map((i) => (
          <motion.li key={i.id} layout initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="min-w-0">
            <button type="button" onClick={() => onOpen(i)} className="group block w-full text-left">
              <ItemImage src={i.image} icon={universe.icon} className="aspect-[3/4] w-full rounded-2xl border border-fg/[0.08] transition-transform duration-300 group-hover:scale-[1.02]" />
              <p className="mt-2 truncate text-center text-[13.5px] font-medium text-text-primary">{i.name}</p>
              <p className="text-center text-xs text-text-muted">{status === 'owned' && i.acquiredAt ? fmtDay(i.acquiredAt) : label}</p>
            </button>
            {status === 'wish' && (
              <button type="button" onClick={() => updateItem(i.id, { status: 'progress' })}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-fg/[0.06] py-1.5 text-xs font-semibold text-text-primary transition-colors hover:bg-fg/[0.1]">
                <Play size={12} /> Começar
              </button>
            )}
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}

/** Anotações: cartões de texto (foto opcional) */
function NotesBody({ items, universe, onOpen }: { items: Item[]; universe: Universe; onOpen: (i: Item) => void }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((i) => (
        <motion.li layout key={i.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <button type="button" onClick={() => onOpen(i)}
            className="flex h-full w-full gap-3 rounded-2xl border border-fg/[0.08] bg-fg/[0.03] p-3.5 text-left transition-colors hover:bg-fg/[0.06]">
            {i.image && <ItemImage src={i.image} icon={universe.icon} className="h-14 w-14 flex-shrink-0 rounded-xl" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-text-primary">{i.name}</span>
              {i.note && <span className="mt-1 line-clamp-3 block whitespace-pre-line text-[13px] text-text-secondary">{i.note}</span>}
              <span className="mt-2 block text-[11px] text-text-muted">{fmtDay(i.createdAt)}</span>
            </span>
          </button>
        </motion.li>
      ))}
    </ul>
  );
}

/** Valores e renda: lista com total */
function MoneyBody({ items, income, total, onOpen }: { items: Item[]; income: boolean; total: number; onOpen: (i: Item) => void }) {
  const sorted = [...items].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  return (
    <>
      <div className="mb-4 rounded-2xl border border-fg/[0.08] bg-fg/[0.03] p-4">
        <p className="text-xs text-text-muted">{income ? 'Entra por mês' : 'Total'}</p>
        <p className="mt-1 font-display text-[26px] font-semibold tabular-nums leading-none text-text-primary">{brl(total)}</p>
      </div>
      <ul className="space-y-0.5">
        {sorted.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => onOpen(i)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-fg/[0.04]">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-text-primary">{i.name}</span>
                {i.note && <span className="block truncate text-xs text-text-muted">{i.note}</span>}
              </span>
              <span className="text-sm font-semibold tabular-nums text-text-primary">
                {brl(i.price ?? 0)}{income && <span className="text-xs font-normal text-text-muted">/mês</span>}
              </span>
              {total > 0 && <span className="w-10 text-right text-[11px] tabular-nums text-text-muted">{Math.round(((i.price ?? 0) / total) * 100)}%</span>}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

// ── Modais ──────────────────────────────────────────────────────────────────

function CollectionModal({ open, editing, universe, onClose, onCreated }: {
  open: boolean; editing: Collection | null; universe: UniverseKey; onClose: () => void; onCreated: (id: string) => void;
}) {
  const { collections, items, addCollection, updateCollection, removeCollection } = useRpg();
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [kind, setKind] = useState<CollectionKind>('things');
  const [stages, setStages] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const key = open ? editing?.id ?? 'new' : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (open) {
      setName(editing?.name ?? '');
      setGroup(editing?.group ?? '');
      setKind(editing?.kind ?? 'things');
      setStages(editing?.stages ?? '');
      setConfirm(false);
    }
  }
  const groups = [...new Set(collections.filter((c) => c.universe === universe && c.group).map((c) => c.group))];
  const losesStages = !!editing && hasStates(editing.kind) && !hasStates(kind) && items.some((i) => i.collectionId === editing.id && i.status !== 'owned');
  const save = () => {
    if (!name.trim()) return;
    if (editing) updateCollection(editing.id, { name, group, kind, stages });
    else onCreated(addCollection(universe, { name, group, kind, stages }));
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar coleção' : 'Nova coleção'} description={`Uma parte de ${universeOf(universe).label}.`} className="max-w-lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Nome</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} maxLength={40} placeholder="Ex.: Tênis" className="input-base h-10 w-full text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Grupo (opcional)</label>
            <input value={group} onChange={(e) => setGroup(e.target.value)} list="rpg-groups" maxLength={30} placeholder="Ex.: Estilo" className="input-base h-10 w-full text-sm" />
            <datalist id="rpg-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Formato</label>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {KIND_ORDER.map((k) => {
              const info = KIND_INFO[k];
              return (
                <button key={k} type="button" onClick={() => setKind(k)}
                  className={cn('flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors',
                    kind === k ? 'border-accent-green/50 bg-accent-green/10' : 'border-fg/[0.1] hover:bg-fg/[0.04]')}>
                  <info.icon size={16} className={cn('mt-0.5 flex-shrink-0', kind === k ? 'text-accent-green' : 'text-text-secondary')} />
                  <span className="min-w-0">
                    <span className={cn('block text-[13px] font-semibold', kind === k ? 'text-text-primary' : 'text-text-secondary')}>{info.label}</span>
                    <span className="block text-[11px] leading-snug text-text-muted">{info.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {hasStates(kind) && (
            <div className="mt-3">
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">Nome das etapas</label>
              <select value={stages} onChange={(e) => setStages(e.target.value)} className="input-base h-10 w-full text-sm">
                <option value="">Automático pelo nome ({Object.values(stageLabels({ kind, name, stages: '' })).join(' / ')})</option>
                {STAGE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}: {Object.values(p.states).join(' / ')}</option>)}
                <option value="default">Padrão: {Object.values(KIND_INFO[kind].states!).join(' / ')}</option>
              </select>
            </div>
          )}
          {losesStages && <p className="mt-2 text-xs text-accent-amber">Os itens que ainda não foram concluídos passam a contar como feitos.</p>}
        </div>
        <div className="flex items-center gap-2 border-t border-fg/[0.06] pt-4">
          {editing && (confirm ? (
            <Button variant="danger" onClick={() => { removeCollection(editing.id); onClose(); }}>Excluir com os itens</Button>
          ) : (
            <Button variant="secondary" onClick={() => setConfirm(true)} aria-label="Excluir coleção"><Trash2 size={15} /></Button>
          ))}
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={save} disabled={!name.trim()}>{editing ? 'Salvar' : 'Criar'}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

type ItemDraft = Omit<ItemInput, 'price'> & { price: string };

const emptyDraft = (collectionId: string, status: ItemStatus): ItemDraft => ({
  collectionId, name: '', note: '', image: null, status, current: 0, target: 100, price: '', link: '',
});

/** Campos do formulário por formato */
const FORM: Record<CollectionKind, { name: string; placeholder: string; price?: string; photo: boolean; link: boolean }> = {
  things: { name: 'Nome', placeholder: 'Ex.: Air Force 1 branco', price: 'Quanto pagou', photo: true, link: true },
  tracker: { name: 'Nome', placeholder: 'Ex.: Duna', photo: true, link: true },
  goals: { name: 'Meta', placeholder: 'Ex.: Falar inglês fluente', photo: true, link: false },
  notes: { name: 'Título', placeholder: 'Ex.: Aniversário da mãe', photo: true, link: false },
  money: { name: 'Nome', placeholder: 'Ex.: Tesouro Selic', price: 'Valor', photo: false, link: false },
  income: { name: 'Fonte', placeholder: 'Ex.: Salário', price: 'Valor por mês', photo: false, link: false },
};

function ItemModal({ open, editing, collection, defaultStatus, onClose }: {
  open: boolean; editing: Item | null; collection: Collection; defaultStatus: ItemStatus; onClose: () => void;
}) {
  const { collections, addItem, updateItem, removeItem } = useRpg();
  const [d, setD] = useState<ItemDraft>(() => emptyDraft(collection.id, defaultStatus));
  const [urlMode, setUrlMode] = useState(false);
  const [loadingImg, setLoadingImg] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const key = open ? editing?.id ?? `new-${defaultStatus}` : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (open) {
      setD(editing ? { ...editing, price: editing.price != null ? String(editing.price).replace('.', ',') : '' } : emptyDraft(collection.id, defaultStatus));
      setUrlMode(false);
      setConfirm(false);
    }
  }
  const kind = collection.kind;
  const info = KIND_INFO[kind];
  const form = FORM[kind];
  const states = hasStates(kind) ? stageLabels(collection) : null;
  // Pode trocar de coleção, mas só para outra do mesmo formato
  const cols = collections.filter((c) => c.universe === collection.universe && c.kind === kind);

  const takeFile = async (file: Blob | null | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setLoadingImg(true);
    try {
      const image = await compressImage(file);
      setD((x) => ({ ...x, image }));
    } finally {
      setLoadingImg(false);
    }
  };
  const onPaste = (e: ClipboardEvent) => {
    const file = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'))?.getAsFile();
    if (file) {
      e.preventDefault();
      void takeFile(file);
    }
  };

  const price = parseMoney(d.price);
  const valid = !!d.name.trim() && (!isMoney(kind) || (price != null && price >= 0));
  const save = () => {
    if (!valid) return;
    const input: ItemInput = { ...d, price, status: hasStates(kind) ? d.status : 'owned' };
    if (editing) updateItem(editing.id, input);
    else addItem(input);
    onClose();
  };

  const pill = (active: boolean) =>
    cn('rounded-xl border px-3 py-2 text-xs font-medium transition-colors', active ? 'border-accent-green/50 bg-accent-green/15 text-accent-green' : 'border-fg/[0.1] text-text-secondary hover:bg-fg/[0.05]');
  const title = editing ? `Editar ${info.noun}` : `${FEMININE.has(info.noun) ? 'Nova' : 'Novo'} ${info.noun}`;

  return (
    <Modal open={open} onClose={onClose} title={title} description={`${collection.name} · ${info.label}`} className="max-w-lg">
      <div className="space-y-4" onPaste={onPaste}>
        {form.photo && (
          <div className="flex gap-4">
            <button type="button" onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void takeFile(e.dataTransfer.files[0]); }}
              className="relative flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-fg/[0.18] bg-fg/[0.03] text-text-muted transition-colors hover:border-fg/[0.3] hover:text-text-primary">
              {d.image ? <img src={d.image} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={22} />}
              {loadingImg && <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white">Carregando…</span>}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void takeFile(e.target.files?.[0]); e.target.value = ''; }} />
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 text-xs text-text-muted">
              <p>Foto (opcional): clique, arraste ou cole (Ctrl+V).</p>
              {urlMode ? (
                <input autoFocus placeholder="https://…" defaultValue={d.image?.startsWith('http') ? d.image : ''}
                  onBlur={(e) => setD({ ...d, image: e.target.value.trim() || d.image })} className="input-base h-9 w-full text-xs" />
              ) : (
                <button type="button" onClick={() => setUrlMode(true)} className="flex w-fit items-center gap-1 text-text-secondary hover:text-text-primary">
                  <Link2 size={13} /> Usar link da imagem
                </button>
              )}
              {d.image && (
                <button type="button" onClick={() => setD({ ...d, image: null })} className="flex w-fit items-center gap-1 text-text-secondary hover:text-status-lost">
                  <X size={13} /> Tirar foto
                </button>
              )}
            </div>
          </div>
        )}

        <div className={cn('grid gap-3', form.price && 'grid-cols-[minmax(0,1fr)_140px]')}>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">{form.name}</label>
            <input autoFocus={!editing} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()}
              maxLength={80} placeholder={form.placeholder} className="input-base h-10 w-full text-sm" />
          </div>
          {form.price && (
            <div>
              <label className="mb-1.5 block truncate text-xs font-medium text-text-secondary">{form.price}</label>
              <input inputMode="decimal" value={d.price} onChange={(e) => setD({ ...d, price: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()}
                placeholder="R$ 0,00" className="input-base h-10 w-full text-sm tabular-nums" />
            </div>
          )}
        </div>

        {states && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Etapa</label>
            <div className="grid grid-cols-3 gap-2">
              {(['wish', 'progress', 'owned'] as ItemStatus[]).map((s) => (
                <button key={s} type="button" onClick={() => setD({ ...d, status: s })} className={pill(d.status === s)}>{states[s]}</button>
              ))}
            </div>
          </div>
        )}

        {states && d.status === 'progress' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">Onde está</label>
              <input type="number" min={0} value={d.current} onChange={(e) => setD({ ...d, current: Number(e.target.value) })} className="input-base h-10 w-full text-sm" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">Alvo (100 = porcentagem)</label>
              <input type="number" min={1} value={d.target} onChange={(e) => setD({ ...d, target: Number(e.target.value) })} className="input-base h-10 w-full text-sm" />
            </div>
          </div>
        )}

        {cols.length > 1 && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Coleção</label>
            <select value={d.collectionId} onChange={(e) => setD({ ...d, collectionId: e.target.value })} className="input-base h-10 w-full text-sm">
              {cols.map((c) => <option key={c.id} value={c.id}>{c.group ? `${c.group} › ` : ''}{c.name}</option>)}
            </select>
          </div>
        )}

        {form.link && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Link (opcional)</label>
            <div className="flex gap-2">
              <input value={d.link} onChange={(e) => setD({ ...d, link: e.target.value })} placeholder={kind === 'things' ? 'Onde comprou, referência…' : 'Onde encontrar, referência…'} className="input-base h-10 w-full text-sm" />
              {/^https?:\/\//.test(d.link) && (
                <a href={d.link} target="_blank" rel="noreferrer" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-fg/[0.1] text-text-secondary hover:text-text-primary">
                  <ExternalLink size={15} />
                </a>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">{kind === 'notes' ? 'Texto' : 'Anotação (opcional)'}</label>
          <textarea value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} rows={kind === 'notes' ? 6 : 2} maxLength={kind === 'notes' ? 3000 : 500}
            className="input-base w-full resize-none py-2 text-sm" />
        </div>

        <div className="flex items-center gap-2 border-t border-fg/[0.06] pt-4">
          {editing && (confirm ? (
            <Button variant="danger" onClick={() => { removeItem(editing.id); onClose(); }}>Excluir</Button>
          ) : (
            <Button variant="secondary" onClick={() => setConfirm(true)} aria-label="Excluir"><Trash2 size={15} /></Button>
          ))}
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={save} disabled={!valid || loadingImg}>{editing ? <><Check size={15} /> Salvar</> : 'Adicionar'}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
