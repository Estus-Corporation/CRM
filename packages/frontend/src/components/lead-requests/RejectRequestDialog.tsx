import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useRejectLeadRequest } from '@/hooks/useLeadRequests';
import type { LeadRequest } from '@/services/leadRequests.service';

const schema = z.object({
  message: z.string().trim().min(1, 'Explique o motivo da recusa.').max(500, 'Máximo de 500 caracteres'),
});
type FormValues = z.infer<typeof schema>;

function RejectForm({ request, onClose }: { request: LeadRequest; onClose: () => void }): JSX.Element {
  const reject = useRejectLeadRequest();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { message: '' } });

  // Erros da API saem em toast pelo hook; o diálogo fica aberto
  const onSubmit = handleSubmit(({ message }) => reject.mutate({ id: request.id, message }, { onSuccess: onClose }));

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="lr-reject" className="text-xs font-medium text-text-secondary">Motivo *</label>
        <textarea
          {...register('message')}
          id="lr-reject"
          rows={3}
          maxLength={500}
          className="input-base resize-none"
          placeholder="Quem pediu recebe este texto na notificação"
        />
        {errors.message && <p className="text-xs text-status-lost">{errors.message.message}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Voltar</Button>
        <Button type="submit" variant="danger" disabled={reject.isPending}>
          {reject.isPending ? 'Recusando…' : 'Recusar pedido'}
        </Button>
      </div>
    </form>
  );
}

interface Props {
  request: LeadRequest | null;
  onClose: () => void;
}

/** Recusa um pedido na fila; o motivo é obrigatório. O formulário só existe com o modal aberto. */
export function RejectRequestDialog({ request, onClose }: Props): JSX.Element {
  return (
    <Modal open={!!request} onClose={onClose} title="Recusar pedido" description={request ? `${request.niche} · ${request.city}` : undefined}>
      {request && <RejectForm request={request} onClose={onClose} />}
    </Modal>
  );
}
