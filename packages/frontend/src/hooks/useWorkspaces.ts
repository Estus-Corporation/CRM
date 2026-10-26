import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authService, type CreateWorkspaceInput, type Workspace, type WorkspaceSession } from '@/services/auth.service';
import { useAuthStore } from '@/store/authStore';

const workspacesKey = ['workspaces'] as const;

/** Workspaces de que a pessoa participa (o dela e os que a convidaram) */
export function useWorkspaces() {
  return useQuery<Workspace[]>({
    queryKey: workspacesKey,
    queryFn: authService.listWorkspaces,
    staleTime: 30 * 1000,
  });
}

/** Aplica a sessão de outro workspace: novos tokens + papel daquele workspace, sem dados do anterior */
function useApplySession() {
  const qc = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  return (session: WorkspaceSession) => {
    setAuth(session.user, session.accessToken, session.refreshToken);
    qc.clear();
  };
}

export function useEnterWorkspace() {
  const apply = useApplySession();
  return useMutation({
    mutationFn: (workspace: Workspace) => authService.switchWorkspace(workspace.id),
    onSuccess: (session) => {
      apply(session);
      toast.success(`Você está em "${session.tenantName}"`);
    },
    onError: () => toast.error('Não foi possível trocar de workspace'),
  });
}

/** Cria um workspace próprio e leva pro onboarding (perfil da empresa, pipeline, equipe) */
export function useCreateWorkspace() {
  const apply = useApplySession();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (input: CreateWorkspaceInput) => authService.createWorkspace(input),
    onSuccess: (session) => {
      apply(session);
      toast.success(`Workspace "${session.tenantName}" criado`);
      navigate('/onboarding');
    },
    onError: () => toast.error('Não foi possível criar o workspace'),
  });
}

export function useLeaveWorkspace() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const enter = useEnterWorkspace();
  return useMutation({
    mutationFn: async ({ workspace, fallback }: { workspace: Workspace; fallback?: Workspace }) => {
      // Saindo do workspace atual: entra em outro antes, pra sessão não ficar num lugar sem acesso
      if (workspace.id === user?.tenant_id && fallback) await enter.mutateAsync(fallback);
      await authService.leaveWorkspace(workspace.id);
      return workspace;
    },
    onSuccess: (workspace) => {
      qc.invalidateQueries({ queryKey: workspacesKey });
      toast.success(`Você saiu de "${workspace.name}"`);
    },
    onError: (err) => {
      const code = (err as { response?: { data?: { code?: string } } }).response?.data?.code;
      toast.error(
        code === 'last_admin'
          ? 'Você é o único admin — passe o papel de admin para alguém antes de sair'
          : 'Não foi possível sair do workspace',
      );
    },
  });
}
