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
