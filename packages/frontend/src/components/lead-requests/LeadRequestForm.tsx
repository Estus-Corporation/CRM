import { useId, useMemo } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { useTenant } from '@/hooks/useTenant';
import { useCreateLeadRequest } from '@/hooks/useLeadRequests';
import type { LeadRequestBody } from '@/services/leadRequests.service';
import {
  CAMPAIGN_FIELDS_DEFAULTS,
  CampaignFields,
  campaignFieldsSchema,
  toCampaignInput,
  type CampaignFieldsValues,
} from '@/components/leadhunter/CampaignFields';

const FALLBACK_MAX = 20;
const DEFAULT_QUANTITY = 10;

/** Campos da campanha, com o teto de empresas do workspace, + observações */
export function leadRequestSchema(max: number) {
  const cap = Math.min(max, 50);
  return campaignFieldsSchema.extend({
    limit: z
      .number({ invalid_type_error: 'Informe a quantidade de empresas.' })
      .int('Informe um número inteiro.')
      .min(1, 'A quantidade mínima é 1.')
      .max(cap, `A quantidade máxima é ${cap}.`),
    notes: z.string().trim().max(1000, 'Máximo de 1000 caracteres'),
  });
}
export type LeadRequestValues = z.infer<ReturnType<typeof leadRequestSchema>>;

/** Pedido é sempre coleta real: valores do formulário → corpo da API */
export const toLeadRequestBody = (values: LeadRequestValues): LeadRequestBody => ({
  ...toCampaignInput(values, 'live'),
  notes: values.notes,
});

/**
 * `CampaignFields` tipa o form só com os campos da campanha; o nosso tem `notes` a mais (mesmo objeto em
 * execução, e o componente nunca lê `notes`). O tipo de `watch` do RHF é invariante, daí o cast.
 */
export const asCampaignForm = (form: UseFormReturn<LeadRequestValues>): UseFormReturn<CampaignFieldsValues> =>
  form as unknown as UseFormReturn<CampaignFieldsValues>;

/** Teto de empresas por pedido neste workspace (antes de o tenant carregar, usa o padrão) */
export function useLeadRequestMax(): number {
  return useTenant().data?.lead_request_max_quantity ?? FALLBACK_MAX;
}

export function NotesField({ form }: { form: UseFormReturn<LeadRequestValues> }): JSX.Element {
  const id = useId();
  const error = form.formState.errors.notes;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-text-secondary">Observações</label>
      <textarea
        {...form.register('notes')}
        id={id}
        rows={2}
        className="input-base resize-none"
        placeholder="Algo que ajude na busca (opcional)"
      />
      {error && <p className="text-xs text-status-lost">{error.message}</p>}
    </div>
  );
}

/** Admin pede e a busca começa na hora (a fila "Aguardando admin" só existe para pedidos de outros papéis) */
export function LeadRequestForm(): JSX.Element {
  const create = useCreateLeadRequest();
  const max = useLeadRequestMax();
  const schema = useMemo(() => leadRequestSchema(max), [max]);
  const emptyForm: LeadRequestValues = { ...CAMPAIGN_FIELDS_DEFAULTS, limit: Math.min(DEFAULT_QUANTITY, max), notes: '' };
  const form = useForm<LeadRequestValues>({ resolver: zodResolver(schema), defaultValues: emptyForm });

  const onSubmit = form.handleSubmit((values) =>
    create.mutateAsync(toLeadRequestBody(values)).then(
      () => form.reset(emptyForm),
      () => undefined, // o toast de erro já sai no hook
    ),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="card space-y-4 p-5 max-md:p-0 max-md:!border-0 max-md:before:!hidden">
      <div>
        <p className="text-sm font-medium text-text-primary">Novo pedido</p>
        <p className="mt-0.5 text-xs text-text-muted">Até {max} empresas por pedido</p>
      </div>
      <CampaignFields form={asCampaignForm(form)} maxLimit={max} />
      <NotesField form={form} />
      <div className="flex justify-end">
        <Button type="submit" disabled={create.isPending} className="max-sm:w-full">
          {create.isPending ? 'Iniciando…' : 'Buscar agora'}
        </Button>
      </div>
    </form>
  );
}
