import { useState } from 'react';
import type { AxiosError } from 'axios';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { usePartners, useSavePartners } from '@/hooks/useFinance';
import { cn } from '@/lib/utils';
import { moneyInput, parseMoney } from '@/lib/finance';
import type { PartnerDto } from '@/services/finance.service';

interface Row {
  name: string;
  share: string;
  proLabore: string;
}

const percentText = (n: number) => String(n).replace('.', ',');

function PartnersEditor({ initial }: { initial: PartnerDto[] }) {
  const save = useSavePartners();
  const [rows, setRows] = useState<Row[]>(() => initial.map((p) => ({ name: p.name, share: percentText(p.sharePercent), proLabore: moneyInput(p.proLabore) })));
  const [serverError, setServerError] = useState<string | null>(null);

  const parsed = rows.map((r) => ({ name: r.name.trim(), sharePercent: parseMoney(r.share), proLabore: r.proLabore.trim() ? parseMoney(r.proLabore) : 0 }));
  const invalid = parsed.some((r) => !r.name || r.sharePercent === null || r.sharePercent > 100 || r.proLabore === null);
  const total = Math.round(parsed.reduce((sum, r) => sum + (r.sharePercent ?? 0), 0) * 100) / 100;
  const sharesOk = rows.length === 0 || total === 100;
  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = () => {
    setServerError(null);
    save.mutate(
      parsed.map((r) => ({ name: r.name, sharePercent: r.sharePercent!, proLabore: r.proLabore! })),
      { onError: (e) => setServerError((e as AxiosError<{ error?: string }>).response?.data?.error ?? null) },
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-text-secondary">
        O pró-labore sai como custo; o lucro líquido que sobra é dividido pelos percentuais (a soma precisa dar 100%).
      </p>

      {rows.length === 0 && <p className="py-2 text-center text-[13.5px] text-text-muted">Nenhum sócio cadastrado.</p>}
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
            <Input aria-label="Nome do sócio" placeholder="Nome do sócio" value={r.name} onChange={(e) => update(i, { name: e.target.value })} className="flex-1" />
            <Input aria-label="Participação em %" placeholder="%" inputMode="decimal" value={r.share} onChange={(e) => update(i, { share: e.target.value })} className="w-20 text-right" />
            <Input aria-label="Pró-labore mensal em reais" placeholder="Pró-labore (R$)" inputMode="decimal" value={r.proLabore} onChange={(e) => update(i, { proLabore: e.target.value })} className="w-32 text-right" />
            <button type="button" aria-label="Remover sócio" className="rounded-lg p-1.5 text-text-muted hover:bg-status-lost/10 hover:text-status-lost" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={() => setRows((rs) => [...rs, { name: '', share: '', proLabore: '' }])}>
          <Plus size={15} className="mr-1.5" />
          Adicionar sócio
        </Button>
        {rows.length > 0 && (
          <span className="text-[13px] text-text-secondary">
            Soma: <strong className={cn('tabular-nums', sharesOk ? 'text-accent-green' : 'text-accent-amber')}>{percentText(total)}%</strong>
          </span>
        )}
      </div>

      {invalid && <p className="text-[12.5px] text-accent-amber">Preencha o nome, a participação (0–100%) e um pró-labore válido em todas as linhas.</p>}
      {serverError && <p className="text-[12.5px] text-status-lost">{serverError}</p>}
      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={invalid || !sharesOk || save.isPending} onClick={submit}>
          Salvar sócios
        </Button>
      </div>
    </div>
  );
}

export function PartnersTab() {
  const { data, isLoading } = usePartners();
  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }
  return <PartnersEditor initial={data} />;
}
