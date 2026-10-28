import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  captacaoService,
  type AssignmentFilters,
  type CaptacaoSettings,
  type CallStatus,
  type MyLead,
  type MyLeadsScope,
  type UpdateMyLeadInput,
} from '@/services/captacao.service';

export const captacaoKeys = {
  all: ['captacao'] as const,
  myLeads: (scope: string, status?: string) => ['captacao', 'me', 'leads', scope, status ?? ''] as const,
  myLead: (id: string) => ['captacao', 'me', 'lead', id] as const,
  mySummary: ['captacao', 'me', 'summary'] as const,
  captadores: ['captacao', 'captadores'] as const,
  available: (params: object) => ['captacao', 'available', params] as const,
  assignments: (params: object) => ['captacao', 'assignments', params] as const,
  settings: ['captacao', 'settings'] as const,
};

// ── Captador ────────────────────────────────────────────────────────────────

export function useMyLeads(scope: MyLeadsScope, status?: CallStatus) {
  return useQuery({
    queryKey: captacaoKeys.myLeads(scope, status),
    queryFn: () => captacaoService.myLeads({ scope, status }),
    placeholderData: keepPreviousData,
  });
}

export function useMyStats(period: 'week' | 'month') {
  return useQuery({
    queryKey: ['captacao', 'me', 'stats', period],
    queryFn: () => captacaoService.myStats(period),
    placeholderData: keepPreviousData,
  });
}

/** Um lead (página do lead). Abre na hora com o que já veio na lista e atualiza em seguida */
export function useMyLead(id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: captacaoKeys.myLead(id),
    queryFn: () => captacaoService.myLead(id),
    initialData: () =>
      qc
        .getQueriesData<MyLead[]>({ queryKey: ['captacao', 'me', 'leads'] })
        .flatMap(([, list]) => list ?? [])
        .find((l) => l.id === id),
    initialDataUpdatedAt: 0,
  });
}

/** Agenda dos admins (só busca com o modal aberto) */
export function useAdminBusy(enabled: boolean, from: Date, to: Date) {
  return useQuery({
    queryKey: ['captacao', 'me', 'admin-busy', from.toISOString(), to.toISOString()],
    queryFn: () => captacaoService.adminBusy(from, to),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useMySummary() {
  return useQuery({ queryKey: captacaoKeys.mySummary, queryFn: captacaoService.mySummary });
}

export function useUpdateMyLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateMyLeadInput) => captacaoService.updateMyLead(id, input),
    onSuccess: (lead) => {
      // Troca o lead nas listas já carregadas na hora; o refetch em segundo plano só reordena
      qc.setQueriesData<MyLead[]>({ queryKey: ['captacao', 'me', 'leads'] }, (old) =>
        old?.map((l) => (l.id === lead.id ? { ...l, ...lead } : l)),
      );
      qc.setQueryData<MyLead>(captacaoKeys.myLead(lead.id), (old) => (old ? { ...old, ...lead } : lead));
      qc.invalidateQueries({ queryKey: ['captacao', 'me'] });
    },
    onError: () => toast.error('Não foi possível salvar o lead'),
  });
}

/** Plano B: registra a abertura do WhatsApp e já aplica no cache (o link abre na hora, sem esperar) */
export function useRecordWhatsapp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => captacaoService.recordWhatsapp(id),
    onSuccess: (lead) => {
      qc.setQueriesData<MyLead[]>({ queryKey: ['captacao', 'me', 'leads'] }, (old) =>
        old?.map((l) => (l.id === lead.id ? { ...l, ...lead } : l)),
      );
      qc.setQueryData<MyLead>(captacaoKeys.myLead(lead.id), (old) => (old ? { ...old, ...lead } : lead));
    },
  });
}

// ── Admin / gerente ─────────────────────────────────────────────────────────

export function useCaptadores({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: captacaoKeys.captadores, queryFn: captacaoService.captadores, enabled });
}

export function useManagerLead(id: string) {
  return useQuery({ queryKey: ['captacao', 'lead', id], queryFn: () => captacaoService.managerLead(id), enabled: !!id });
}

export function useAvailableContacts(params: { search?: string; niche?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: captacaoKeys.available(params),
    queryFn: () => captacaoService.availableContacts(params),
    placeholderData: keepPreviousData,
  });
}

export function useAssignments(params: AssignmentFilters) {
  return useQuery({
    queryKey: captacaoKeys.assignments(params),
    queryFn: () => captacaoService.assignments(params),
    placeholderData: keepPreviousData,
  });
}

/** Toda ação do admin mexe em fila, acompanhamento e números — invalida o módulo inteiro */
function useCaptacaoMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  messages: { success?: string | ((r: TResult) => string); error: string },
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: captacaoKeys.all });
      const msg = typeof messages.success === 'function' ? messages.success(result) : messages.success;
      if (msg) toast.success(msg);
    },
    onError: () => toast.error(messages.error),
  });
}

export function useAssignLeads() {
  return useCaptacaoMutation(
    ({ captadorId, contactIds }: { captadorId: string; contactIds: string[] }) =>
      captacaoService.assign(captadorId, contactIds),
    {
      success: (r) => `${r.assigned} lead${r.assigned !== 1 ? 's' : ''} atribuído${r.assigned !== 1 ? 's' : ''}`,
      error: 'Erro ao atribuir leads',
    },
  );
}

export function useCloseAssignment() {
  return useCaptacaoMutation(
    ({ id, ...input }: { id: string } & ({ outcome: 'won'; dealValue: number } | { outcome: 'lost' } | { outcome: null })) =>
      captacaoService.close(id, input),
    { error: 'Erro ao registrar o fechamento' },
  );
}

export function useSetCommissionPaid() {
  return useCaptacaoMutation(
    ({ id, paid }: { id: string; paid: boolean }) => captacaoService.setPaid(id, paid),
    { error: 'Erro ao atualizar o pagamento' },
  );
}

export function usePayAllCommissions() {
  return useCaptacaoMutation((captadorId: string) => captacaoService.payAll(captadorId), {
    success: (r) => `${r.paid} comiss${r.paid !== 1 ? 'ões marcadas' : 'ão marcada'} como paga${r.paid !== 1 ? 's' : ''}`,
    error: 'Erro ao pagar comissões',
  });
}

export function useUnassign() {
  return useCaptacaoMutation((id: string) => captacaoService.unassign(id), {
    success: 'Lead devolvido para a fila',
    error: 'Erro ao remover atribuição',
  });
}

export function useCaptacaoSettings() {
  return useQuery({ queryKey: captacaoKeys.settings, queryFn: captacaoService.settings });
}

export function useUpdateCaptacaoSettings() {
  return useCaptacaoMutation((input: Partial<CaptacaoSettings>) => captacaoService.updateSettings(input), {
    success: 'Configurações da captação salvas',
    error: 'Erro ao salvar as configurações',
  });
}
