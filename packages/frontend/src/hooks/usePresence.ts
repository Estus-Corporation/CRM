import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export interface OnlineMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
}

/** Quem do espaço está online agora (visto nos últimos 2 minutos); atualiza a cada 30s */
export function useOnlineMembers() {
  return useQuery({
    queryKey: ['tenant', 'online'],
    queryFn: () => api.get('/tenant/online').then((r) => r.data.data as OnlineMember[]),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}

/** Ids de quem está online (pra bolinha verde nos avatares) */
export function useOnlineIds() {
  const { data = [] } = useOnlineMembers();
  return new Set(data.map((m) => m.id));
}
