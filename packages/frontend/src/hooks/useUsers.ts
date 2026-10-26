import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersService, type UpdateUserInput } from '@/services/users.service';
import { toast } from 'sonner';

const userKeys = {
  list: ['users'] as const,
};

export function useUsers() {
  return useQuery({
    queryKey: userKeys.list,
    queryFn: () => usersService.list(),
    staleTime: 60 * 1000,
  });
}

/** Erro "workspace precisa de pelo menos um admin" vem com code last_admin */
function errorMessage(err: unknown, fallback: string) {
  const code = (err as { response?: { data?: { code?: string } } }).response?.data?.code;
  return code === 'last_admin' ? 'O workspace precisa ter pelo menos um admin ativo' : fallback;
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      usersService.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.list });
      qc.invalidateQueries({ queryKey: ['captacao'] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Erro ao atualizar membro')),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.list });
      qc.invalidateQueries({ queryKey: ['captacao'] });
      toast.success('Removido do workspace');
    },
    onError: (err) => toast.error(errorMessage(err, 'Erro ao remover do workspace')),
  });
}
