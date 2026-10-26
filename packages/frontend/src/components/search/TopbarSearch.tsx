import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Users, Briefcase, Zap, Loader2, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearch } from '@/hooks/useSearch';
import type { SearchResult } from '@/services/search.service';

const TYPE_ICON: Record<string, LucideIcon> = {
  contact: Users,
  deal: Briefcase,
  activity: Zap,
};

const TYPE_LABEL: Record<string, string> = {
  contact: 'Contatos',
  deal: 'Negócios',
  activity: 'Atividades',
};

/** Busca global inline na barra do topo — resultados num painel logo abaixo do campo. */
// autoFocus: busca do celular, que abre por um botão e já sai digitável
export function TopbarSearch({ autoFocus }: { autoFocus?: boolean } = {}) {
  const { query, setQuery, results, isFetching } = useSearch();
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const open = focused && query.length > 0;

  // Ctrl/⌘ + K foca o campo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Clique fora fecha o painel
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => setActiveIdx(0), [results]);

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  const goTo = (result: SearchResult) => {
    navigate(result.url);
    setQuery('');
    setFocused(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIdx]) {
      goTo(results[activeIdx]);
    } else if (e.key === 'Escape') {
      setQuery('');
      inputRef.current?.blur();
      setFocused(false);
    }
  };

  return (
    <div ref={rootRef} className="relative w-full max-w-[480px]">
      <div
        className={cn(
          'flex h-10 items-center gap-2.5 rounded-xl border-[1.5px] px-3.5 transition-[border-color,background-color,box-shadow] duration-200',
          focused
            // Brilho de foco difuso (blur grande, sem anel duro)
            ? 'border-accent-green bg-field shadow-[0_0_18px_1px_rgb(var(--accent-green)/0.28)]'
            : 'border-accent-green/70 bg-field hover:border-accent-green',
        )}
      >
        {isFetching ? (
          <Loader2 size={17} className="flex-shrink-0 animate-spin text-text-muted" />
        ) : (
          <Search size={17} strokeWidth={1.75} className={cn('flex-shrink-0 transition-colors', focused ? 'text-text-secondary' : 'text-text-muted')} />
        )}
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar contatos, negócios, atividades..."
          className="min-w-0 flex-1 bg-transparent text-[14px] text-text-primary placeholder-text-muted outline-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="flex-shrink-0 rounded-md p-0.5 text-text-muted transition-colors hover:text-text-primary"
            aria-label="Limpar busca"
          >
            <X size={15} />
          </button>
        ) : (
          <kbd className="hidden flex-shrink-0 rounded-md border border-fg/[0.08] bg-fg/[0.03] px-1.5 py-0.5 font-sans text-[11px] text-text-muted sm:inline">
            Ctrl K
          </kbd>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ type: 'spring', visualDuration: 0.25, bounce: 0 }}
            className="glass-panel absolute left-0 right-0 top-[calc(100%+8px)] z-50 origin-top overflow-hidden"
          >
            <div className="max-h-[360px] overflow-y-auto py-2">
              {query.length < 2 && (
                <p className="px-4 py-6 text-center text-sm text-text-muted">Digite ao menos 2 caracteres.</p>
              )}
              {query.length >= 2 && results.length === 0 && !isFetching && (
                <p className="px-4 py-6 text-center text-sm text-text-muted">Nenhum resultado para “{query}”.</p>
              )}

              {Object.entries(grouped).map(([type, items]) => {
                const Icon = TYPE_ICON[type] ?? Search;
                return (
                  <div key={type} className="mb-1 last:mb-0">
                    <p className="px-4 pb-1 pt-2 text-[11px] font-medium text-text-muted">{TYPE_LABEL[type] ?? type}</p>
                    {items.map((item) => {
                      const idx = results.indexOf(item);
                      const active = idx === activeIdx;
                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          onMouseEnter={() => setActiveIdx(idx)}
                          onClick={() => goTo(item)}
                          className={cn(
                            'mx-2 flex w-[calc(100%-16px)] items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-150',
                            active ? 'bg-fg/[0.07] text-text-primary' : 'text-text-secondary',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border transition-colors',
                              active ? 'border-accent-green/30 text-accent-green' : 'border-fg/[0.06] text-text-muted',
                            )}
                          >
                            <Icon size={15} strokeWidth={1.75} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium">{item.title}</span>
                            {item.subtitle && <span className="block truncate text-[12px] text-text-muted">{item.subtitle}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
