import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Download, Search } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataList, DataListHead } from '@/components/ui/DataList';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { CRM_LABEL, formatBrPhone, formatNumber } from '@/components/leadhunter/companyLabels';
import { useExportFound, useFoundCompanies } from '@/hooks/useLeadHunter';
import { cn, downloadBlob } from '@/lib/utils';
import type { FoundCompany } from '@/services/leadhunter.service';

// Mobile: caixa, empresa (com categoria/cidade/telefone/nota embaixo) e CRM; a partir de xl, uma coluna por campo
const ROW_GRID =
  'grid-cols-[1.5rem_minmax(0,1fr)_auto] xl:grid-cols-[1.5rem_minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_9rem_6rem_4.5rem_6rem_6.5rem]';

const CRM_VARIANT = { imported: 'green', duplicate: 'default', error: 'red' } as const;

const formatDay = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
const matches = (c: FoundCompany, q: string) => !q || [c.name, c.city, c.category].join(' ').toLocaleLowerCase().includes(q);

function CrmBadge({ status }: { status: FoundCompany['crmStatus'] }) {
  if (!status) return <span className="text-xs text-text-muted">Não enviado</span>;
  return <Badge variant={CRM_VARIANT[status]}>{CRM_LABEL[status]}</Badge>;
}

function Rating({ company }: { company: FoundCompany }) {
  if (company.rating == null) return <>—</>;
  return (
    <>
      ★ {formatNumber(company.rating)}
      {company.reviews != null && <span className="text-text-muted"> · {formatNumber(company.reviews)} avaliações</span>}
    </>
  );
}

/** Caixa de seleção; `indeterminate` só existe como propriedade do DOM, por isso o ref */
function Checkbox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} aria-label={label} className="h-4 w-4 accent-accent-green" />;
}

