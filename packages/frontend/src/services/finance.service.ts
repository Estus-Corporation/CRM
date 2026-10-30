import { api } from './api';

// Todos os valores em reais; datas em YYYY-MM-DD; mês em YYYY-MM

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

export type ExpenseInput =
  | { kind: 'recurring'; description: string; category: string; amount: number; dueDay: number; startsOn: string; endsOn?: string | null }
  | { kind: 'one_off'; description: string; category: string; amount: number; dueDate: string };

/** Edição parcial: o tipo (`kind`) não muda */
export type ExpensePatch = Partial<{
  description: string;
  category: string;
  amount: number;
  dueDay: number;
  startsOn: string;
  endsOn: string | null;
  dueDate: string;
}>;

export interface TaxDto {
  id: string;
  name: string;
  rate: number;
  isActive: boolean;
}

export interface TaxInput {
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

export interface PartnerInput {
  name: string;
  sharePercent: number;
  proLabore: number;
}

export interface SummaryLine {
  key: string;
  label: string;
  kind: 'revenue' | 'tax' | 'expense' | 'payroll';
  amount: number;
}

export interface Payable {
  expenseId: string;
  description: string;
  category: string;
  amount: number;
  dueDate: string;
  status: 'paid' | 'pending' | 'overdue';
}

export interface Distribution {
  partnerId: string;
  name: string;
  sharePercent: number;
  proLabore: number;
  profitShare: number;
}

export interface MonthSummaryDto {
  month: string;
  revenue: number;
  taxesTotal: number;
  expensesTotal: number;
  proLaboreTotal: number;
  netProfit: number;
  pendingTotal: number;
  lines: SummaryLine[];
  payables: Payable[];
  distribution: Distribution[];
  warnings: { partnersShareInvalid: boolean; noConfig: boolean };
}

export const financeService = {
  async getSummary(month: string): Promise<MonthSummaryDto> {
    const { data } = await api.get<{ data: MonthSummaryDto }>('/finance/summary', { params: { month } });
    return data.data;
  },

  async listExpenses(): Promise<ExpenseDto[]> {
    const { data } = await api.get<{ data: ExpenseDto[] }>('/finance/expenses');
    return data.data;
  },

  async createExpense(input: ExpenseInput): Promise<ExpenseDto> {
    const { data } = await api.post<{ data: ExpenseDto }>('/finance/expenses', input);
    return data.data;
  },

  async updateExpense(id: string, patch: ExpensePatch): Promise<ExpenseDto> {
    const { data } = await api.patch<{ data: ExpenseDto }>(`/finance/expenses/${id}`, patch);
    return data.data;
  },

  async deleteExpense(id: string): Promise<void> {
    await api.delete(`/finance/expenses/${id}`);
  },

  async setPayment(id: string, month: string, paid: boolean): Promise<{ paid: boolean }> {
    const { data } = await api.put<{ data: { paid: boolean } }>(`/finance/expenses/${id}/payments/${month}`, { paid });
    return data.data;
  },

  async getTaxes(): Promise<TaxDto[]> {
    const { data } = await api.get<{ data: TaxDto[] }>('/finance/taxes');
    return data.data;
  },

  async saveTaxes(taxes: TaxInput[]): Promise<TaxDto[]> {
    const { data } = await api.put<{ data: TaxDto[] }>('/finance/taxes', { taxes });
    return data.data;
  },

  async getPartners(): Promise<PartnerDto[]> {
    const { data } = await api.get<{ data: PartnerDto[] }>('/finance/partners');
    return data.data;
  },

  async savePartners(partners: PartnerInput[]): Promise<PartnerDto[]> {
    const { data } = await api.put<{ data: PartnerDto[] }>('/finance/partners', { partners });
    return data.data;
  },
};
