import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useCloseAssignment } from '@/hooks/useCaptacao';
import type { Assignment } from '@/services/captacao.service';
import { formatBRL, parseMoney } from '@/lib/captacao';

interface Props {
  assignment: Assignment | null;
  commissionRate: number;
  onClose: () => void;
}

/** "Fechou negócio": registra o valor vendido e mostra a comissão do captador antes de confirmar */
export function CloseLeadModal({ assignment, commissionRate, onClose }: Props) {
  const close = useCloseAssignment();
  const [value, setValue] = useState('');

  useEffect(() => setValue(''), [assignment?.id]);

  const parsed = parseMoney(value);
  const valid = Number.isFinite(parsed) && parsed > 0;
  const commission = valid ? Math.round(parsed * commissionRate) / 100 : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment || !valid) return;
    close.mutate({ id: assignment.id, outcome: 'won', dealValue: parsed }, { onSuccess: onClose });
  };

  return (
    <Modal
      open={!!assignment}
      onClose={onClose}
      title="Fechou negócio"
      description={assignment ? `${assignment.full_name} · captado por ${assignment.captador_name ?? '—'}` : undefined}
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">Valor fechado (R$)</span>
          <input
            autoFocus
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ''))}
            placeholder="Ex.: 12.500,00"
            className="input-base h-11 text-lg tabular-nums"
          />
        </label>

        <div className="flex items-center justify-between rounded-lg bg-accent-green/10 px-4 py-3">
          <span className="text-sm text-text-secondary">Comissão do captador ({commissionRate}%)</span>
          <span className="text-lg font-semibold tabular-nums text-accent-green">{formatBRL(commission)}</span>
        </div>

        <p className="text-xs text-text-muted">O contato passa a ser cliente e a comissão entra como "a pagar".</p>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!valid || close.isPending}>
            {close.isPending ? 'Salvando…' : 'Confirmar fechamento'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
