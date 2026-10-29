import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useExecuteLeadRequest } from '@/hooks/useLeadRequests';
import type { LeadRequest } from '@/services/leadRequests.service';
import { CampaignFields } from '@/components/leadhunter/CampaignFields';
import {
  asCampaignForm,
  leadRequestSchema,
  NotesField,
  toLeadRequestBody,
  useLeadRequestMax,
  type LeadRequestValues,
} from './LeadRequestForm';

/** Campos do pedido no formato do formulário (listas viram uma linha por item) */
const valuesOf = (r: LeadRequest): LeadRequestValues => ({
  niche: r.niche,
  city: r.city,
  service: r.service,
  limit: r.quantity,
  keywords: r.keywords.join('\n'),
  coordinates: r.coordinates.join('\n'),
  enrich: r.enrich,
  useJev: r.use_jev,
  forceRefresh: r.force_refresh,
  notes: r.notes ?? '',
});

function ExecuteForm({ request, onClose }: { request: LeadRequest; onClose: () => void }): JSX.Element {
  const execute = useExecuteLeadRequest();
  const max = useLeadRequestMax();
  const schema = useMemo(() => leadRequestSchema(max), [max]);
  const form = useForm<LeadRequestValues>({ resolver: zodResolver(schema), defaultValues: valuesOf(request) });

  // Sem credenciais, estimativa acima do limite ou pedido já decidido: o texto do backend sai em toast e o diálogo continua aberto
  const onSubmit = form.handleSubmit((values) =>
    execute.mutate({ id: request.id, edits: toLeadRequestBody(values) }, { onSuccess: onClose }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="max-h-[calc(100dvh-10rem)] space-y-4 overflow-y-auto pr-1">
      <p className="text-xs text-text-muted">
        Pedido de {request.requester_name ?? 'ex-membro'}. Ajuste os campos se precisar; a busca começa ao confirmar.
      </p>
      <CampaignFields form={asCampaignForm(form)} maxLimit={max} advancedOpen />
      <NotesField form={form} />
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={execute.isPending}>
          {execute.isPending ? 'Iniciando…' : 'Executar'}
        </Button>
      </div>
    </form>
  );
}

interface Props {
  request: LeadRequest | null;
  onClose: () => void;
}

/** Executa um pedido na fila com os campos preenchidos e editáveis. O formulário só existe com o modal aberto, então reinicia a cada abertura. */
export function ExecuteRequestDialog({ request, onClose }: Props): JSX.Element {
  return (
    <Modal open={!!request} onClose={onClose} title="Executar pedido" description={request ? `${request.niche} · ${request.city}` : undefined} className="max-w-xl">
      {request && <ExecuteForm request={request} onClose={onClose} />}
    </Modal>
  );
}
