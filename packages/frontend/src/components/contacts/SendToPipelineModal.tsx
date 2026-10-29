import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUsers } from '@/hooks/useUsers';
import { invalidateStageDeals, pipelineKeys, useCreateDeal, useKanban, usePipelines } from '@/hooks/usePipeline';
import { useAuthStore } from '@/store/authStore';

interface ContactLike {
  id: string;
  full_name: string;
  company_name?: string;
  owner_id?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  contact: ContactLike;
  /** Chamado depois que o negócio foi criado (a página mostra o novo negócio) */
  onCreated?: () => void;
}

const defaultTitle = (c: ContactLike) => (c.company_name && c.company_name !== c.full_name ? `${c.company_name} — ${c.full_name}` : c.full_name);

/** Injeta um contato/lead no pipeline: cria o negócio já ligado a ele, na etapa e com os dados que o admin escolher */
export function SendToPipelineModal({ open, onClose, contact, onCreated }: Props) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const { data: pipelines = [], isLoading: loadingPipelines } = usePipelines();
  const { data: users } = useUsers();
  const createDeal = useCreateDeal();

  const [pipelineId, setPipelineId] = useState('');
  const [stageId, setStageId] = useState('');
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [expectedClose, setExpectedClose] = useState('');
  const [ownerId, setOwnerId] = useState('');

  const { data: stages = [] } = useKanban(pipelineId);

  // Valores iniciais cada vez que a janela abre
  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle(contact));
    setValue('');
    setExpectedClose('');
    setOwnerId(contact.owner_id ?? me?.id ?? '');
    setStageId('');
  }, [open, contact, me?.id]);

  useEffect(() => {
    if (open && !pipelineId && pipelines.length) setPipelineId((pipelines.find((p) => p.is_default) ?? pipelines[0]).id);
  }, [open, pipelineId, pipelines]);

  // Etapa: a primeira do pipeline escolhido, a menos que a pessoa já tenha escolhido outra
  const orderedStages = useMemo(() => [...stages].sort((a, b) => a.position - b.position), [stages]);
  useEffect(() => {
    if (orderedStages.length && !orderedStages.some((s) => s.id === stageId)) setStageId(orderedStages[0].id);
  }, [orderedStages, stageId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !pipelineId || !stageId) return;
    await createDeal.mutateAsync({
      title: title.trim(),
      pipelineId,
      stageId,
      contactId: contact.id,
      ownerId: ownerId || undefined,
      value: value ? Number(value) : undefined,
      expectedClose: expectedClose || undefined,
    });
    invalidateStageDeals(qc, [stageId]);
    qc.invalidateQueries({ queryKey: pipelineKeys.kanban(pipelineId) });
    onCreated?.();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Enviar para o pipeline">
      {!loadingPipelines && pipelines.length === 0 ? (
        <div className="space-y-3 text-sm text-text-secondary">
          <p>Você ainda não tem um pipeline. Crie um para poder enviar contatos para ele.</p>
          <Link to="/pipeline" className="text-accent-green hover:underline" onClick={onClose}>Ir para o Pipeline</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-xs text-text-muted">
            Cria um negócio ligado a <strong className="text-text-secondary">{contact.full_name}</strong> na etapa escolhida.
          </p>

          <Input id="send-title" label="Título do negócio *" value={title} onChange={(e) => setTitle(e.target.value)} />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">Pipeline *</label>
              <select className="input-base" value={pipelineId} onChange={(e) => { setPipelineId(e.target.value); setStageId(''); }}>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">Etapa *</label>
              <select className="input-base" value={stageId} onChange={(e) => setStageId(e.target.value)}>
                {orderedStages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-secondary">Responsável</label>
            <select className="input-base" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Sem responsável</option>
              {(users?.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input id="send-value" type="number" min={0} label="Valor (R$)" placeholder="0" value={value} onChange={(e) => setValue(e.target.value)} />
            <Input id="send-close" type="date" label="Previsão de fechamento" value={expectedClose} onChange={(e) => setExpectedClose(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={createDeal.isPending || !title.trim() || !stageId}>
              {createDeal.isPending ? 'Enviando...' : 'Enviar para o pipeline'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
