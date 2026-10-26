import { useTenant } from '@/hooks/useTenant';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Key, Plus, Trash2, Copy, Check } from 'lucide-react';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/hooks/useApiKeys';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'sonner';
import type { CreatedApiKey } from '@/services/api-keys.service';

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  scopes: z.array(z.enum(['read', 'write'])).min(1),
});

type FormData = z.infer<typeof schema>;

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="text-text-muted hover:text-text-primary transition-colors p-1 rounded">
      {copied ? <Check size={13} className="text-accent-green" /> : <Copy size={13} />}
    </button>
  );
}

export function ApiKeysSection({ isAdmin }: { isAdmin: boolean }) {
  const { data: tenant } = useTenant();
  const { data: keys, isLoading } = useApiKeys({ enabled: !!tenant && tenant.plan !== 'free' });
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();

  const [createOpen, setCreateOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', scopes: ['read'] },
  });

  const selectedScopes = watch('scopes');

  const toggleScope = (scope: 'read' | 'write') => {
    const current = selectedScopes;
    if (current.includes(scope)) {
      setValue('scopes', current.filter((s) => s !== scope));
    } else {
      setValue('scopes', [...current, scope]);
    }
  };

  const handleCreate = async (data: FormData) => {
    try {
      const result = await createKey.mutateAsync(data);
      setCreatedKey(result);
      setCreateOpen(false);
      reset();
    } catch {
      toast.error('Erro ao criar API key');
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Revogar a key "${name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await revokeKey.mutateAsync(id);
      toast.success('API key revogada');
    } catch {
      toast.error('Erro ao revogar API key');
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-bg-border flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-text-primary flex items-center gap-2">
            <Key size={14} className="text-text-muted" />
            API Keys
          </p>
          <p className="text-xs text-text-muted mt-0.5">Autentique integrações externas via X-API-Key</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={13} />
            Nova key
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : !keys?.length ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <Key size={24} className="text-text-muted" />
          <p className="text-sm text-text-muted">Nenhuma API key criada</p>
          {isAdmin && (
            <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)}>
              Criar primeira key
            </Button>
          )}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-bg-border text-text-muted text-xs uppercase tracking-wide">
              <th className="text-left px-5 py-3 font-medium">Nome</th>
              <th className="text-left px-5 py-3 font-medium">Prefix</th>
              <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Escopos</th>
              <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">Último uso</th>
              {isAdmin && <th className="px-5 py-3 w-10" />}
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className="border-b border-bg-border last:border-0 hover:bg-bg-surface/50 transition-colors">
                <td className="px-5 py-3 font-medium text-text-primary">{k.name}</td>
                <td className="px-5 py-3">
                  <code className="text-xs text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded font-mono">
                    {k.prefix}…
                  </code>
                </td>
                <td className="px-5 py-3 hidden md:table-cell">
                  <div className="flex gap-1">
                    {k.scopes.map((s) => (
                      <span key={s} className="text-xs px-1.5 py-0.5 rounded bg-bg-border text-text-secondary">
                        {s}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-3 text-text-muted text-xs hidden lg:table-cell">
                  {k.last_used_at
                    ? new Date(k.last_used_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : 'Nunca'}
                </td>
                {isAdmin && (
                  <td className="px-5 py-3">
                    <button
                      onClick={() => handleRevoke(k.id, k.name)}
                      className="text-text-muted hover:text-status-lost transition-colors"
                      title="Revogar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => { setCreateOpen(false); reset(); }} title="Nova API Key">
        <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
          <Input
            {...register('name')}
            id="keyName"
            label="Nome *"
            placeholder="Integração com ERP"
            error={errors.name?.message}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-secondary">Escopos *</label>
            <div className="flex gap-2">
              {(['read', 'write'] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => toggleScope(scope)}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                    selectedScopes.includes(scope)
                      ? 'border-accent-green text-accent-green bg-accent-green/10'
                      : 'border-bg-border text-text-muted hover:border-bg-border/80'
                  }`}
                >
                  {scope}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1 justify-end">
            <Button type="button" variant="ghost" onClick={() => { setCreateOpen(false); reset(); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createKey.isPending}>
              {createKey.isPending ? 'Criando…' : 'Criar key'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Show-once key modal */}
      <Modal
        open={!!createdKey}
        onClose={() => setCreatedKey(null)}
        title="API Key criada"
        description="Copie agora — ela não será exibida novamente."
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-bg-primary border border-bg-border rounded px-3 py-2">
            <code className="flex-1 text-xs text-accent-green font-mono break-all">
              {createdKey?.key}
            </code>
            {createdKey?.key && <CopyButton value={createdKey.key} />}
          </div>
          <p className="text-xs text-text-muted">
            Use o header <code className="text-accent-green">X-API-Key: {createdKey?.key}</code> nas suas requisições para <code className="text-text-secondary">/api/v1/public/...</code>
          </p>
          <div className="flex justify-end">
            <Button onClick={() => setCreatedKey(null)}>Feito</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
