import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  financeService,
  type ExpenseInput,
  type ExpensePatch,
  type PartnerInput,
  type TaxInput,
} from '@/services/finance.service';

const ROOT = ['finance'] as const;

export const financeKeys = {
  all: ROOT,
  summary: (month: string) => [...ROOT, 'summary', month] as const,
  expenses: [...ROOT, 'expenses'] as const,
  taxes: [...ROOT, 'taxes'] as const,
  partners: [...ROOT, 'partners'] as const,
};

/** Mutação do financeiro: invalida tudo (o resumo depende de gastos, impostos, sócios e pagamentos) */
function useFinanceMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>, errorMessage: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
    onError: () => toast.error(errorMessage),
  });
}

export function useFinanceSummary(month: string, enabled = true) {
  return useQuery({
    queryKey: financeKeys.summary(month),
    queryFn: () => financeService.getSummary(month),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useExpenses() {
  return useQuery({ queryKey: financeKeys.expenses, queryFn: () => financeService.listExpenses() });
}

export function useTaxes() {
  return useQuery({ queryKey: financeKeys.taxes, queryFn: () => financeService.getTaxes() });
}

export function usePartners() {
  return useQuery({ queryKey: financeKeys.partners, queryFn: () => financeService.getPartners() });
}

/** Sem `id` cria; com `id` edita (o `input` então é parcial) */
export function useSaveExpense() {
  return useFinanceMutation(
    (v: { id?: undefined; input: ExpenseInput } | { id: string; input: ExpensePatch }) =>
      v.id ? financeService.updateExpense(v.id, v.input as ExpensePatch) : financeService.createExpense(v.input as ExpenseInput),
    'Não foi possível salvar o gasto',
  );
}

export function useDeleteExpense() {
  return useFinanceMutation((id: string) => financeService.deleteExpense(id), 'Não foi possível excluir o gasto');
}

export function useSetPayment() {
  return useFinanceMutation(
    (v: { id: string; month: string; paid: boolean }) => financeService.setPayment(v.id, v.month, v.paid),
    'Não foi possível atualizar o pagamento',
  );
}

export function useSaveTaxes() {
  return useFinanceMutation((taxes: TaxInput[]) => financeService.saveTaxes(taxes), 'Não foi possível salvar os impostos');
}

export function useSavePartners() {
  return useFinanceMutation((partners: PartnerInput[]) => financeService.savePartners(partners), 'Não foi possível salvar os sócios');
}
