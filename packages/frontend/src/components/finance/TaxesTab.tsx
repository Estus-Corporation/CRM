import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { useSaveTaxes, useTaxes } from '@/hooks/useFinance';
import { parseMoney } from '@/lib/finance';
import type { TaxDto } from '@/services/finance.service';

interface Row {
  name: string;
  rate: string;
  isActive: boolean;
}

const rateText = (n: number) => String(n).replace('.', ',');

function TaxesEditor({ initial }: { initial: TaxDto[] }) {
  const save = useSaveTaxes();
  const [rows, setRows] = useState<Row[]>(() => initial.map((t) => ({ name: t.name, rate: rateText(t.rate), isActive: t.isActive })));

  const parsed = rows.map((r) => ({ name: r.name.trim(), rate: parseMoney(r.rate), isActive: r.isActive }));
  const invalid = parsed.some((r) => !r.name || r.rate === null || r.rate > 100);
  const total = parsed.filter((r) => r.isActive).reduce((sum, r) => sum + (r.rate ?? 0), 0);
  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-text-secondary">Alíquotas aplicadas sobre a receita do mês (negócios ganhos). Ex.: Simples 6%, ISS 2%.</p>

      {rows.length === 0 && <p className="py-2 text-center text-[13.5px] text-text-muted">Nenhum imposto cadastrado.</p>}
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
            <Input aria-label="Nome do imposto" placeholder="Nome (ex.: Simples Nacional)" value={r.name} onChange={(e) => update(i, { name: e.target.value })} className="flex-1" />
            <Input aria-label="Alíquota em %" placeholder="%" inputMode="decimal" value={r.rate} onChange={(e) => update(i, { rate: e.target.value })} className="w-20 text-right" />
            <label className="flex flex-shrink-0 items-center gap-1.5 text-[12.5px] text-text-secondary">
              <input type="checkbox" checked={r.isActive} onChange={(e) => update(i, { isActive: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--accent-green))]" />
              Ativo
            </label>
            <button type="button" aria-label="Remover imposto" className="rounded-lg p-1.5 text-text-muted hover:bg-status-lost/10 hover:text-status-lost" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={() => setRows((rs) => [...rs, { name: '', rate: '', isActive: true }])}>
          <Plus size={15} className="mr-1.5" />
          Adicionar imposto
        </Button>
        <span className="text-[13px] text-text-secondary">
          Total sobre a receita: <strong className="tabular-nums text-text-primary">{rateText(Math.round(total * 100) / 100)}%</strong>
        </span>
      </div>

      {invalid && <p className="text-[12.5px] text-accent-amber">Preencha o nome e uma alíquota entre 0 e 100 em todas as linhas.</p>}
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={invalid || save.isPending}
          onClick={() => save.mutate(parsed.map((r) => ({ name: r.name, rate: r.rate!, isActive: r.isActive })))}
        >
          Salvar impostos
        </Button>
      </div>
    </div>
  );
}

export function TaxesTab() {
  const { data, isLoading } = useTaxes();
  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }
  return <TaxesEditor initial={data} />;
}
