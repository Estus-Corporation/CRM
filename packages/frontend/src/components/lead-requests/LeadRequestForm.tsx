import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useTenant } from '@/hooks/useTenant';
import { useCreateLeadRequest } from '@/hooks/useLeadRequests';

const FALLBACK_MAX = 20;

export function LeadRequestForm() {
  const { data: tenant } = useTenant();
  const create = useCreateLeadRequest();
  const max = tenant?.lead_request_max_quantity ?? FALLBACK_MAX;
  const daily = tenant?.lead_request_daily_per_user;

  const schema = useMemo(
    () =>
      z.object({
        niche: z.string().trim().min(2, 'Informe o nicho (mín. 2 letras)').max(100, 'Máximo de 100 caracteres'),
        city: z.string().trim().min(2, 'Informe a cidade (mín. 2 letras)').max(100, 'Máximo de 100 caracteres'),
        quantity: z.coerce
          .number({ invalid_type_error: 'Informe a quantidade' })
          .int('Use um número inteiro')
          .min(1, 'Mínimo de 1 empresa')
          .max(max, `Máximo de ${max} empresas por pedido`),
        notes: z.string().trim().max(1000, 'Máximo de 1000 caracteres').optional(),
      }),
    [max],
  );
  type FormInput = z.input<typeof schema>;
  type FormData = z.output<typeof schema>;

  const emptyForm = { niche: '', city: '', quantity: Math.min(10, max), notes: '' };
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: emptyForm,
  });

  const onSubmit = (d: FormData) =>
    create
      .mutateAsync({ niche: d.niche, city: d.city, quantity: d.quantity, ...(d.notes ? { notes: d.notes } : {}) })
      .then(
        () => reset(emptyForm),
        () => undefined, // o toast de erro já sai no hook
      );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4 p-5 max-md:p-0 max-md:!border-0 max-md:before:!hidden">
      <div>
        <p className="text-sm font-medium text-text-primary">Novo pedido</p>
        {tenant && (
          <p className="mt-0.5 text-xs text-text-muted">
            Até {max} empresas por pedido · {daily} pedidos por dia
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px]">
        <Input {...register('niche')} id="lr-niche" label="Nicho *" placeholder="Ex: clínicas de estética" error={errors.niche?.message} />
        <Input {...register('city')} id="lr-city" label="Cidade *" placeholder="Ex: Ribeirão Preto" error={errors.city?.message} />
        <Input
          {...register('quantity')}
          id="lr-quantity"
          label="Quantidade *"
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          error={errors.quantity?.message}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="lr-notes" className="text-xs font-medium text-text-secondary">Observações</label>
        <textarea
          {...register('notes')}
          id="lr-notes"
          rows={2}
          className="input-base resize-none"
          placeholder="Algo que ajude na busca (opcional)"
        />
        {errors.notes && <p className="text-xs text-status-lost">{errors.notes.message}</p>}
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={create.isPending} className="max-sm:w-full">
          {create.isPending ? 'Enviando…' : 'Pedir leads'}
        </Button>
      </div>
    </form>
  );
}
