import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Shuffle, Send, Inbox } from 'lucide-react';
import { useAssignLeads, useAvailableContacts, useCaptadores } from '@/hooks/useCaptacao';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { NicheFilter } from '@/components/contacts/NicheFilter';
import { DataList, DataListBody, DataListHead, DataListRow, DataListSkeleton, listSpring } from '@/components/ui/DataList';
import { cn } from '@/lib/utils';

const GRID =
  'grid-cols-[28px_minmax(0,1fr)_minmax(0,0.8fr)] md:grid-cols-[28px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)]';

const PAGE_SIZE = 50;

interface Props {
  /** Cota diária da distribuição automática (engrenagem da Captação); 0 = desligada */
  leadsPerDay: number;
  /** Abre o "Adicionar lead" do cabeçalho da página (lá ficam os botões de cadastrar/importar) */
  onAddLead: () => void;
  /** Só admin: abre as configurações da captação */
  onOpenSettings?: () => void;
}

/** Fila de leads livres. A entrega diária é automática (cota por captador); aqui também dá pra atribuir à mão. */
export function DistributeTab({ leadsPerDay, onAddLead, onOpenSettings }: Props) {
  const { data: captadores = [] } = useCaptadores();
  const activeCaptadores = captadores.filter((c) => c.is_active);

  const [niche, setNiche] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetCaptador, setTargetCaptador] = useState('');

  const debouncedSearch = useDebounce(search, 300);
  const { data, isLoading } = useAvailableContacts({
    search: debouncedSearch || undefined,
    niche: niche || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const contacts = data?.data ?? [];
  const available = data?.meta.total ?? 0;

  const assign = useAssignLeads();

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allOnPageSelected = contacts.length > 0 && contacts.every((c) => selected.has(c.id));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      contacts.forEach((c) => (allOnPageSelected ? next.delete(c.id) : next.add(c.id)));
      return next;
    });

  const handleAssign = () => {
    if (!targetCaptador || selected.size === 0) return;
    assign.mutate(
      { captadorId: targetCaptador, contactIds: [...selected] },
      { onSuccess: () => setSelected(new Set()) },
    );
  };

  return (
    // mobile-split: no celular cada parte vira um bloco translúcido separado (ver globals.css)
    <div className="mobile-split space-y-4">
      {/* Distribuição automática: só informa a regra; o número fica na engrenagem da Captação */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-fg/[0.03] px-4 py-3 text-sm text-text-secondary">
        <Shuffle size={15} className={leadsPerDay > 0 ? 'text-accent-green' : 'text-text-muted'} />
        {leadsPerDay > 0 ? (
          <span>
            <strong className="font-medium text-text-primary">Distribuição automática ligada:</strong> cada captador recebe até{' '}
            <strong className="font-medium text-text-primary">{leadsPerDay} leads novos por dia</strong> desta fila, ao abrir “Meus leads”.
          </span>
        ) : (
          <span>
            <strong className="font-medium text-text-primary">Distribuição automática desligada:</strong> os leads só saem da fila quando
            você atribui.
          </span>
        )}
        {onOpenSettings && (
          <button type="button" onClick={onOpenSettings} className="font-medium text-accent-green hover:underline">
            Alterar
          </button>
        )}
      </div>

      {/* Filtros + atribuição manual */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            className="input-base h-10 pl-9"
            placeholder="Buscar lead livre…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <NicheFilter
          value={niche}
          onChange={(n) => {
            setNiche(n);
            setPage(1);
          }}
        />
        <span className="text-sm text-text-muted">
          {available} lead{available !== 1 ? 's' : ''} livre{available !== 1 ? 's' : ''}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={targetCaptador}
            onChange={(e) => setTargetCaptador(e.target.value)}
            className="input-base h-10 w-48"
          >
            <option value="">Atribuir para…</option>
            {activeCaptadores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={handleAssign} disabled={!targetCaptador || selected.size === 0 || assign.isPending}>
            <Send size={14} />
            Atribuir {selected.size > 0 ? selected.size : ''}
          </Button>
        </div>
      </div>

      <div>
      {isLoading ? (
        <DataListSkeleton grid={GRID} cells={3} />
      ) : contacts.length === 0 ? (
        <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={listSpring}>
          <EmptyState
            icon={Inbox}
            title="Nenhum lead livre"
            description={
              debouncedSearch || niche
                ? 'Nada encontrado com esses filtros.'
                : 'Todos os contatos já foram distribuídos. Adicione leads à mão ou importe uma planilha.'
            }
            action={debouncedSearch || niche ? undefined : { label: 'Adicionar lead', onClick: onAddLead }}
          />
        </motion.div>
      ) : (
        <DataList outlined={false}>
          <DataListHead grid={GRID}>
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={toggleAll}
              aria-label="Selecionar todos desta página"
              className="h-4 w-4 accent-[rgb(var(--accent-green-dim))]"
            />
            <span>Lead</span>
            <span>Telefone</span>
            <span className="hidden md:block">Empresa</span>
            <span className="hidden md:block">Nicho</span>
          </DataListHead>
          <DataListBody>
            {contacts.map((c, i) => (
              <DataListRow
                key={c.id}
                grid={GRID}
                index={i}
                onClick={() => toggle(c.id)}
                className={cn(selected.has(c.id) && 'bg-accent-green/[0.06]')}
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Selecionar ${c.full_name}`}
                  className="h-4 w-4 accent-[rgb(var(--accent-green))]"
                />
                <span className="truncate text-sm font-medium text-text-primary">{c.full_name}</span>
                <span className="truncate text-sm text-text-secondary">{c.phone ?? '—'}</span>
                <span className="hidden truncate text-sm text-text-secondary md:block">{c.company_name ?? '—'}</span>
                <span className="hidden truncate text-sm text-text-muted md:block">{c.niche ?? '—'}</span>
              </DataListRow>
            ))}
          </DataListBody>
        </DataList>
      )}
      </div>

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm text-text-muted">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          Página {page} de {data.meta.totalPages}
          <Button variant="ghost" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </Button>
        </div>
      )}

    </div>
  );
}
