import { useQuery, useMutation } from '@tanstack/react-query';
import { billingService } from '@/services/billing.service';

export function useBilling({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: billingService.getSubscription,
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: billingService.createCheckoutSession,
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });
}

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: billingService.createPortalSession,
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });
}
