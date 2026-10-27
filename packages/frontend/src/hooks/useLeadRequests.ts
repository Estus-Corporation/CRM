import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { leadRequestsService, type LeadRequest, type LeadRequestListParams } from '@/services/leadRequests.service';

const leadRequestKeys = {
  all: ['lead-requests'] as const,
  list: (params: LeadRequestListParams) => ['lead-requests', 'list', params] as const,
  detail: (id: string) => ['lead-requests', 'detail', id] as const,
};

const ACTIVE = ['queued', 'claimed', 'running'];

/** Erro do backend (422 de cota, 409 de estado) vem em `error`; senão usa o texto padrão */
function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? fallback;
}

/** Lista de pedidos; reconsulta a cada 30 s enquanto houver algum na fila ou em andamento */
export function useLeadRequests(params: LeadRequestListParams = {}) {
  return useQuery({
    queryKey: leadRequestKeys.list(params),
    queryFn: () => leadRequestsService.list(params),
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      (query.state.data as LeadRequest[] | undefined)?.some((r) => ACTIVE.includes(r.status)) ? 30_000 : false,
  });
}

/** Pedido com as empresas entregues; só carrega quando `enabled` (linha expandida) */
export function useLeadRequest(id: string, enabled = true) {
  return useQuery({
    queryKey: leadRequestKeys.detail(id),
    queryFn: () => leadRequestsService.get(id),
    enabled,
  });
}

export function useCreateLeadRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: leadRequestsService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leadRequestKeys.all });
      toast.success('Pedido enviado. O Radar Local vai buscar as empresas.');
    },
    onError: (err) => toast.error(errorMessage(err, 'Não foi possível enviar o pedido')),
  });
}

export function useCancelLeadRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: leadRequestsService.cancel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leadRequestKeys.all });
      toast.success('Pedido cancelado');
    },
    onError: (err) => {
      qc.invalidateQueries({ queryKey: leadRequestKeys.all });
      toast.error(errorMessage(err, 'Não foi possível cancelar o pedido'));
    },
  });
}
