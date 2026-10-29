import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  leadhunterService,
  type CampaignDetail,
  type CampaignInput,
  type CompanyFilters,
  type UpdateCompanyInput,
} from '@/services/leadhunter.service';
import { contactsKeys } from '@/hooks/useContacts';
import { useDebounce } from '@/hooks/useDebounce';
import { useTenant } from '@/hooks/useTenant';

const leadhunterKeys = {
  all: ['leadhunter'] as const,
  status: ['leadhunter', 'status'] as const,
  campaigns: ['leadhunter', 'campaigns'] as const,
  campaign: (id: string | null | undefined, filters: CompanyFilters) => ['leadhunter', 'campaign', id, filters] as const,
  campaignAll: ['leadhunter', 'campaign'] as const,
  estimate: (config: string) => ['leadhunter', 'estimate', config] as const,
  history: (id: string) => ['leadhunter', 'history', id] as const,
  searches: ['leadhunter', 'searches'] as const,
  found: (demo: boolean) => ['leadhunter', 'found', demo] as const,
};

const RUNNING = ['queued', 'running'];
const POLL_MS = 2500;
const ESTIMATE_DEBOUNCE_MS = 400;

/** Erro do backend vem em `error` (400/404/409/422, já em pt-BR); senão usa o texto padrão */
function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? fallback;
}

/** Igual a `errorMessage`, mas lê o corpo de erro de downloads (`responseType: 'blob'`), que o axios entrega como Blob */
async function downloadErrorMessage(err: unknown, fallback: string) {
  const data = (err as { response?: { data?: unknown } }).response?.data;
  if (data instanceof Blob) {
    try {
      const message = (JSON.parse(await data.text()) as { error?: unknown }).error;
      if (typeof message === 'string') return message;
    } catch {
      // corpo que não é JSON: cai no texto padrão
    }
    return fallback;
  }
  return errorMessage(err, fallback);
}

/** Workspace com o LeadHunter liberado (flag ligada só por SQL). Enquanto o tenant carrega, é falso. */
export function useLeadHunterEnabled(): boolean {
  return useTenant().data?.leadhunter_enabled === true;
}

/** Credenciais configuradas, limites e chamadas do dia */
export function useLeadHunterStatus() {
  const enabled = useLeadHunterEnabled();
  return useQuery({ queryKey: leadhunterKeys.status, queryFn: leadhunterService.status, enabled });
}

export function useCampaigns() {
  const enabled = useLeadHunterEnabled();
  return useQuery({
    queryKey: leadhunterKeys.campaigns,
    queryFn: leadhunterService.listCampaigns,
    enabled,
    // Mantém a lista em dia enquanto alguma campanha roda
    refetchInterval: (query) => (query.state.data?.some((c) => RUNNING.includes(c.state)) ? POLL_MS : false),
  });
}

/** Campanha com empresas filtradas; reconsulta a cada 2,5 s enquanto estiver na fila ou rodando */
export function useCampaign(id: string | null | undefined, filters: CompanyFilters = {}) {
  return useQuery({
    queryKey: leadhunterKeys.campaign(id, filters),
    queryFn: () => leadhunterService.getCampaign(id!, filters),
    enabled: !!id,
    placeholderData: keepPreviousData,
    refetchInterval: (query) => {
      const data = query.state.data as CampaignDetail | undefined;
      return data && RUNNING.includes(data.campaign.state) ? POLL_MS : false;
    },
  });
}

/** Estimativa de chamadas do formulário; só consulta quando o config estável por 400 ms é válido (config nulo = desligado) */
export function useEstimate(config: CampaignInput | null) {
  // Serializa para o debounce comparar por valor (objeto novo a cada render nunca estabilizaria)
  const serialized = useDebounce(config ? JSON.stringify(config) : null, ESTIMATE_DEBOUNCE_MS);
  return useQuery({
    queryKey: leadhunterKeys.estimate(serialized ?? ''),
    queryFn: () => leadhunterService.estimate(JSON.parse(serialized!) as CampaignInput),
    enabled: serialized !== null,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: leadhunterService.createCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: leadhunterKeys.campaigns }),
    onError: (err) => toast.error(errorMessage(err, 'Não foi possível criar a campanha')),
  });
}

export function useCancelCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: leadhunterService.cancelCampaign,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leadhunterKeys.all });
      toast.success('Cancelamento solicitado');
    },
    onError: (err) => {
      qc.invalidateQueries({ queryKey: leadhunterKeys.all });
      toast.error(errorMessage(err, 'Não foi possível cancelar a campanha'));
    },
  });
}

export function useImportCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: leadhunterService.importCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: leadhunterKeys.campaigns }),
    onError: (err) => toast.error(errorMessage(err, 'Não foi possível importar o arquivo')),
  });
}

/** CSV da campanha com os filtros da tela; devolve o Blob para a tela baixar */
export function useExportCampaign() {
  return useMutation({
    mutationFn: ({ id, filters }: { id: string; filters?: CompanyFilters }) => leadhunterService.exportCampaign(id, filters),
    onError: async (err) => toast.error(await downloadErrorMessage(err, 'Não foi possível exportar')),
  });
}

/** Etapa, notas e revisão do Instagram: o backend recalcula a pontuação, então recarrega campanhas e empresas */
export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateCompanyInput & { id: string }) => leadhunterService.updateCompany(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: leadhunterKeys.campaignAll }),
    onError: (err) => toast.error(errorMessage(err, 'Não foi possível salvar a empresa')),
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: leadhunterService.deleteCompany,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leadhunterKeys.all });
      toast.success('Empresa excluída');
    },
    onError: (err) => toast.error(errorMessage(err, 'Não foi possível excluir a empresa')),
  });
}

/** Posições da empresa em todas as campanhas; só carrega com `enabled` (painel aberto) */
export function useCompanyHistory(id: string, enabled = true) {
  return useQuery({
    queryKey: leadhunterKeys.history(id),
    queryFn: () => leadhunterService.companyHistory(id),
    enabled,
  });
}

/** Envia as empresas da campanha como contatos do CRM; os contatos e o resultado por empresa mudam */
export function useSendToContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: leadhunterService.sendToContacts,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leadhunterKeys.all });
      qc.invalidateQueries({ queryKey: contactsKeys.all });
    },
    onError: (err) => toast.error(errorMessage(err, 'Não foi possível enviar para os contatos')),
  });
}

export function useSearches() {
  const enabled = useLeadHunterEnabled();
  return useQuery({ queryKey: leadhunterKeys.searches, queryFn: leadhunterService.listSearches, enabled });
}

/** Empresas já encontradas (até 2000); `demo` inclui as de demonstração */
export function useFoundCompanies(demo: boolean) {
  const enabled = useLeadHunterEnabled();
  return useQuery({
    queryKey: leadhunterKeys.found(demo),
    queryFn: () => leadhunterService.foundCompanies(demo),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** CSV de empresas já encontradas (`mutate()` sem ids = todas); devolve o Blob para a tela baixar */
export function useExportFound() {
  return useMutation({
    mutationFn: (companyIds: string[] | void) => leadhunterService.exportFound(companyIds || undefined),
    onError: async (err) => toast.error(await downloadErrorMessage(err, 'Não foi possível exportar')),
  });
}
