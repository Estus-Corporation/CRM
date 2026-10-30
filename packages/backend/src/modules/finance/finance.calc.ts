// Núcleo de cálculo do financeiro: puro (sem banco), dinheiro em centavos inteiros.
// O serviço lê os dados, monta o CalcInput e converte o resultado para reais na borda (summaryToReais).

export type Cents = number;

export interface ExpenseInput {
  id: string;
  description: string;
  category: string;
  amount: Cents;
  kind: 'recurring' | 'one_off';
  dueDay: number | null;
  /** YYYY-MM-DD */
  startsOn: string | null;
  endsOn: string | null;
  dueDate: string | null;
}

export interface TaxInput {
  id: string;
  name: string;
  /** % sobre a receita */
  rate: number;
}

export interface PartnerInput {
  id: string;
  name: string;
  sharePercent: number;
  proLabore: Cents;
}

export interface CalcInput {
  /** YYYY-MM */
  month: string;
  /** YYYY-MM-DD */
  today: string;
  revenue: Cents;
  expenses: ExpenseInput[];
  /** Despesas com pagamento registrado neste mês */
  paidExpenseIds: ReadonlySet<string>;
  /** Só os impostos ativos */
  taxes: TaxInput[];
  partners: PartnerInput[];
}

export interface Payable {
  expenseId: string;
  description: string;
  category: string;
  amount: Cents;
  dueDate: string;
  status: 'paid' | 'pending' | 'overdue';
}

export interface SummaryLine {
  key: string;
  label: string;
  kind: 'revenue' | 'tax' | 'expense' | 'payroll';
  amount: Cents;
}

export interface Distribution {
  partnerId: string;
  name: string;
  sharePercent: number;
  proLabore: Cents;
  profitShare: Cents;
}

export interface MonthSummary {
  month: string;
  revenue: Cents;
  taxesTotal: Cents;
  expensesTotal: Cents;
  proLaboreTotal: Cents;
  netProfit: Cents;
  pendingTotal: Cents;
  lines: SummaryLine[];
  payables: Payable[];
  distribution: Distribution[];
  warnings: { partnersShareInvalid: boolean; noConfig: boolean };
}

/** Mesma forma do MonthSummary, com todo valor em reais (o que a API devolve) */
export type MonthSummaryDto = MonthSummary;

const pad = (n: number) => String(n).padStart(2, '0');

function lastDayOfMonth(month: string): number {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

/** Data de vencimento da despesa no mês (YYYY-MM-DD), ou null se ela não ocorre nele */
export function expenseOccurrence(expense: ExpenseInput, month: string): string | null {
  const last = lastDayOfMonth(month);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${pad(last)}`;

  if (expense.kind === 'one_off') {
    const due = expense.dueDate;
    return due && due >= monthStart && due <= monthEnd ? due : null;
  }

  if (!expense.startsOn || expense.dueDay == null) return null;
  if (expense.startsOn > monthEnd) return null;
  if (expense.endsOn && expense.endsOn < monthStart) return null;
  return `${month}-${pad(Math.min(expense.dueDay, last))}`;
}

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);

export function calcMonth(input: CalcInput): MonthSummary {
  const { month, today, revenue, expenses, paidExpenseIds, taxes, partners } = input;

  const payables: Payable[] = [];
  for (const e of expenses) {
    const dueDate = expenseOccurrence(e, month);
    if (!dueDate) continue;
    const status = paidExpenseIds.has(e.id) ? 'paid' : dueDate < today ? 'overdue' : 'pending';
    payables.push({ expenseId: e.id, description: e.description, category: e.category, amount: e.amount, dueDate, status });
  }
  payables.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.description.localeCompare(b.description));

  const taxLines: SummaryLine[] = taxes.map((t) => ({
    key: `tax:${t.id}`,
    label: t.name,
    kind: 'tax',
    amount: Math.round((revenue * Math.round(t.rate * 100)) / 10_000),
  }));

  const byCategory = new Map<string, number>();
  for (const p of payables) byCategory.set(p.category, (byCategory.get(p.category) ?? 0) + p.amount);
  const expenseLines: SummaryLine[] = [...byCategory].map(([category, amount]) => ({
    key: `expense:${category}`,
    label: category,
    kind: 'expense',
    amount,
  }));

  const taxesTotal = sum(taxLines.map((l) => l.amount));
  const expensesTotal = sum(payables.map((p) => p.amount));
  const proLaboreTotal = sum(partners.map((p) => p.proLabore));
  const netProfit = revenue - taxesTotal - expensesTotal - proLaboreTotal;
  const pendingTotal = sum(payables.filter((p) => p.status !== 'paid').map((p) => p.amount));

  const lines: SummaryLine[] = [{ key: 'revenue', label: 'Receita', kind: 'revenue', amount: revenue }, ...taxLines, ...expenseLines];
  if (proLaboreTotal > 0) lines.push({ key: 'pro_labore', label: 'Pró-labore', kind: 'payroll', amount: proLaboreTotal });

  const sharesValid = partners.length > 0 && Math.round(sum(partners.map((p) => p.sharePercent)) * 100) === 10_000;
  const shares = partners.map(() => 0);
  if (sharesValid && netProfit > 0) {
    partners.forEach((p, i) => {
      shares[i] = Math.floor((netProfit * Math.round(p.sharePercent * 100)) / 10_000);
    });
    const largest = partners.reduce((best, p, i) => (p.sharePercent > partners[best].sharePercent ? i : best), 0);
    shares[largest] += netProfit - sum(shares);
  }

  return {
    month,
    revenue,
    taxesTotal,
    expensesTotal,
    proLaboreTotal,
    netProfit,
    pendingTotal,
    lines,
    payables,
    distribution: partners.map((p, i) => ({
      partnerId: p.id,
      name: p.name,
      sharePercent: p.sharePercent,
      proLabore: p.proLabore,
      profitShare: shares[i],
    })),
    warnings: {
      partnersShareInvalid: partners.length > 0 && !sharesValid,
      noConfig: expenses.length === 0 && taxes.length === 0 && partners.length === 0,
    },
  };
}

const toReais = (cents: Cents) => cents / 100;

export function summaryToReais(s: MonthSummary): MonthSummaryDto {
  return {
    ...s,
    revenue: toReais(s.revenue),
    taxesTotal: toReais(s.taxesTotal),
    expensesTotal: toReais(s.expensesTotal),
    proLaboreTotal: toReais(s.proLaboreTotal),
    netProfit: toReais(s.netProfit),
    pendingTotal: toReais(s.pendingTotal),
    lines: s.lines.map((l) => ({ ...l, amount: toReais(l.amount) })),
    payables: s.payables.map((p) => ({ ...p, amount: toReais(p.amount) })),
    distribution: s.distribution.map((d) => ({ ...d, proLabore: toReais(d.proLabore), profitShare: toReais(d.profitShare) })),
  };
}
