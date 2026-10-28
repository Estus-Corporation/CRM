import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, RefreshCw, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { SearchRow } from '@/services/leadhunter.service';

/** Local de busca por ponto: `lat,lon,zoomz` (ex.: -22.01,-47.89,14z) */
const isPoint = (location: string) => /^-?\d+(\.\d+)?,-?\d+(\.\d+)?,\d+z$/.test(location);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * Contrato com a tela Campanhas (T9): abre `/leadhunter?novo=1&keyword=<termo>&location=<local>[&force=1][&campaign=<id>]`.
 * - `novo=1`: abrir o formulário de nova campanha, já preenchido.
 * - `keyword`: termo da busca; vai para o campo de termos.
 * - `location`: local da busca como salvo. Ponto (`lat,lon,zoomz`) vai para os pontos; senão é a cidade.
 * - `force=1` (só em "Atualizar agora"): "Forçar busca nova" marcado.
 * - `campaign` (opcional): id da campanha que originou a busca, para preencher o nicho (o formulário o exige).
 * Os valores saem codificados por `URLSearchParams`; o consumidor lê com `useSearchParams`.
 */
export function campaignFromSearchPath(search: SearchRow, force: boolean): string {
  const params = new URLSearchParams({ novo: '1', keyword: search.keyword, location: search.location });
  if (force) params.set('force', '1');
  if (search.campaignId) params.set('campaign', search.campaignId);
  return `/leadhunter?${params.toString()}`;
}

/** Só a execução mais recente de cada busca (a lista vem da mais nova para a mais antiga), agrupada por local */
function groupByLocation(searches: SearchRow[]): [string, SearchRow[]][] {
  const seen = new Set<string>();
  const groups = new Map<string, SearchRow[]>();
  for (const s of searches) {
    if (seen.has(s.cacheKey)) continue;
    seen.add(s.cacheKey);
    groups.set(s.location, [...(groups.get(s.location) ?? []), s]);
  }
  return [...groups.entries()];
}

export function SearchCards({ searches }: { searches: SearchRow[] }) {
  const navigate = useNavigate();
  const groups = useMemo(() => groupByLocation(searches), [searches]);

  if (groups.length === 0) {
    return (
      <div className="card">
        <EmptyState icon={MapPin} title="Nenhuma busca paga salva ainda" description="As coletas reais aparecem aqui." />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map(([location, items]) => (
        <article key={location} className="card p-4">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-text-primary">
            <MapPin size={15} className="flex-shrink-0 text-accent-green" />
            <span className="min-w-0 break-words">{isPoint(location) ? `Ponto ${location}` : location}</span>
          </h3>
          <div className="mt-3 divide-y-[1.5px] divide-fg/[0.14]">
            {items.map((s) => (
              <div key={s.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="min-w-0 break-words text-sm font-medium text-text-primary">{s.keyword}</strong>
                  {s.expired && <Badge>expirada</Badge>}
                </div>
                <p className="text-xs leading-relaxed text-text-muted">
                  {formatDate(s.executedAt)} · {s.resultCount.toLocaleString('pt-BR')} empresas ·{' '}
                  {s.cost != null ? `US$ ${s.cost.toFixed(4)}` : 'custo não informado'} · reaproveitada {s.reuseCount}x · profundidade{' '}
                  {s.depth}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => navigate(campaignFromSearchPath(s, false))}>
                    <Plus size={13} />
                    Nova campanha com este local
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate(campaignFromSearchPath(s, true))}>
                    <RefreshCw size={13} />
                    Atualizar agora
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
