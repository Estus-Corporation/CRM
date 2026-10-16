import { Zap, Check, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { centerTransform, dialogMotion, overlayMotion } from '@/lib/motion';
import { useUpgradeStore } from '@/store/upgradeStore';
import { useCreateCheckoutSession } from '@/hooks/useBilling';
import { Button } from '@/components/ui/Button';

interface PlanFeature {
  label: string;
  included: boolean;
}

const PLANS = [
  {
    id: 'starter' as const,
    name: 'Starter',
    price: 'R$ 79',
    period: '/mês',
    description: 'Para equipes em crescimento',
    maxUsers: 10,
    features: [
      { label: 'Até 10 usuários', included: true },
      { label: 'Webhooks & Integrações', included: true },
      { label: 'API Keys', included: true },
      { label: 'Exportação CSV', included: false },
      { label: 'Importação CSV', included: false },
      { label: 'Campos customizados', included: false },
    ] as PlanFeature[],
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: 'R$ 199',
    period: '/mês',
    description: 'Para equipes avançadas',
    maxUsers: 50,
    features: [
      { label: 'Até 50 usuários', included: true },
      { label: 'Webhooks & Integrações', included: true },
      { label: 'API Keys', included: true },
      { label: 'Exportação CSV', included: true },
      { label: 'Importação CSV', included: true },
      { label: 'Campos customizados', included: true },
    ] as PlanFeature[],
  },
];

export function UpgradeModal() {
  const { open, requiredPlan, closeUpgrade } = useUpgradeStore();
  const checkout = useCreateCheckoutSession();

  const recommended = requiredPlan === 'pro' ? 'pro' : 'starter';

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && closeUpgrade()}>
      <AnimatePresence>
        {open && (
      <Dialog.Portal forceMount>
        <Dialog.Overlay asChild forceMount>
          <motion.div className="fixed inset-0 z-40 bg-black/55" {...overlayMotion} />
        </Dialog.Overlay>
        <Dialog.Content asChild forceMount>
          <motion.div
            {...dialogMotion}
            transformTemplate={centerTransform}
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl rounded-2xl border border-fg/[0.08] bg-bg-surface p-6 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.55)] focus:outline-none"
          >
          <div className="flex items-start justify-between mb-6">
            <div>
              <Dialog.Title className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Zap size={18} className="text-accent-green" />
                Upgrade necessário
              </Dialog.Title>
              <Dialog.Description className="text-sm text-text-secondary mt-0.5">
                Essa funcionalidade requer o plano{' '}
                <span className="text-text-primary font-medium capitalize">{requiredPlan}</span> ou superior.
              </Dialog.Description>
            </div>
            <button onClick={closeUpgrade} className="text-text-muted hover:text-text-primary transition-colors p-1 rounded">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {PLANS.map((plan) => {
              const isRecommended = plan.id === recommended;
              return (
                <div
                  key={plan.id}
                  className={`rounded-lg border p-5 flex flex-col gap-4 transition-colors ${
                    isRecommended
                      ? 'border-accent-green bg-accent-green/5'
                      : 'border-bg-border bg-bg-primary'
                  }`}
                >
                  {isRecommended && (
                    <span className="text-xs font-medium text-accent-green bg-accent-green/10 px-2 py-0.5 rounded-full w-fit">
                      Recomendado
                    </span>
                  )}
                  <div>
                    <p className="text-base font-semibold text-text-primary">{plan.name}</p>
                    <p className="text-xs text-text-muted mt-0.5">{plan.description}</p>
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="text-2xl font-bold text-text-primary">{plan.price}</span>
                    <span className="text-sm text-text-muted mb-0.5">{plan.period}</span>
                  </div>
                  <ul className="space-y-2 flex-1">
                    {plan.features.map((f) => (
                      <li key={f.label} className="flex items-center gap-2 text-xs">
                        {f.included
                          ? <Check size={13} className="text-accent-green flex-shrink-0" />
                          : <X size={13} className="text-text-muted flex-shrink-0" />
                        }
                        <span className={f.included ? 'text-text-secondary' : 'text-text-muted line-through'}>
                          {f.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    variant={isRecommended ? 'primary' : 'ghost'}
                    disabled={checkout.isPending}
                    onClick={() => checkout.mutate(plan.id)}
                    className="w-full"
                  >
                    {checkout.isPending ? 'Redirecionando…' : `Assinar ${plan.name}`}
                  </Button>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-text-muted text-center mt-4">
            Cancele a qualquer momento. Pagamentos processados com segurança pelo Stripe.
          </p>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
