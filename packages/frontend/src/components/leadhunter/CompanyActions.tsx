import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { useDeleteCompany, type useUpdateCompany } from '@/hooks/useLeadHunter';
import type { Company, LeadHunterStage } from '@/services/leadhunter.service';
import { ExtLink, Hint, Section } from './CompanySections';
import { formatDate, INSTAGRAM_LABEL, NOTES_MAX, STAGE_LABEL } from './companyLabels';

/** Uma única mutação de atualização para a ficha toda: ações de Instagram e acompanhamento não rodam ao mesmo tempo */
export type CompanyUpdate = ReturnType<typeof useUpdateCompany>;

const STAGE_OPTIONS = Object.entries(STAGE_LABEL).map(([value, label]) => ({ value, label }));

export function InstagramSection({ company, update }: { company: Company; update: CompanyUpdate }) {
  const [url, setUrl] = useState(company.instagram ?? '');

  const review = (status: 'confirmed' | 'rejected') =>
    update.mutate(
      { id: company.id, instagramStatus: status, ...(status === 'confirmed' ? { instagram: url } : {}) },
      { onSuccess: () => toast.success(status === 'confirmed' ? 'Identidade confirmada pelo operador.' : 'Candidato rejeitado.') },
    );

  return (
    <Section title="Instagram">
      <Hint>
        {INSTAGRAM_LABEL[company.instagramStatus] ?? INSTAGRAM_LABEL.not_searched} · {company.instagramSource || 'Sem fonte disponível.'}
        {company.instagramVerifiedAt && ` · verificado em ${formatDate(company.instagramVerifiedAt)}`}
      </Hint>
      {(company.instagramCandidates ?? []).map((c, i) => (
        <div key={`${c.url}-${i}`} className="rounded-xl border border-fg/[0.08] bg-fg/[0.03] px-3 py-2 text-sm">
          <ExtLink url={c.url} label={c.title || c.url} />
          {c.description && <p className="mt-0.5 break-words text-xs text-text-muted">{c.description}</p>}
        </div>
      ))}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-text-secondary">Link do perfil</span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.instagram.com/perfil/"
          className="input-base"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={update.isPending} onClick={() => review('confirmed')}>
          Confirmar identidade
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={update.isPending} onClick={() => review('rejected')}>
          Rejeitar candidato
        </Button>
      </div>
      <Hint>Confirme após comparar nome, cidade e contatos com a fonte. O modelo não confirma a identidade sozinho.</Hint>
    </Section>
  );
}

/** Etapa, notas e exclusão; o 409 de campanha em andamento chega pelo toast do hook com a mensagem do backend */
export function FollowUpSection({ company, update, onClose }: { company: Company; update: CompanyUpdate; onClose: () => void }) {
  const remove = useDeleteCompany();
  const [stage, setStage] = useState<LeadHunterStage>(company.stage);
  const [notes, setNotes] = useState(company.notes);
  const [confirming, setConfirming] = useState(false);
  const busy = update.isPending || remove.isPending;

  const save = () =>
    update.mutate(
      { id: company.id, stage, notes },
      {
        onSuccess: () => {
          toast.success('Acompanhamento salvo.');
          onClose();
        },
      },
    );

  return (
    <Section title="Acompanhamento">
      <SelectField
        id="company-stage"
        label="Etapa"
        value={stage}
        options={STAGE_OPTIONS}
        onChange={(e) => setStage(e.target.value as LeadHunterStage)}
      />
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-text-secondary">Suas observações</span>
        <textarea
          rows={4}
          maxLength={NOTES_MAX}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Registre o que precisa conferir ou o contexto da conversa."
          className="input-base resize-y"
        />
        <span className="text-right text-xs tabular-nums text-text-muted">
          {notes.length}/{NOTES_MAX}
        </span>
      </label>

      {confirming && (
        <div role="alert" className="space-y-2 rounded-xl border border-status-lost/30 bg-status-lost/10 p-3">
          <p className="text-sm text-text-primary">Excluir esta empresa de todas as campanhas e apagar seu histórico?</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={() => remove.mutate(company.id, { onSuccess: onClose, onSettled: () => setConfirming(false) })}
            >
              {remove.isPending ? 'Excluindo…' : 'Confirmar exclusão'}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={remove.isPending} onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" size="sm" className="text-status-lost hover:text-status-lost" onClick={() => setConfirming(true)} disabled={confirming || busy}>
          Excluir empresa
        </Button>
        <Button type="button" onClick={save} disabled={busy}>
          {update.isPending ? 'Salvando…' : 'Salvar acompanhamento'}
        </Button>
      </div>
    </Section>
  );
}
