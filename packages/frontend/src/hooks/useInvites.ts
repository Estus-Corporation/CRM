import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { invitesService } from '@/services/invites.service';
import type { Workspace } from '@/services/auth.service';
import { useEnterWorkspace } from './useWorkspaces';

const inviteKeys = {
  mine: ['invites', 'mine'] as const,
  tenant: ['invites', 'tenant'] as const,
};

/** Convites que a pessoa recebeu (aparecem no topo da caixa de entrada) */
export function useMyInvites() {
  return useQuery({ queryKey: inviteKeys.mine, queryFn: invitesService.mine, refetchInterval: 30_000 });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  const enter = useEnterWorkspace();
  return useMutation({
    mutationFn: invitesService.accept,
    onSuccess: ({ tenantId, tenantName }) => {
      qc.invalidateQueries({ queryKey: inviteKeys.mine });
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success(`Você entrou em "${tenantName}"`, {
        action: { label: 'Abrir', onClick: () => enter.mutate({ id: tenantId, name: tenantName } as Workspace) },
      });
    },
    onError: () => toast.error('Não foi possível aceitar o convite'),
  });
}

export function useDeclineInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: invitesService.decline,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inviteKeys.mine });
      toast.success('Convite recusado');
    },
    onError: () => toast.error('Não foi possível recusar o convite'),
  });
}

/** Convites do workspace ainda sem resposta (painel da equipe) */
export function useTenantInvites(enabled = true) {
  return useQuery({ queryKey: inviteKeys.tenant, queryFn: invitesService.listTenant, enabled, staleTime: 30_000 });
}

export function useCancelInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: invitesService.cancel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inviteKeys.tenant });
      toast.success('Convite cancelado');
    },
    onError: () => toast.error('Não foi possível cancelar o convite'),
  });
}
