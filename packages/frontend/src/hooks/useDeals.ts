import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { dealsService, type DealsListParams } from '@/services/pipeline.service';

export function useDeals(filters: DealsListParams = {}) {
  return useQuery({
    queryKey: ['deals', 'list', filters],
    queryFn: () => dealsService.list(filters),
    // Lista anterior fica na tela enquanto o filtro novo carrega — a lista anima a diferença
    placeholderData: keepPreviousData,
  });
}
