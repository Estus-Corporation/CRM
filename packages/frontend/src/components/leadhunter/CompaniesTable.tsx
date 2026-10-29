import { Building2, Search, Star } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { DataList, DataListHead } from '@/components/ui/DataList';
import { EmptyState } from '@/components/ui/EmptyState';
import { SelectField } from '@/components/ui/SelectField';
import { cn } from '@/lib/utils';
import type { Company, CompanyFilters } from '@/services/leadhunter.service';
import { Checkbox } from './FoundCompaniesTable';
import { formatBrPhone, formatNumber, PRIORITY_LABEL, safeUrl, STAGE_LABEL } from './companyLabels';

// Mobile: caixa, empresa (com presença e contatos embaixo) e prioridade; a partir de xl, uma coluna por campo
const ROW_GRID = 'grid-cols-[1.5rem_minmax(0,1fr)_auto] xl:grid-cols-[1.5rem_minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_7rem_7rem]';

const PRIORITY_VARIANT = { high: 'green', medium: 'manager', low: 'default', review: 'blue', excluded: 'red' } as const;
const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value, label }));
const STAGE_OPTIONS = Object.entries(STAGE_LABEL).map(([value, label]) => ({ value, label }));

/** Mesmo filtro do servidor (usado na exportação): busca em nome, endereço, cidade e categoria */
export function filterCompanies(companies: Company[], { q, priority, stage }: CompanyFilters): Company[] {
  const query = q?.trim().toLocaleLowerCase();
  return companies.filter(
    (c) =>
      (!query || [c.name, c.address, c.city, c.category].join(' ').toLocaleLowerCase().includes(query)) &&
      (!priority || c.analysis?.priority === priority) &&
      (!stage || c.stage === stage),
  );
}

function Presence({ company }: { company: Company }) {
  const a = company.analysis;
  return (
    <div className="min-w-0 space-y-0.5 text-sm text-text-secondary">
      <p className="flex items-center gap-1">
        <Star size={13} className="flex-shrink-0 text-accent-amber" aria-hidden />
        {formatNumber(company.rating)}
        <span className="text-xs text-text-muted">{formatNumber(company.reviews)} avaliações</span>
      </p>
      <p className="text-xs text-text-muted">
        {a?.rankMedian != null ? `${formatNumber(a.rankMedian)}ª posição mediana · ${a.rankSamples} amostra(s)` : 'Visibilidade não medida'}
      </p>
      {a?.coverage && (
        <p className="text-xs text-text-muted">
          Presente em {a.coverage.appeared} de {a.coverage.searched} busca(s)
        </p>
      )}
    </div>
  );
}

function Contacts({ company }: { company: Company }) {
  const phone = formatBrPhone(company.phone);
  const instagram = company.instagramStatus === 'rejected' ? null : safeUrl(company.instagram);
  return (
    <div className="min-w-0 space-y-0.5 text-sm text-text-secondary">
      <p className="break-words">{phone || <span className="text-xs text-text-muted">Telefone não informado</span>}</p>
      {instagram ? (
        <a
          href={instagram}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="break-words text-xs text-accent-green hover:underline"
        >
          {company.instagramStatus === 'confirmed' ? 'Instagram confirmado' : 'Instagram · revisar'}
        </a>
      ) : (
        <p className="text-xs text-text-muted">Instagram não confirmado</p>
      )}
    </div>
  );
}

interface Props {
  /** Todas as empresas da campanha (o filtro é desta tabela) */
  companies: Company[];
  filters: CompanyFilters;
  onFiltersChange: (filters: CompanyFilters) => void;
  selected: Set<string>;
  onSelectedChange: (selected: Set<string>) => void;
  onOpen: (id: string) => void;
  /** Texto do estado vazio quando a campanha ainda não tem empresas */
  emptyDescription: string;
}

