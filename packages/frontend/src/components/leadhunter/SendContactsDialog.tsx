import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SelectField } from '@/components/ui/SelectField';
import { useSendToContacts } from '@/hooks/useLeadHunter';
import { useUsers } from '@/hooks/useUsers';
import type { Company, SendSummary } from '@/services/leadhunter.service';

type Scope = 'all' | 'marked';

// Mesmas regras do backend (splitSendable): demonstração e etapas barradas ficam de fora; quem já foi enviada é pulada
const NEVER_SENT_STAGES = ['do_not_contact', 'discarded'];
const isExcluded = (c: Company) => c.source === 'demo' || NEVER_SENT_STAGES.includes(c.stage);
const wasSent = (c: Company) => c.crm?.status === 'imported' || c.crm?.status === 'duplicate';

/** "2 criado(s) · 1 já existia(m) · 0 com erro" + pulos e exclusões, como o toast do LeadHunter */
export function summaryText(s: SendSummary): string {
  return [
    `${s.imported} criado(s)`,
    `${s.duplicate} já existia(m)`,
    `${s.error} com erro`,
    s.skipped > 0 && `${s.skipped} já enviada(s) antes`,
    s.excluded > 0 && `${s.excluded} excluída(s) (demonstração, Não contatar ou Descartado)`,
  ]
    .filter(Boolean)
    .join(' · ');
}

interface FormProps {
  campaignId: string;
  companies: Company[];
  selectedIds: Set<string>;
  onClose: () => void;
}

function SendForm({ campaignId, companies, selectedIds, onClose }: FormProps) {
  const marked = useMemo(() => companies.filter((c) => selectedIds.has(c.id)), [companies, selectedIds]);
  const [scope, setScope] = useState<Scope>(marked.length ? 'marked' : 'all');
  const [ownerId, setOwnerId] = useState('');
  const [result, setResult] = useState<SendSummary | null>(null);
  const users = useUsers();
  const send = useSendToContacts();

  const chosen = scope === 'all' ? companies : marked;
  const excluded = chosen.filter(isExcluded).length;
  const skipped = chosen.filter((c) => !isExcluded(c) && wasSent(c)).length;
  const fresh = chosen.length - excluded - skipped;
  const owners = (users.data?.data ?? []).filter((u) => u.is_active).map((u) => ({ value: u.id, label: u.full_name || u.email }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    send.mutate(
      { campaignId, ownerId: ownerId || null, ...(scope === 'marked' && { companyIds: marked.map((c) => c.id) }) },
      { onSuccess: setResult },
    );
  };

  if (result) {
    return (
      <div className="space-y-4">
        <p role="status" className="text-sm text-text-primary">
          {summaryText(result)}
        </p>
        <div className="flex justify-end gap-2">
          <Button asChild variant="secondary">
            <Link to="/contacts">Ver contatos</Link>
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    );
  }

  const notes = [
    skipped > 0 && `${skipped} já enviada(s) ao CRM serão puladas.`,
    excluded > 0 && `${excluded} não será(ão) enviada(s) (demonstração, Não contatar ou Descartado).`,
    fresh === 0 && 'Nenhuma empresa nova para enviar.',
  ].filter(Boolean);

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-medium text-text-secondary">Quais empresas?</legend>
        {(
          [
            { value: 'all', label: `Todas da campanha (${companies.length})`, disabled: false },
            { value: 'marked', label: `Marcadas (${marked.length})`, disabled: marked.length === 0 },
          ] as const
        ).map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm text-text-primary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
            <input
              type="radio"
              name="lh-send-scope"
              checked={scope === o.value}
              disabled={o.disabled}
              onChange={() => setScope(o.value)}
              className="h-4 w-4 accent-accent-green"
            />
            {o.label}
          </label>
        ))}
      </fieldset>

      <SelectField
        id="lh-send-owner"
        label="Responsável nos contatos"
        placeholder="Sem responsável"
        options={owners}
        value={ownerId}
        onChange={(e) => setOwnerId(e.target.value)}
      />
      {users.isError && <p className="text-xs text-status-lost">Não foi possível carregar os responsáveis; o envio ficará sem responsável.</p>}

      <p className="text-xs leading-relaxed text-text-muted">
        Empresas marcadas como Não contatar ou Descartado não são enviadas. Suas observações da ficha vão junto no contexto da empresa.
      </p>
      {notes.length > 0 && (
        <p role="status" className="text-xs leading-relaxed text-accent-amber">
          {notes.join(' ')}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={fresh === 0 || send.isPending}>
          {send.isPending ? 'Enviando…' : 'Criar contatos'}
        </Button>
      </div>
    </form>
  );
}

interface Props extends FormProps {
  open: boolean;
}

/** Cria contatos no CRM a partir das empresas da campanha (todas ou marcadas) e mostra o resultado */
export function SendContactsDialog({ open, onClose, ...rest }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Criar contatos" description="Envia as empresas para os contatos do CRM.">
      <SendForm onClose={onClose} {...rest} />
    </Modal>
  );
}
