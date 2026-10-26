import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  integrationsService,
  type CreateIntegrationInput,
  type UpdateIntegrationInput,
} from '@/services/integrations.service';
import { toast } from 'sonner';

const QK = ['integrations'];

/** enabled=false no plano Free: a rota é Starter+ e o 402 abriria o modal de upgrade sozinho */
export function useIntegrations({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: QK, queryFn: integrationsService.list, enabled });
}

export function useCreateIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateIntegrationInput) => integrationsService.create(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); toast.success('Webhook criado'); },
    onError: () => toast.error('Erro ao criar webhook'),
  });
}

export function useUpdateIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateIntegrationInput }) =>
      integrationsService.update(id, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); toast.success('Webhook atualizado'); },
    onError: () => toast.error('Erro ao atualizar webhook'),
  });
}

export function useDeleteIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => integrationsService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); toast.success('Webhook removido'); },
    onError: () => toast.error('Erro ao remover webhook'),
  });
}

export function useTestIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => integrationsService.test(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); toast.success('Payload de teste enviado'); },
    onError: () => toast.error('Erro ao disparar teste'),
  });
}
