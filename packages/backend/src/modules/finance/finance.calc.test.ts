import { describe, expect, it } from 'vitest';
import {
  calcMonth,
  expenseOccurrence,
  summaryToReais,
  type CalcInput,
  type ExpenseInput,
  type PartnerInput,
} from './finance.calc';

const recurring = (over: Partial<ExpenseInput> = {}): ExpenseInput => ({
  id: 'e1',
  description: 'Aluguel',
  category: 'Aluguel',
  amount: 300_000,
  kind: 'recurring',
  dueDay: 5,
  startsOn: '2026-01-01',
  endsOn: null,
  dueDate: null,
  ...over,
});

const oneOff = (over: Partial<ExpenseInput> = {}): ExpenseInput => ({
  id: 'o1',
  description: 'Notebook',
  category: 'Equipamento',
  amount: 50_000,
  kind: 'one_off',
  dueDay: null,
  startsOn: null,
  endsOn: null,
  dueDate: '2026-10-20',
  ...over,
});

const partner = (id: string, sharePercent: number, proLabore = 0): PartnerInput => ({
  id,
  name: `Sócio ${id}`,
  sharePercent,
  proLabore,
});

const input = (over: Partial<CalcInput> = {}): CalcInput => ({
  month: '2026-10',
  today: '2026-10-20',
  revenue: 0,
  expenses: [],
  paidExpenseIds: new Set<string>(),
  taxes: [],
  partners: [],
  ...over,
});

describe('expenseOccurrence', () => {
  it('recorrente com vencimento dia 31 cai no último dia de fevereiro', () => {
    expect(expenseOccurrence(recurring({ dueDay: 31 }), '2027-02')).toBe('2027-02-28');
  });

  it('recorrente só existe a partir do mês em que começa', () => {
    const e = recurring({ startsOn: '2026-10-15' });
    expect(expenseOccurrence(e, '2026-09')).toBeNull();
    expect(expenseOccurrence(e, '2026-10')).toBe('2026-10-05');
  });

  it('recorrente deixa de existir depois de ends_on', () => {
    const e = recurring({ endsOn: '2026-09-30' });
    expect(expenseOccurrence(e, '2026-09')).toBe('2026-09-05');
    expect(expenseOccurrence(e, '2026-10')).toBeNull();
  });

  it('avulsa só existe no mês do vencimento', () => {
    expect(expenseOccurrence(oneOff(), '2026-10')).toBe('2026-10-20');
    expect(expenseOccurrence(oneOff(), '2026-11')).toBeNull();
  });
});

describe('calcMonth', () => {
  const base = () =>
    input({
      revenue: 1_000_000,
      expenses: [recurring()],
      taxes: [
        { id: 't1', name: 'Simples', rate: 6 },
        { id: 't2', name: 'ISS', rate: 2 },
      ],
      partners: [partner('A', 60, 100_000), partner('B', 40, 50_000)],
    });

  it('calcula o lucro líquido e a divisão entre sócios', () => {
    const s = calcMonth(base());
    expect(s.taxesTotal).toBe(80_000);
    expect(s.expensesTotal).toBe(300_000);
    expect(s.proLaboreTotal).toBe(150_000);
    expect(s.netProfit).toBe(470_000);
    expect(s.distribution.map((d) => d.profitShare)).toEqual([282_000, 188_000]);
  });

  it('monta as linhas na ordem receita, impostos, gastos por categoria, pró-labore', () => {
    const s = calcMonth(base());
    expect(s.lines.map((l) => l.key)).toEqual(['revenue', 'tax:t1', 'tax:t2', 'expense:Aluguel', 'pro_labore']);
    expect(s.lines.map((l) => l.kind)).toEqual(['revenue', 'tax', 'tax', 'expense', 'payroll']);
  });

  it('sem pró-labore não há linha de folha', () => {
    const s = calcMonth({ ...base(), partners: [partner('A', 100, 0)] });
    expect(s.lines.some((l) => l.key === 'pro_labore')).toBe(false);
  });

  it('a sobra do arredondamento vai para o sócio de maior percentual', () => {
    const s = calcMonth(input({ revenue: 100, partners: [partner('A', 33.33), partner('B', 33.33), partner('C', 33.34)] }));
    expect(s.netProfit).toBe(100);
    expect(s.distribution.map((d) => d.profitShare)).toEqual([33, 33, 34]);
  });

  it('arredonda o imposto ao centavo', () => {
    const s = calcMonth(input({ revenue: 333, taxes: [{ id: 't', name: 'Simples', rate: 6 }] }));
    expect(s.taxesTotal).toBe(20);
  });

  it('prejuízo não distribui nada', () => {
    const s = calcMonth(input({ expenses: [recurring({ amount: 100_000 })], partners: [partner('A', 100)] }));
    expect(s.netProfit).toBe(-100_000);
    expect(s.distribution.every((d) => d.profitShare === 0)).toBe(true);
  });

  it('classifica as contas em paga, pendente e atrasada', () => {
    const s = calcMonth(
      input({
        expenses: [
          oneOff({ id: 'a', dueDate: '2026-10-10', amount: 1_000 }),
          oneOff({ id: 'b', dueDate: '2026-10-10', amount: 2_000 }),
          oneOff({ id: 'c', dueDate: '2026-10-25', amount: 4_000 }),
        ],
        paidExpenseIds: new Set(['b']),
      }),
    );
    const status = Object.fromEntries(s.payables.map((p) => [p.expenseId, p.status]));
    expect(status).toEqual({ a: 'overdue', b: 'paid', c: 'pending' });
    expect(s.pendingTotal).toBe(5_000);
    expect(s.expensesTotal).toBe(7_000);
  });

  it('percentuais que não somam 100 avisam e não distribuem', () => {
    const s = calcMonth(input({ revenue: 100_000, partners: [partner('A', 50), partner('B', 40)] }));
    expect(s.warnings.partnersShareInvalid).toBe(true);
    expect(s.distribution.every((d) => d.profitShare === 0)).toBe(true);
  });

  it('sem sócios o aviso de percentual não aparece', () => {
    expect(calcMonth(input({ revenue: 100 })).warnings.partnersShareInvalid).toBe(false);
  });

  it('mês sem receita e sem configuração marca noConfig e não gera NaN', () => {
    const s = calcMonth(input());
    expect(s.warnings.noConfig).toBe(true);
    expect(JSON.stringify(s)).not.toContain('null');
    expect(s.netProfit).toBe(0);
  });
});

describe('summaryToReais', () => {
  it('converte centavos em reais', () => {
    const s = summaryToReais(
      calcMonth(
        input({ revenue: 1_000_000, expenses: [recurring()], partners: [partner('A', 100)] }),
      ),
    );
    expect(s.revenue).toBe(10_000);
    expect(s.netProfit).toBe(7_000);
    expect(s.payables[0].amount).toBe(3_000);
    expect(s.distribution[0].profitShare).toBe(7_000);
    expect(s.lines[0].amount).toBe(10_000);
  });
});
