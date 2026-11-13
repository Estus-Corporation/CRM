import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { addMonths, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, ChevronLeft, ChevronRight, PieChart, Plus, Receipt, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { type Expense, type ExpenseCategory, EXPENSE_CATEGORIES, brl, dayKey, expenseCategoryOf, parseMoney } from '../data';
import { type ExpenseInput, monthOf, useRpg } from '../store';
import { Panel, PANEL_HEAD, ProgressBar } from '../ui';

const monthLabel = (m: string) => {
  const t = format(parseISO(`${m}-01`), 'MMMM yyyy', { locale: ptBR });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const shiftMonth = (m: string, n: number) => format(addMonths(parseISO(`${m}-01`), n), 'yyyy-MM');
const sum = (list: Expense[]) => list.reduce((n, e) => n + e.amount, 0);

function dayTitle(date: string) {
  if (date === dayKey()) return 'Hoje';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (date === dayKey(y)) return 'Ontem';
  const t = format(parseISO(date), "EEEE, d 'de' MMM", { locale: ptBR });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Financeiro → Gastos: lançamentos do mês, total, comparação e divisão por categoria */
export function ExpensesView() {
  const expenses = useRpg((s) => s.expenses);
  const [month, setMonth] = useState(() => dayKey().slice(0, 7));
  const [modal, setModal] = useState<{ open: boolean; editing: Expense | null }>({ open: false, editing: null });

  const list = expenses.filter((e) => monthOf(e.date) === month).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const total = sum(list);
  const prevTotal = sum(expenses.filter((e) => monthOf(e.date) === shiftMonth(month, -1)));
  const isCurrent = month === dayKey().slice(0, 7);
  const daysCounted = isCurrent ? new Date().getDate() : new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  const diff = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  const byCategory = EXPENSE_CATEGORIES.map((c) => ({ ...c, value: sum(list.filter((e) => e.category === c.key)) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const days = list.reduce<{ date: string; items: Expense[] }[]>((acc, e) => {
    const last = acc[acc.length - 1];
    if (last?.date === e.date) last.items.push(e);
    else acc.push({ date: e.date, items: [e] });
    return acc;
  }, []);

  const open = (editing: Expense | null = null) => setModal({ open: true, editing });

  return (
    <div className="space-y-4">
      {/* Mês + resumo */}
      <section className="rounded-[20px] border border-fg/[0.08] bg-bg-surface/70">
        <div className={cn(PANEL_HEAD, 'flex flex-wrap items-center gap-3 px-5 py-3.5')}>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mês anterior"
              className="rounded-lg p-1.5 text-text-secondary hover:bg-fg/[0.06] hover:text-text-primary"><ChevronLeft size={18} /></button>
            <span className="min-w-[150px] text-center text-[15px] font-semibold text-text-primary">{monthLabel(month)}</span>
            <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Próximo mês"
              className="rounded-lg p-1.5 text-text-secondary hover:bg-fg/[0.06] hover:text-text-primary"><ChevronRight size={18} /></button>
          </div>
          {!isCurrent && (
            <button type="button" onClick={() => setMonth(dayKey().slice(0, 7))} className="text-xs text-text-secondary hover:text-text-primary">Voltar para este mês</button>
          )}
          <Button className="ml-auto" onClick={() => open()}><Plus size={16} /> Novo gasto</Button>
        </div>

        <div className="grid grid-cols-2 gap-4 p-5 xl:grid-cols-4">
          <div className="col-span-2 xl:col-span-1">
            <p className="text-xs text-text-muted">Total do mês</p>
            <p className="mt-1 font-display text-[28px] font-semibold tabular-nums leading-none text-text-primary">{brl(total)}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Mês anterior</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-text-primary">{brl(prevTotal)}</p>
            {diff !== null && (
              <p className={cn('text-[11px] font-medium', diff > 0 ? 'text-status-lost' : 'text-accent-green')}>
                {diff > 0 ? '+' : ''}{diff}% {diff > 0 ? 'a mais' : diff < 0 ? 'a menos' : ''}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-text-muted">Média por dia</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-text-primary">{brl(total / daysCounted)}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Lançamentos</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-text-primary">{list.length}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_300px]">
        <Panel icon={Receipt} title="Lançamentos" subtitle={list.length ? 'Clique num gasto para editar' : undefined}>
          {days.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-fg/[0.12] py-12 text-center">
              <p className="text-sm text-text-secondary">Nenhum gasto em {monthLabel(month).toLowerCase()}.</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => open()}><Plus size={14} /> Lançar gasto</Button>
            </div>
          ) : (
            <div className="space-y-5">
              {days.map((d) => (
                <div key={d.date}>
                  <div className="mb-1.5 flex items-baseline justify-between px-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{dayTitle(d.date)}</p>
                    <p className="text-xs tabular-nums text-text-muted">{brl(sum(d.items))}</p>
                  </div>
                  <ul className="space-y-0.5">
                    <AnimatePresence initial={false}>
                      {d.items.map((e) => {
                        const c = expenseCategoryOf(e.category);
                        return (
                          <motion.li key={e.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <button type="button" onClick={() => open(e)}
                              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-fg/[0.04]">
                              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-fg/[0.06] text-text-secondary">
                                <c.icon size={16} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm text-text-primary">{e.description}</span>
                                <span className="block truncate text-xs text-text-muted">{c.label}{e.note ? ` · ${e.note}` : ''}</span>
                              </span>
                              <span className="text-sm font-semibold tabular-nums text-text-primary">{brl(e.amount)}</span>
                            </button>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel icon={PieChart} title="Por categoria">
          {byCategory.length ? (
            <ul className="space-y-3.5">
              {byCategory.map((c) => (
                <li key={c.key}>
                  <div className="mb-1.5 flex items-center gap-2 text-[13px]">
                    <c.icon size={14} className="flex-shrink-0 text-text-muted" />
                    <span className="min-w-0 flex-1 truncate text-text-secondary">{c.label}</span>
                    <span className="tabular-nums text-text-primary">{brl(c.value)}</span>
                    <span className="w-9 text-right text-[11px] tabular-nums text-text-muted">{Math.round((c.value / total) * 100)}%</span>
                  </div>
                  <ProgressBar value={c.value} max={byCategory[0].value} tone="white" className="h-1.5" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-text-muted">Os gastos do mês aparecem aqui divididos por categoria.</p>
          )}
        </Panel>
      </div>

      <ExpenseModal open={modal.open} editing={modal.editing} month={month} onClose={() => setModal({ open: false, editing: null })} />
    </div>
  );
}

function ExpenseModal({ open, editing, month, onClose }: { open: boolean; editing: Expense | null; month: string; onClose: () => void }) {
  const { addExpense, updateExpense, removeExpense } = useRpg();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(dayKey());
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const key = open ? editing?.id ?? 'new' : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (open) {
      setDescription(editing?.description ?? '');
      setAmount(editing ? String(editing.amount).replace('.', ',') : '');
      // Novo gasto num mês passado/futuro: começa no dia 1 daquele mês
      setDate(editing?.date ?? (month === dayKey().slice(0, 7) ? dayKey() : `${month}-01`));
      setCategory(editing?.category ?? 'food');
      setNote(editing?.note ?? '');
      setConfirm(false);
    }
  }

  const value = parseMoney(amount);
  const valid = description.trim() && value != null && value > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const save = () => {
    if (!valid) return;
    const input: ExpenseInput = { description, amount: value!, date, category, note: note.trim() };
    if (editing) updateExpense(editing.id, input);
    else addExpense(input);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar gasto' : 'Novo gasto'} className="max-w-lg">
      <div className="space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Descrição</label>
            <input autoFocus value={description} onChange={(e) => setDescription(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()}
              maxLength={80} placeholder="Ex.: Mercado" className="input-base h-10 w-full text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Valor</label>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="R$ 0,00" className="input-base h-10 w-full text-sm tabular-nums" />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Categoria</label>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
            {EXPENSE_CATEGORIES.map((c) => (
              <button key={c.key} type="button" onClick={() => setCategory(c.key)}
                className={cn('flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-medium transition-colors max-sm:flex-row max-sm:justify-center max-sm:gap-1.5',
                  category === c.key ? 'border-accent-green/50 bg-accent-green/15 text-accent-green' : 'border-fg/[0.1] text-text-secondary hover:bg-fg/[0.05]')}>
                <c.icon size={15} /> {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-base h-10 w-full text-sm [color-scheme:dark]" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Anotação (opcional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} className="input-base h-10 w-full text-sm" />
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-fg/[0.06] pt-4">
          {editing && (confirm ? (
            <Button variant="danger" onClick={() => { removeExpense(editing.id); onClose(); }}>Excluir gasto</Button>
          ) : (
            <Button variant="secondary" onClick={() => setConfirm(true)} aria-label="Excluir gasto"><Trash2 size={15} /></Button>
          ))}
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={save} disabled={!valid}>{editing ? <><Check size={15} /> Salvar</> : 'Lançar'}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