/** Lista de prospecção: filtros, seleção para "Criar contatos" e abertura da ficha */
export function CompaniesTable({ companies, filters, onFiltersChange, selected, onSelectedChange, onOpen, emptyDescription }: Props) {
  const rows = filterCompanies(companies, filters);
  const markedVisible = rows.filter((c) => selected.has(c.id)).length;
  const allMarked = rows.length > 0 && markedVisible === rows.length;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (!next.delete(id)) next.add(id);
    onSelectedChange(next);
  };
  const toggleVisible = () => {
    const next = new Set(selected);
    for (const c of rows) {
      if (allMarked) next.delete(c.id);
      else next.add(c.id);
    }
    onSelectedChange(next);
  };

  return (
    <section aria-label="Lista de empresas" className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 max-sm:basis-full sm:min-w-[14rem] sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            className="input-base h-10 pl-9"
            placeholder="Buscar empresa, categoria ou endereço…"
            aria-label="Buscar empresas"
            value={filters.q ?? ''}
            onChange={(e) => onFiltersChange({ ...filters, q: e.target.value })}
          />
        </div>
        <SelectField
          aria-label="Filtrar prioridade"
          placeholder="Todas as prioridades"
          options={PRIORITY_OPTIONS}
          value={filters.priority ?? ''}
          onChange={(e) => onFiltersChange({ ...filters, priority: e.target.value as CompanyFilters['priority'] })}
          className="max-sm:w-full"
        />
        <SelectField
          aria-label="Filtrar etapa"
          placeholder="Todas as etapas"
          options={STAGE_OPTIONS}
          value={filters.stage ?? ''}
          onChange={(e) => onFiltersChange({ ...filters, stage: e.target.value as CompanyFilters['stage'] })}
          className="max-sm:w-full"
        />
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Building2}
            title={companies.length ? 'Nenhuma empresa com esses filtros.' : 'Nenhuma empresa nesta campanha ainda.'}
            description={companies.length ? 'Ajuste a busca ou os filtros para voltar à lista.' : emptyDescription}
          />
        </div>
      ) : (
        <DataList outlined={false}>
          <DataListHead grid={ROW_GRID}>
            <Checkbox
              checked={allMarked}
              indeterminate={markedVisible > 0 && !allMarked}
              label="Marcar todas as empresas visíveis"
              onChange={toggleVisible}
            />
            <span>Empresa</span>
            <span className="hidden xl:block">Presença no Google</span>
            <span className="hidden xl:block">Contatos</span>
            <span>Prioridade</span>
            <span className="hidden xl:block">Etapa</span>
          </DataListHead>
          <ul>
            {rows.map((c) => {
              const priority = c.analysis?.priority;
              return (
                <li
                  key={c.id}
                  onClick={() => onOpen(c.id)}
                  className={cn(
                    'grid cursor-pointer items-center gap-4 border-b-[1.5px] border-fg/[0.14] px-4 py-3 transition-colors last:border-0 hover:bg-fg/[0.03]',
                    ROW_GRID,
                    selected.has(c.id) && 'bg-accent-green/[0.05]',
                  )}
                >
                  <span onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.has(c.id)} label={`Marcar ${c.name}`} onChange={() => toggle(c.id)} />
                  </span>
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(c.id);
                      }}
                      aria-label={`Abrir ficha de ${c.name}`}
                      className="block max-w-full break-words text-left text-sm font-medium text-text-primary hover:text-accent-green"
                    >
                      {c.name}
                    </button>
                    <p className="break-words text-xs text-text-muted">{c.borough || c.category || c.city || '—'}</p>
                    <div className="mt-2 space-y-1.5 xl:hidden">
                      <Presence company={c} />
                      <Contacts company={c} />
                      <p className="text-xs text-text-muted">{STAGE_LABEL[c.stage] ?? c.stage}</p>
                    </div>
                  </div>
                  <div className="hidden xl:block">
                    <Presence company={c} />
                  </div>
                  <div className="hidden xl:block">
                    <Contacts company={c} />
                  </div>
                  <div className="flex flex-col items-end gap-1 xl:items-start">
                    <Badge variant={priority ? PRIORITY_VARIANT[priority] : 'blue'}>{priority ? PRIORITY_LABEL[priority] : 'Analisando'}</Badge>
                    <span className="text-xs tabular-nums text-text-muted">{c.analysis?.score ?? '—'}</span>
                  </div>
                  <span className="hidden text-sm text-text-secondary xl:block">{STAGE_LABEL[c.stage] ?? c.stage}</span>
                </li>
              );
            })}
          </ul>
        </DataList>
      )}

      <div className="flex flex-col gap-1 text-xs text-text-muted sm:flex-row sm:justify-between">
        <span>
          {rows.length} de {companies.length} empresas
        </span>
        <span>Prioridade comercial ≠ posição no Google</span>
      </div>
    </section>
  );
}
