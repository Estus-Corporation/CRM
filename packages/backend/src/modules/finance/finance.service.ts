import { db } from '../../db';
import { calcMonth, summaryToReais, type MonthSummaryDto } from './finance.calc';
import type { CreateExpenseInput, ReplacePartnersInput, ReplaceTaxesInput, UpdateExpenseInput } from './finance.schemas';

// Datas `date` saem como texto (to_char) para não sofrerem deslocamento de fuso ao virar Date.
// Dinheiro sai do banco como string numeric e vai para a API em reais (number).

export interface ExpenseDto {
  id: string;
  description: string;
  category: string;
  amount: number;
  kind: 'recurring' | 'one_off';
  dueDay: number | null;
  startsOn: string | null;
  endsOn: string | null;
  dueDate: string | null;
}

export interface TaxDto {
  id: string;
  name: string;
  rate: number;
  isActive: boolean;
}

export interface PartnerDto {
  id: string;
  name: string;
  sharePercent: number;
  proLabore: number;
}

const fail = (status: number, message: string, code?: string) => Object.assign(new Error(message), { status, ...(code ? { code } : {}) });
const expenseNotFound = () => fail(404, 'Despesa não encontrada');

const expenseColumns = () => [
  'id',
  'description',
  'category',
  'amount',
  'kind',
  'due_day',
  db.raw("to_char(starts_on, 'YYYY-MM-DD') as starts_on"),
  db.raw("to_char(ends_on, 'YYYY-MM-DD') as ends_on"),
  db.raw("to_char(due_date, 'YYYY-MM-DD') as due_date"),
];

function toExpenseDto(row: Record<string, unknown>): ExpenseDto {
  return {
    id: row.id as string,
    description: row.description as string,
    category: row.category as string,
    amount: Number(row.amount),
    kind: row.kind as ExpenseDto['kind'],
    dueDay: (row.due_day as number | null) ?? null,
    startsOn: (row.starts_on as string | null) ?? null,
    endsOn: (row.ends_on as string | null) ?? null,
    dueDate: (row.due_date as string | null) ?? null,
  };
}

async function getExpense(tenantId: string, id: string): Promise<ExpenseDto> {
  const row = await db('finance_expenses').where({ tenant_id: tenantId, id }).select(expenseColumns()).first();
  if (!row) throw expenseNotFound();
  return toExpenseDto(row);
}

export async function listExpenses(tenantId: string): Promise<ExpenseDto[]> {
  const rows = await db('finance_expenses').where({ tenant_id: tenantId }).select(expenseColumns()).orderBy('created_at');
  return rows.map(toExpenseDto);
}

export async function createExpense(tenantId: string, input: CreateExpenseInput): Promise<ExpenseDto> {
  const common = { tenant_id: tenantId, description: input.description, category: input.category, amount: input.amount, kind: input.kind };
  const values =
    input.kind === 'recurring'
      ? { ...common, due_day: input.dueDay, starts_on: input.startsOn, ends_on: input.endsOn ?? null }
      : { ...common, due_date: input.dueDate };
  const [row] = await db('finance_expenses').insert(values).returning('id');
  return getExpense(tenantId, row.id as string);
}

export async function updateExpense(tenantId: string, id: string, patch: UpdateExpenseInput): Promise<ExpenseDto> {
  const current = await getExpense(tenantId, id);
  if (current.kind === 'recurring' && patch.dueDate !== undefined) throw fail(422, 'Gasto mensal não tem data de vencimento avulsa');
  if (current.kind === 'one_off' && (patch.dueDay !== undefined || patch.startsOn !== undefined || patch.endsOn !== undefined)) {
    throw fail(422, 'Gasto avulso não tem dia de vencimento nem período');
  }

  const changes: Record<string, unknown> = {};
  if (patch.description !== undefined) changes.description = patch.description;
  if (patch.category !== undefined) changes.category = patch.category;
  if (patch.amount !== undefined) changes.amount = patch.amount;
  if (patch.dueDay !== undefined) changes.due_day = patch.dueDay;
  if (patch.startsOn !== undefined) changes.starts_on = patch.startsOn;
  if (patch.endsOn !== undefined) changes.ends_on = patch.endsOn;
  if (patch.dueDate !== undefined) changes.due_date = patch.dueDate;

  if (Object.keys(changes).length) {
    await db('finance_expenses').where({ tenant_id: tenantId, id }).update({ ...changes, updated_at: db.fn.now() });
  }
  return getExpense(tenantId, id);
}

