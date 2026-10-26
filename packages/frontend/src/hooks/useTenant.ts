import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/services/api';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  max_users: number;
  created_at: string;
  /** Perfil da empresa — lido pela equipe em "Sobre a empresa" */
  service_type: string | null;
  about: string | null;
  offer: string | null;
  pitch: string | null;
  logo_url: string | null;
  email: string | null;
  /** Contatos e redes — atalhos na página "Sobre a empresa" */
  phone: string | null;
  instagram: string | null;
  website: string | null;
  address: string | null;
  /** Serviços e preços em arquivo (PDF/DOCX); o conteúdo vem por GET /tenant/offer-file */
  offer_file_name: string | null;
  offer_file_mime: string | null;
  offer_file_size: number | null;
  /** Quem é quem: fundador, cofundador, captadores… */
  key_people: KeyPerson[];
  /** Membros ativos do workspace, o mais antigo primeiro */
  members: TenantMember[];
}

export interface TenantMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: 'admin' | 'manager' | 'seller' | 'captador';
  joined_at: string;
}

export interface KeyPerson {
  name: string;
  title: string;
  /** Opcional: marca a pessoa pelo e-mail (preenche o nome se for membro do workspace) */
  email?: string;
}

export interface UpdateTenantInput {
  name?: string;
  email?: string | null;
  keyPeople?: KeyPerson[];
  serviceType?: string | null;
  about?: string | null;
  offer?: string | null;
  pitch?: string | null;
  /** data URL (ImageCropModal) ou null pra remover */
  logo?: string | null;
  phone?: string | null;
  instagram?: string | null;
  website?: string | null;
  address?: string | null;
}

const tenantKeys = {
  current: ['tenant'] as const,
};

export function useTenant() {
  return useQuery({
    queryKey: tenantKeys.current,
    queryFn: () => api.get('/tenant').then((r) => r.data.data as Tenant),
    staleTime: 30 * 1000,
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTenantInput) => api.patch('/tenant', input).then((r) => r.data.data as Tenant),
    onSuccess: (tenant) => {
      qc.setQueryData(tenantKeys.current, tenant);
      // Nome/logo aparecem no seletor de workspace
      qc.invalidateQueries({ queryKey: ['workspaces'] });
    },
    onError: () => toast.error('Não foi possível salvar o perfil da empresa'),
  });
}

/** Perfil mínimo preenchido (tipo de serviço + sobre) — usado pra lembrar o admin de completar */
export function isCompanyProfileComplete(tenant?: Tenant) {
  return !!tenant?.service_type && !!tenant?.about;
}

export function useUploadOfferFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      // Content-Type explícito: o axios converteria o FormData em JSON por causa do padrão da instância
      return api
        .post('/tenant/offer-file', form, { headers: { 'Content-Type': 'multipart/form-data' } })
        .then((r) => r.data.data as Tenant);
    },
    onSuccess: (tenant) => {
      qc.setQueryData(tenantKeys.current, tenant);
      qc.removeQueries({ queryKey: ['offer-file'] });
    },
    onError: () => toast.error('Não foi possível enviar o arquivo'),
  });
}

export function useDeleteOfferFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/tenant/offer-file').then((r) => r.data.data as Tenant),
    onSuccess: (tenant) => qc.setQueryData(tenantKeys.current, tenant),
    onError: () => toast.error('Não foi possível remover o arquivo'),
  });
}

/** Conteúdo do arquivo de serviços e preços (a rota exige o token, então vem como blob) */
export function useOfferFileBlob(tenant?: Tenant) {
  return useQuery({
    queryKey: ['offer-file', tenant?.offer_file_name, tenant?.offer_file_size],
    queryFn: () => api.get('/tenant/offer-file', { responseType: 'blob' }).then((r) => r.data as Blob),
    enabled: !!tenant?.offer_file_name,
    staleTime: Infinity,
  });
}

/**
 * Abre o arquivo: PDF numa aba nova, DOCX baixa. Com o blob já carregado (prévia) abre na hora;
 * senão a aba é aberta antes do download pra não ser barrada como pop-up.
 */
export async function openOfferFile(tenant: Tenant, cached?: Blob) {
  const pdf = tenant.offer_file_mime === 'application/pdf';
  const show = (blob: Blob, win: Window | null) => {
    const url = URL.createObjectURL(blob);
    if (pdf) {
      if (win) win.location.href = url;
      else window.open(url, '_blank');
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = tenant.offer_file_name ?? 'servicos-e-precos';
      a.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  if (cached) {
    show(cached, null);
    return;
  }
  const win = pdf ? window.open('', '_blank') : null;
  try {
    const res = await api.get('/tenant/offer-file', { responseType: 'blob' });
    show(res.data as Blob, win);
  } catch {
    win?.close();
    toast.error('Não foi possível abrir o arquivo');
  }
}
