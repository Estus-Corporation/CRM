import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { contactsService, type ContactsListParams, type CreateContactInput } from '@/services/contacts.service';
import { toast } from 'sonner';

export const contactsKeys = {
  all: ['contacts'] as const,
  list: (params?: ContactsListParams) => [...contactsKeys.all, 'list', params] as const,
  detail: (id: string) => [...contactsKeys.all, 'detail', id] as const,
  niches: () => [...contactsKeys.all, 'niches'] as const,
};

export function useContacts(params?: ContactsListParams) {
  return useQuery({
    queryKey: contactsKeys.list(params),
    queryFn: () => contactsService.list(params),
    // Mantém a lista anterior enquanto o novo filtro carrega — a lista anima a diferença em vez de piscar
    placeholderData: keepPreviousData,
  });
}

/** Nichos já usados no workspace (filtro + sugestões do formulário). Invalida junto com contactsKeys.all. */
export function useContactNiches({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: contactsKeys.niches(),
    queryFn: () => contactsService.listNiches(),
    staleTime: 60_000,
    enabled,
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: contactsKeys.detail(id),
    queryFn: () => contactsService.get(id),
    enabled: !!id,
  });
}

/** Dados do LeadHunter do contato (só busca quando `enabled`); em erro `data` fica undefined = sem dados */
export function useContactLeadHunter(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...contactsKeys.detail(id), 'leadhunter'] as const,
    queryFn: () => contactsService.getLeadHunter(id),
    enabled: !!id && enabled,
    staleTime: 60_000,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContactInput) => contactsService.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactsKeys.all });
      toast.success('Contact created');
    },
    onError: () => toast.error('Failed to create contact'),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateContactInput> }) =>
      contactsService.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactsKeys.all });
      toast.success('Contact updated');
    },
    onError: () => toast.error('Failed to update contact'),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contactsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactsKeys.all });
      toast.success('Contact deleted');
    },
    onError: () => toast.error('Failed to delete contact'),
  });
}

export function useUploadContactPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => contactsService.uploadPhoto(id, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactsKeys.all });
      toast.success('Foto atualizada');
    },
    onError: () => toast.error('Erro ao enviar foto'),
  });
}

export function useDeleteContactPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contactsService.deletePhoto(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactsKeys.all });
      toast.success('Foto removida');
    },
    onError: () => toast.error('Erro ao remover foto'),
  });
}