/** Todas as empresas já encontradas (até 2000), com busca, seleção e exportação em CSV */
export function FoundCompaniesTable() {
  const [demo, setDemo] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data, isLoading, isError, refetch } = useFoundCompanies(demo);
  const exportFound = useExportFound();

  const query = search.trim().toLocaleLowerCase();
  const all = useMemo(() => data?.companies ?? [], [data]);
  const rows = useMemo(() => all.filter((c) => matches(c, query)), [all, query]);
  // Seleção só vale para empresas ainda na lista (desligar a demonstração tira as demo da seleção)
  const selectedIds = useMemo(() => all.filter((c) => selected.has(c.id)).map((c) => c.id), [all, selected]);
  const markedVisible = rows.filter((c) => selected.has(c.id)).length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const toggleVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allMarked = rows.length > 0 && markedVisible === rows.length;
      for (const c of rows) {
        if (allMarked) next.delete(c.id);
        else next.add(c.id);
      }
      return next;
    });

  const download = (ids?: string[]) =>
    exportFound.mutate(ids, {
      onSuccess: (blob) => downloadBlob(blob, `empresas-encontradas-${new Date().toLocaleDateString('sv-SE')}.csv`),
    });
  // "Todas" nunca inclui demonstração. Sem busca nem demonstração não manda ids: o servidor exporta todas as reais, inclusive além do
  // limite da lista. Com busca ou demonstração ligada manda só os ids reais visíveis.
  const exportableIds = rows.filter((c) => !c.demo).map((c) => c.id);
  const exportAll = () => download(query || demo ? exportableIds : undefined);
  const canExportAll = query || demo ? exportableIds.length > 0 : all.length > 0;

  return (
    <section aria-label="Empresas já encontradas" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
            Empresas já encontradas
            <span className="rounded-full bg-fg/[0.08] px-2 py-0.5 text-xs font-semibold tabular-nums text-text-secondary">{rows.length}</span>
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Todas as empresas salvas neste workspace, sem repetir as que apareceram em mais de uma campanha.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={selectedIds.length === 0 || exportFound.isPending} onClick={() => download(selectedIds)}>
            <Download size={14} />
            {exportFound.isPending ? 'Exportando…' : `Exportar selecionadas${selectedIds.length ? ` (${selectedIds.length})` : ''}`}
          </Button>
          <Button variant="secondary" size="sm" disabled={!canExportAll || exportFound.isPending} onClick={exportAll}>
            <Download size={14} />
            {exportFound.isPending ? 'Exportando…' : query ? 'Exportar resultados da busca' : 'Exportar todas'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-sm:basis-full sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            className="input-base h-10 pl-9"
            placeholder="Buscar nome, cidade ou categoria…"
            aria-label="Buscar empresas já encontradas"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} className="h-4 w-4 accent-accent-green" />
          Mostrar demonstração
        </label>
      </div>

      {isLoading ? (
        <div className="card p-2">
          <TableSkeleton rows={6} />
        </div>
      ) : isError && !data ? (
        <div className="card">
          <EmptyState
            icon={Building2}
            title="Não foi possível carregar as empresas"
            description="Verifique a conexão e tente de novo."
            action={{ label: 'Tentar de novo', onClick: () => void refetch() }}
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Building2}
            title={query ? 'Nenhum resultado' : 'Nenhuma empresa por enquanto'}
            description={query ? `Nada encontrado para "${search.trim()}".` : 'As empresas das suas campanhas aparecem aqui.'}
          />
        </div>
      ) : (
        <DataList outlined={false}>
          <DataListHead grid={ROW_GRID}>
            <Checkbox
              checked={rows.length > 0 && markedVisible === rows.length}
              indeterminate={markedVisible > 0 && markedVisible < rows.length}
              label="Marcar todas as empresas visíveis"
              onChange={toggleVisible}
            />
            <span>Empresa</span>
            <span className="hidden xl:block">Categoria</span>
            <span className="hidden xl:block">Cidade</span>
            <span className="hidden xl:block">Telefone</span>
            <span className="hidden xl:block">Nota</span>
            <span className="hidden xl:block">Campanhas</span>
            <span className="hidden xl:block">Primeira vez</span>
            <span>CRM</span>
          </DataListHead>
          <ul>
            {/* Linhas simples (sem animação por linha): a lista chega a 2000 empresas */}
            {rows.map((c) => {
              const phone = formatBrPhone(c.phone);
              return (
                <li
                  key={c.id}
                  className={cn(
                    'grid items-center gap-4 border-b-[1.5px] border-fg/[0.14] px-4 py-3 last:border-0',
                    ROW_GRID,
                    selected.has(c.id) && 'bg-accent-green/[0.05]',
                  )}
                >
                  <Checkbox checked={selected.has(c.id)} label={`Marcar ${c.name ?? 'empresa'}`} onChange={() => toggle(c.id)} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-text-primary">
                      <span className="min-w-0 break-words">{c.name ?? '—'}</span>
                      {c.demo && <Badge variant="blue">demonstração</Badge>}
                    </p>
                    <p className="mt-0.5 break-words text-xs text-text-muted xl:hidden">
                      {[c.category, c.city, phone].filter(Boolean).join(' · ') || '—'} · <Rating company={c} /> · {formatNumber(c.campaigns)}{' '}
                      {c.campaigns === 1 ? 'campanha' : 'campanhas'} · {formatDay(c.firstSeen)}
                    </p>
                  </div>
                  <span className="hidden truncate text-sm text-text-secondary xl:block">{c.category ?? '—'}</span>
                  <span className="hidden truncate text-sm text-text-secondary xl:block">{c.city ?? '—'}</span>
                  <span className="hidden truncate text-sm text-text-secondary xl:block">{phone || '—'}</span>
                  <span className="hidden text-sm text-text-secondary xl:block">
                    <Rating company={c} />
                  </span>
                  <span className="hidden text-sm tabular-nums text-text-secondary xl:block">{formatNumber(c.campaigns)}</span>
                  <span className="hidden text-sm text-text-secondary xl:block">{formatDay(c.firstSeen)}</span>
                  <CrmBadge status={c.crmStatus} />
                </li>
              );
            })}
          </ul>
        </DataList>
      )}

      {!isLoading && !(isError && !data) && (
        <div className="flex flex-col gap-1 text-xs text-text-muted sm:flex-row sm:justify-between">
          <span>
            {rows.length} de {all.length} empresas
            {data?.truncated && ` · mostrando as ${formatNumber(data.limit)} mais recentes; há mais empresas salvas`}
          </span>
          <span>Empresas de demonstração nunca vão ao CRM</span>
        </div>
      )}
    </section>
  );
}
