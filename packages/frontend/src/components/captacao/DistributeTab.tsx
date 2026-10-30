import { useState } from 'react';
import { useStickyState } from '@/hooks/useStickyState';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Building2, Check, ChevronRight, Inbox, Search, Send, Shuffle, Star } from 'lucide-react';
import { useAssignLeads, useAvailableContacts, useLeadAssignees } from '@/hooks/useCaptacao';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { NicheFilter } from '@/components/contacts/NicheFilter';
import { listSpring } from '@/components/ui/DataList';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

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
  const navigate = useNavigate();
  // Captadores e admins (o admin também pode receber leads livres)
  const assignees = useLeadAssignees();

  const [niche, setNiche] = useStickyState('captacao.distribute.niche', '');
  const [search, setSearch] = useStickyState('captacao.distribute.search', '');
  const [page, setPage] = useStickyState('captacao.distribute.page', 1);
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
            {assignees.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
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
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[78px] w-full rounded-2xl" />
          ))}
        </div>
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
        // Mesmo card dos leads em "Meus leads": clicar abre a página do lead; o quadrado à esquerda seleciona
        <div className="space-y-3">
          <button
            type="button"
            onClick={toggleAll}
            className="flex items-center gap-2 px-1 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            <span
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded-[5px] border transition-colors',
                allOnPageSelected ? 'border-accent-green bg-accent-green text-[rgb(var(--on-accent))]' : 'border-fg/[0.25]',
              )}
            >
              {allOnPageSelected && <Check size={11} strokeWidth={3} />}
            </span>
            {allOnPageSelected ? 'Desmarcar todos desta página' : 'Selecionar todos desta página'}
          </button>

          <ul className="space-y-3">
            {contacts.map((c, i) => {
              const isSelected = selected.has(c.id);
              // Empresa embaixo só quando não é o próprio nome do lead
              const company = c.company_name && c.company_name !== c.full_name ? c.company_name : null;
              return (
                <motion.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { ...listSpring, delay: Math.min(i * 0.03, 0.3) } }}
                  transition={listSpring}
                  onClick={() => navigate(`/captacao/lead/${c.id}`)}
                  // Mesmo vidro leve dos cards do Acompanhamento (sem backdrop-blur: dentro da pasta ele deixa o fundo sólido)
                  className={cn(
                    'group flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors md:px-5',
                    isSelected
                      ? 'border-accent-green/50 bg-accent-green/[0.06]'
                      : 'border-fg/[0.1] bg-fg/[0.035] hover:border-fg/[0.16] hover:bg-fg/[0.055]',
                  )}
                >
                  {/* Ícone do lead = botão de seleção: passar o mouse mostra o check; selecionado fica verde */}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={`Selecionar ${c.full_name}`}
                    title={isSelected ? 'Desmarcar' : 'Selecionar para atribuir'}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(c.id);
                    }}
                    className={cn(
                      'group/sel flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-colors',
                      isSelected
                        ? 'bg-accent-green text-[rgb(var(--on-accent))]'
                        : 'bg-fg/[0.08] text-text-primary hover:bg-accent-green/20 hover:text-accent-green',
                    )}
                  >
                    {isSelected ? (
                      <Check size={20} strokeWidth={2.75} />
                    ) : (
                      <>
                        <Building2 size={20} className="group-hover/sel:hidden" />
                        <Check size={20} strokeWidth={2.75} className="hidden group-hover/sel:block" />
                      </>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <p className="truncate text-[15.5px] font-semibold text-text-primary">{c.full_name}</p>
                      {c.niche && (
                        <span className="max-w-full truncate whitespace-nowrap rounded-md bg-fg/[0.06] px-2 py-0.5 text-xs font-medium text-text-secondary">
                          {c.niche}
                        </span>
                      )}
                      {c.google_rating != null && (
                        <span className="flex items-center gap-1 text-xs text-text-secondary" title="Avaliação no Google">
                          <Star size={12} className="fill-accent-amber text-accent-amber" />
                          <strong className="font-semibold text-text-primary">{c.google_rating.toFixed(1)}</strong>
                          {c.google_reviews != null && <span className="text-text-muted">({c.google_reviews})</span>}
                        </span>
                      )}
                    </div>
                    {company && (
                      <p className="mt-1 flex min-w-0 max-w-full items-center gap-1 text-xs text-text-muted">
                        <Building2 size={12} className="flex-shrink-0" />
                        <span className="truncate">{company}</span>
                      </p>
                    )}
                  </div>
                  {/* À direita: selo "Livre" e a seta (como em Meus leads) */}
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-fg/[0.22] px-2.5 py-1 text-xs font-medium text-text-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-text-muted" />
                      Livre
                    </span>
                    <ChevronRight size={18} className="text-text-muted transition-transform group-hover:translate-x-0.5" />
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>
      )}
      </div>

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm text-text-muted">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          Página {page} de {data.meta.totalPages}
          <Button variant="ghost" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>
            Próxima
          </Button>
        </div>
      )}

    </div>
  );
}