export async function deleteExpense(tenantId: string, id: string): Promise<void> {
  const removed = await db('finance_expenses').where({ tenant_id: tenantId, id }).del();
  if (!removed) throw expenseNotFound();
}

/** Marca ou desmarca a ocorrência do mês (YYYY-MM). Idempotente nos dois sentidos. */
export async function setPayment(tenantId: string, expenseId: string, month: string, paid: boolean): Promise<{ paid: boolean }> {
  const exists = await db('finance_expenses').where({ tenant_id: tenantId, id: expenseId }).first('id');
  if (!exists) throw expenseNotFound();

  const monthStart = `${month}-01`;
  if (paid) {
    await db('finance_payments')
      .insert({ tenant_id: tenantId, expense_id: expenseId, month: monthStart })
      .onConflict(['expense_id', 'month'])
      .ignore();
  } else {
    await db('finance_payments').where({ tenant_id: tenantId, expense_id: expenseId, month: monthStart }).del();
  }
  return { paid };
}

const toTaxDto = (row: Record<string, unknown>): TaxDto => ({
  id: row.id as string,
  name: row.name as string,
  rate: Number(row.rate),
  isActive: row.is_active as boolean,
});

export async function listTaxes(tenantId: string): Promise<TaxDto[]> {
  const rows = await db('finance_taxes').where({ tenant_id: tenantId }).orderBy('name');
  return rows.map(toTaxDto);
}

export async function replaceTaxes(tenantId: string, taxes: ReplaceTaxesInput): Promise<TaxDto[]> {
  await db.transaction(async (trx) => {
    await trx('finance_taxes').where({ tenant_id: tenantId }).del();
    if (taxes.length) {
      await trx('finance_taxes').insert(taxes.map((t) => ({ tenant_id: tenantId, name: t.name, rate: t.rate, is_active: t.isActive })));
    }
  });
  return listTaxes(tenantId);
}

const toPartnerDto = (row: Record<string, unknown>): PartnerDto => ({
  id: row.id as string,
  name: row.name as string,
  sharePercent: Number(row.share_percent),
  proLabore: Number(row.pro_labore),
});

export async function listPartners(tenantId: string): Promise<PartnerDto[]> {
  const rows = await db('finance_partners').where({ tenant_id: tenantId }).orderBy('name');
  return rows.map(toPartnerDto);
}

export async function replacePartners(tenantId: string, partners: ReplacePartnersInput): Promise<PartnerDto[]> {
  if (partners.length > 0) {
    const total = Math.round(partners.reduce((sum, p) => sum + p.sharePercent, 0) * 100);
    if (total !== 10_000) throw fail(422, 'Os percentuais dos sócios precisam somar 100%.', 'invalid_shares');
  }
  await db.transaction(async (trx) => {
    await trx('finance_partners').where({ tenant_id: tenantId }).del();
    if (partners.length) {
      await trx('finance_partners').insert(
        partners.map((p) => ({ tenant_id: tenantId, name: p.name, share_percent: p.sharePercent, pro_labore: p.proLabore })),
      );
    }
  });
  return listPartners(tenantId);
}

const toCents = (reais: number) => Math.round(reais * 100);

/** Data de hoje (YYYY-MM-DD) no fuso de Brasília — é nele que "mês" e "atrasada" são medidos */
const todayInSaoPaulo = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

/** Resultado do mês (YYYY-MM; padrão = mês atual): receita dos negócios ganhos menos impostos, gastos e pró-labore */
export async function getSummary(tenantId: string, month: string = todayInSaoPaulo().slice(0, 7)): Promise<MonthSummaryDto> {
  const [{ total }] = await db('deals')
    .where({ tenant_id: tenantId, status: 'won' })
    .whereRaw("to_char(closed_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = ?", [month])
    .sum({ total: 'value' });

  const [expenses, taxes, partners, paidIds] = await Promise.all([
    listExpenses(tenantId),
    listTaxes(tenantId),
    listPartners(tenantId),
    db('finance_payments').where({ tenant_id: tenantId, month: `${month}-01` }).pluck('expense_id'),
  ]);

  return summaryToReais(
    calcMonth({
      month,
      today: todayInSaoPaulo(),
      revenue: toCents(Number(total ?? 0)),
      expenses: expenses.map((e) => ({ ...e, amount: toCents(e.amount) })),
      paidExpenseIds: new Set<string>(paidIds),
      taxes: taxes.filter((t) => t.isActive).map((t) => ({ id: t.id, name: t.name, rate: t.rate })),
      partners: partners.map((p) => ({ id: p.id, name: p.name, sharePercent: p.sharePercent, proLabore: toCents(p.proLabore) })),
    }),
  );
}
