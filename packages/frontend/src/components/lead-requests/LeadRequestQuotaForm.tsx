import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useTenant, useUpdateTenant } from '@/hooks/useTenant';

const inRange = (v: string, min: number, max: number) => {
  const n = Number(v);
  return v.trim() !== '' && Number.isInteger(n) && n >= min && n <= max;
};

/** Cotas dos pedidos de leads (só admin): tamanho máximo do pedido e pedidos por dia por usuário */
export function LeadRequestQuotaForm() {
  const { data: tenant } = useTenant();
  const update = useUpdateTenant();
  const [maxQty, setMaxQty] = useState('');
  const [daily, setDaily] = useState('');

  const savedMax = tenant?.lead_request_max_quantity;
  const savedDaily = tenant?.lead_request_daily_per_user;
  useEffect(() => {
    if (savedMax === undefined || savedDaily === undefined) return;
    setMaxQty(String(savedMax));
    setDaily(String(savedDaily));
  }, [savedMax, savedDaily]);

  const maxOk = inRange(maxQty, 1, 50);
  const dailyOk = inRange(daily, 0, 50);

  const save = () =>
    update.mutate(
      { leadRequestMaxQuantity: Number(maxQty), leadRequestDailyPerUser: Number(daily) },
      { onSuccess: () => toast.success('Cotas salvas') },
    );

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-bg-border px-5 py-4">
        <p className="text-sm font-medium text-text-primary">Pedidos de leads</p>
        <p className="mt-0.5 text-xs text-text-muted">Limites para os pedidos feitos em "Solicitações de leads".</p>
      </div>
      <div className="space-y-4 px-5 py-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="lrq-max"
            label="Máximo de empresas por pedido"
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            value={maxQty}
            onChange={(e) => setMaxQty(e.target.value)}
            error={maxOk ? undefined : 'Use um número de 1 a 50'}
          />
          <Input
            id="lrq-daily"
            label="Pedidos por dia, por usuário"
            type="number"
            inputMode="numeric"
            min={0}
            max={50}
            value={daily}
            onChange={(e) => setDaily(e.target.value)}
            error={dailyOk ? undefined : 'Use um número de 0 a 50'}
          />
        </div>
        <p className="text-xs text-text-muted">0 desativa os pedidos neste workspace.</p>
        <div className="flex justify-end">
          <Button size="sm" disabled={!maxOk || !dailyOk || update.isPending} onClick={save}>
            {update.isPending ? 'Salvando…' : 'Salvar cotas'}
          </Button>
        </div>
      </div>
    </div>
  );
}
