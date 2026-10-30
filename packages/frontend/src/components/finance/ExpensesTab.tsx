import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Spinner } from '@/components/ui/Spinner';
import { useDeleteExpense, useExpenses, useSaveExpense } from '@/hooks/useFinance';
import { currentMonth, formatBRL, formatDate, moneyInput, parseMoney } from '@/lib/finance';
import type { ExpenseDto } from '@/services/finance.service';

const CATEGORIES = ['Aluguel', 'Software', 'Marketing', 'Folha', 'Impostos/guias', 'Outros'];
const KIND_OPTIONS = [
  { value: 'recurring' as const, label: 'Mensal' },
  { value: 'one_off' as const, label: 'Avulso' },
];

const schema = z
  .object({
    kind: z.enum(['recurring', 'one_off']),
    description: z.string().trim().min(1, 'Informe a descrição').max(160),
    category: z.string().trim().min(1, 'Informe a categoria').max(60),
    amount: z.string().refine((v) => parseMoney(v) !== null, 'Valor inválido'),
    dueDay: z.string(),
    startsOn: z.string(),
    endsOn: z.string(),
    dueDate: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'one_off') {
      if (!v.dueDate) ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Informe a data' });
      return;
    }
    const day = Number(v.dueDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) ctx.addIssue({ code: 'custom', path: ['dueDay'], message: 'Dia de 1 a 31' });
    if (!v.startsOn) ctx.addIssue({ code: 'custom', path: ['startsOn'], message: 'Informe o início' });
    if (v.endsOn && v.startsOn && v.endsOn < v.startsOn) ctx.addIssue({ code: 'custom', path: ['endsOn'], message: 'Fim antes do início' });
  });

type FormData = z.infer<typeof schema>;

const defaultsFor = (e: ExpenseDto | null): FormData => ({
  kind: e?.kind ?? 'recurring',
  description: e?.description ?? '',
  category: e?.category ?? '',
  amount: e ? moneyInput(e.amount) : '',
  dueDay: String(e?.dueDay ?? 5),
  startsOn: e?.startsOn ?? `${currentMonth()}-01`,
  endsOn: e?.endsOn ?? '',
  dueDate: e?.dueDate ?? '',
});

function ExpenseForm({ editing, onDone }: { editing: ExpenseDto | null; onDone: () => void }) {
  const save = useSaveExpense();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: defaultsFor(editing) });
  const kind = watch('kind');

  const onSubmit = (v: FormData) => {
    const base = { description: v.description, category: v.category, amount: parseMoney(v.amount)! };
    const done = { onSuccess: onDone };
    if (editing) {
      const input = editing.kind === 'recurring' ? { ...base, dueDay: Number(v.dueDay), startsOn: v.startsOn, endsOn: v.endsOn || null } : { ...base, dueDate: v.dueDate };
      save.mutate({ id: editing.id, input }, done);
    } else if (v.kind === 'recurring') {
      save.mutate({ input: { ...base, kind: 'recurring', dueDay: Number(v.dueDay), startsOn: v.startsOn, endsOn: v.endsOn || null } }, done);
    } else {
      save.mutate({ input: { ...base, kind: 'one_off', dueDate: v.dueDate } }, done);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded-xl border border-fg/[0.1] bg-fg/[0.03] p-4">
      {!editing && <SegmentedControl layoutId="finance-expense-kind" options={KIND_OPTIONS} value={kind} onChange={(k) => setValue('kind', k)} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input id="exp-description" label="Descrição" placeholder="Ex.: Aluguel do escritório" error={errors.description?.message} {...register('description')} />
        <div>
          <Input id="exp-category" label="Categoria" list="finance-categories" placeholder="Ex.: Aluguel" error={errors.category?.message} {...register('category')} />
          <datalist id="finance-categories">
            {CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <Input id="exp-amount" label="Valor (R$)" inputMode="decimal" placeholder="0,00" error={errors.amount?.message} {...register('amount')} />
        {kind === 'recurring' ? (
          <Input id="exp-day" label="Vence todo dia" type="number" min={1} max={31} error={errors.dueDay?.message} {...register('dueDay')} />
        ) : (
          <Input id="exp-date" label="Vencimento" type="date" error={errors.dueDate?.message} {...register('dueDate')} />
        )}
        {kind === 'recurring' && (
          <>
            <Input id="exp-starts" label="Começa em" type="date" error={errors.startsOn?.message} {...register('startsOn')} />
            <Input id="exp-ends" label="Termina em (opcional)" type="date" error={errors.endsOn?.message} {...register('endsOn')} />
          </>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={save.isPending}>
          {editing ? 'Salvar' : 'Adicionar gasto'}
        </Button>
      </div>
    </form>
  );
}

const scheduleOf = (e: ExpenseDto) =>
  e.kind === 'recurring' ? `Mensal, dia ${e.dueDay}${e.endsOn ? ` até ${formatDate(e.endsOn)}` : ''}` : `Avulso, ${formatDate(e.dueDate!)}`;

export function ExpensesTab() {
  const { data: expenses, isLoading } = useExpenses();
  const remove = useDeleteExpense();
  // 'new' = formulário de criação; um gasto = edição; null = só a lista
  const [editing, setEditing] = useState<ExpenseDto | 'new' | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {editing ? (
        <ExpenseForm key={editing === 'new' ? 'new' : editing.id} editing={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={() => setEditing('new')}>
          <Plus size={15} className="mr-1.5" />
          Novo gasto
        </Button>
      )}

      {expenses && expenses.length === 0 && !editing && <p className="py-4 text-center text-[13.5px] text-text-muted">Nenhum gasto cadastrado ainda.</p>}

      <ul className="divide-y divide-fg/[0.07]">
        {expenses?.map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-text-primary">{e.description}</p>
              <p className="truncate text-[12px] text-text-muted">
                {e.category} · {scheduleOf(e)}
              </p>
            </div>
            <span className="flex-shrink-0 text-[14px] font-medium tabular-nums text-text-primary">{formatBRL(e.amount)}</span>
            {confirmId === e.id ? (
              <div className="flex flex-shrink-0 items-center gap-1 text-[12.5px]">
                <span className="text-text-secondary">Excluir?</span>
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 font-medium text-status-lost hover:bg-status-lost/10"
                  onClick={() => remove.mutate(e.id, { onSettled: () => setConfirmId(null) })}
                >
                  Sim
                </button>
                <button type="button" className="rounded px-1.5 py-0.5 text-text-secondary hover:bg-fg/[0.06]" onClick={() => setConfirmId(null)}>
                  Não
                </button>
              </div>
            ) : (
              <div className="flex flex-shrink-0 items-center">
                <button type="button" aria-label="Editar gasto" className="rounded-lg p-1.5 text-text-muted hover:bg-fg/[0.06] hover:text-text-primary" onClick={() => setEditing(e)}>
                  <Pencil size={15} />
                </button>
                <button type="button" aria-label="Excluir gasto" className="rounded-lg p-1.5 text-text-muted hover:bg-status-lost/10 hover:text-status-lost" onClick={() => setConfirmId(e.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
