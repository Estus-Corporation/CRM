import { useTenant } from '@/hooks/useTenant';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Webhook, Plus, Trash2, Play, CheckCircle, XCircle, ToggleRight, ToggleLeft } from 'lucide-react';
import {
  useIntegrations,
  useCreateIntegration,
  useUpdateIntegration,
  useDeleteIntegration,
  useTestIntegration,
} from '@/hooks/useIntegrations';
import { SUPPORTED_EVENTS } from '@/services/integrations.service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'sonner';

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  url: z.string().url('URL inválida'),
  secret: z.string().min(8, 'Mínimo 8 caracteres'),
  events: z.array(z.string()).min(1, 'Selecione ao menos um evento'),
});

type FormData = z.infer<typeof schema>;

function StatusBadge({ status }: { status: number | null }) {
  if (!status) return <span className="text-xs text-text-muted">—</span>;
  const ok = status >= 200 && status < 300;
  return (
    <span className={`flex items-center gap-1 text-xs ${ok ? 'text-accent-green' : 'text-status-lost'}`}>
      {ok ? <CheckCircle size={11} /> : <XCircle size={11} />}
      {status}
    </span>
  );
}

export function WebhooksSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: tenant } = useTenant();
  const { data: integrations, isLoading } = useIntegrations({ enabled: !!tenant && tenant.plan !== 'free' });
  const createIntegration = useCreateIntegration();
  const updateIntegration = useUpdateIntegration();
  const deleteIntegration = useDeleteIntegration();
  const testIntegration = useTestIntegration();

  const [createOpen, setCreateOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', url: '', secret: '', events: [] },
  });

  const handleCreate = async (data: FormData) => {
    try {
      await createIntegration.mutateAsync({
        name: data.name,
        url: data.url,
        secret: data.secret,
        events: data.events as any,
      });
      toast.success('Webhook criado');
      setCreateOpen(false);
      reset();
    } catch {
      toast.error('Erro ao criar webhook');
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const result = await testIntegration.mutateAsync(id);
      const ok = result.last_response_status >= 200 && result.last_response_status < 300;
      if (ok) {
        toast.success(`Webhook respondeu com status ${result.last_response_status}`);
      } else {
        toast.error(`Webhook retornou status ${result.last_response_status}`);
      }
    } catch {
      toast.error('Falha ao enviar payload de teste');
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      await updateIntegration.mutateAsync({ id, input: { isActive: !current } });
      toast.success(!current ? 'Webhook ativado' : 'Webhook desativado');
    } catch {
      toast.error('Erro ao atualizar webhook');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deletar webhook "${name}"?`)) return;
    try {
      await deleteIntegration.mutateAsync(id);
      toast.success('Webhook removido');
    } catch {
      toast.error('Erro ao remover webhook');
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-border flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-text-primary flex items-center gap-2">
            <Webhook size={14} className="text-text-muted" />
            Webhooks
          </p>
          <p className="text-xs text-text-muted mt-0.5">Receba notificações HMAC-signed em tempo real</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={13} />
            Novo webhook
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : !integrations?.length ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <Webhook size={24} className="text-text-muted" />
          <p className="text-sm text-text-muted">Nenhum webhook configurado</p>
          {isAdmin && (
            <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)}>
              Criar primeiro webhook
            </Button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-bg-border">
          {integrations.map((w) => (
            <div key={w.id} className="px-5 py-4 flex items-start gap-4">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text-primary">{w.name}</p>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${w.is_active ? 'bg-accent-green' : 'bg-text-muted'}`} />
                </div>
                <p className="text-xs text-text-muted truncate">{w.url}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {w.events.map((e) => (
                    <span key={e} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-border text-text-secondary font-mono">
                      {e}
                    </span>
                  ))}
                </div>
                {w.last_triggered_at && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-text-muted">Último disparo:</span>
                    <StatusBadge status={w.last_response_status} />
                    <span className="text-xs text-text-muted">
                      {new Date(w.last_triggered_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                )}
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleTest(w.id)}
                    disabled={testingId === w.id}
                    className="text-text-muted hover:text-text-primary transition-colors p-1 rounded"
                    title="Enviar teste"
                  >
                    <Play size={13} className={testingId === w.id ? 'animate-pulse' : ''} />
                  </button>
                  <button
                    onClick={() => handleToggleActive(w.id, w.is_active)}
                    className="text-text-muted hover:text-text-primary transition-colors p-1 rounded"
                    title={w.is_active ? 'Desativar' : 'Ativar'}
                  >
                    {w.is_active
                      ? <ToggleRight size={16} className="text-accent-green" />
                      : <ToggleLeft size={16} />
                    }
                  </button>
                  <button
                    onClick={() => handleDelete(w.id, w.name)}
                    className="text-text-muted hover:text-status-lost transition-colors p-1 rounded"
                    title="Remover"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => { setCreateOpen(false); reset(); }} title="Novo Webhook" className="max-w-xl">
        <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
          <Input
            {...register('name')}
            id="wName"
            label="Nome *"
            placeholder="Minha integração"
            error={errors.name?.message}
          />
          <Input
            {...register('url')}
            id="wUrl"
            label="URL *"
            placeholder="https://meuapp.com/webhook"
            error={errors.url?.message}
          />
          <Input
            {...register('secret')}
            id="wSecret"
            label="Secret *"
            placeholder="Mínimo 8 caracteres"
            type="password"
            error={errors.secret?.message}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-secondary">Eventos *</label>
            <Controller
              name="events"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-1.5">
                  {SUPPORTED_EVENTS.map((event) => {
                    const checked = field.value.includes(event);
                    return (
                      <button
                        key={event}
                        type="button"
                        onClick={() => {
                          const next = checked
                            ? field.value.filter((e) => e !== event)
                            : [...field.value, event];
                          field.onChange(next);
                        }}
                        className={`text-left px-2.5 py-1.5 rounded text-xs font-mono border transition-colors ${
                          checked
                            ? 'border-accent-green text-accent-green bg-accent-green/10'
                            : 'border-bg-border text-text-muted hover:border-text-muted'
                        }`}
                      >
                        {event}
                      </button>
                    );
                  })}
                </div>
              )}
            />
            {errors.events && (
              <p className="text-xs text-status-lost">{errors.events.message}</p>
            )}
          </div>

          <p className="text-xs text-text-muted">
            Payloads são assinados via <code className="text-accent-green">X-Titan-Signature: sha256=...</code>
          </p>

          <div className="flex gap-2 pt-1 justify-end">
            <Button type="button" variant="ghost" onClick={() => { setCreateOpen(false); reset(); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createIntegration.isPending}>
              {createIntegration.isPending ? 'Criando…' : 'Criar webhook'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
