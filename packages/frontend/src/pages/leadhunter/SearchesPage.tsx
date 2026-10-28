import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { FoundCompaniesTable } from '@/components/leadhunter/FoundCompaniesTable';
import { SearchCards } from '@/components/leadhunter/SearchCards';
import { useLeadHunterStatus, useSearches } from '@/hooks/useLeadHunter';

export function SearchesPage() {
  const searches = useSearches();
  const status = useLeadHunterStatus();
  const cacheDays = status.data?.searchCacheDays;

  return (
    // mobile-sections: no celular cada bloco vira um card translúcido separado (ver globals.css)
    <div className="mobile-sections space-y-6 max-md:space-y-3">
      <PageHeader title="Locais pesquisados" subtitle="Buscas já feitas e empresas encontradas" />

      <section aria-label="Locais pesquisados" className="space-y-3">
        <p className="text-sm text-text-secondary">
          Buscas pagas ficam salvas {cacheDays != null ? `por ${cacheDays} dias` : 'por um período'} e são reaproveitadas sem custo. Uma busca
          reaproveitada devolve as mesmas empresas; para empresas novas no mesmo local, use outro termo, outro ponto ou maior profundidade.
        </p>
        {searches.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        ) : searches.isError ? (
          <p role="alert" className="text-sm text-status-lost">
            Não foi possível carregar os locais pesquisados.{' '}
            <button type="button" className="underline" onClick={() => void searches.refetch()}>
              Tentar de novo
            </button>
          </p>
        ) : (
          <SearchCards searches={searches.data ?? []} />
        )}
      </section>

      <FoundCompaniesTable />
    </div>
  );
}
