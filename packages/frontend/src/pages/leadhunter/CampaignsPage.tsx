import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileUp, Plus, Radar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SelectField } from '@/components/ui/SelectField';
import { Skeleton } from '@/components/ui/Skeleton';
import { CampaignDialog, prefillFromParams, type CampaignPrefill } from '@/components/leadhunter/CampaignDialog';
import { CampaignView } from '@/components/leadhunter/CampaignView';
import { shortCity, STATE_LABEL } from '@/components/leadhunter/CampaignSummary';
import { formatDate } from '@/components/leadhunter/companyLabels';
import { ImportDialog } from '@/components/leadhunter/ImportDialog';
import { useCampaigns, useCreateCampaign } from '@/hooks/useLeadHunter';
import { cn } from '@/lib/utils';
import type { Campaign, CampaignInput } from '@/services/leadhunter.service';

// Mesma campanha de demonstração do LeadHunter
const DEMO_CAMPAIGN: CampaignInput = {
  niche: 'Loja de moda feminina',
  city: 'São Carlos,São Paulo,Brazil',
  service: 'google',
  source: 'demo',
  limit: 10,
  keywords: ['moda feminina São Carlos', 'boutique feminina São Carlos', 'roupas femininas São Carlos'],
};

/** Parâmetros que "Locais pesquisados" manda para abrir o formulário preenchido */
const PREFILL_PARAMS = ['novo', 'keyword', 'location', 'force', 'campaign'];

function CampaignList({ campaigns, selectedId, onSelect }: { campaigns: Campaign[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <nav aria-label="Campanhas recentes" className="card p-2">
      <p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">Campanhas recentes</p>
      <ul className="space-y-1">
        {campaigns.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={c.id === selectedId ? 'true' : undefined}
              className={cn(
                'w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-fg/[0.05]',
                c.id === selectedId && 'bg-accent-green/[0.1] ring-1 ring-accent-green/30',
              )}
            >
              <span className="block break-words text-sm font-medium text-text-primary">{c.config.niche}</span>
              <span className="block break-words text-xs text-text-muted">
                {shortCity(c.config.city)} · {STATE_LABEL[c.state] ?? c.state}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function CampaignsPage() {
  const [params, setParams] = useSearchParams();
  const campaigns = useCampaigns();
  const createDemo = useCreateCampaign();
  const [dialog, setDialog] = useState<'campaign' | 'import' | null>(null);
  const [prefill, setPrefill] = useState<CampaignPrefill | undefined>(undefined);

  const list = campaigns.data ?? [];
  const wanted = params.get('c');
  // Lista mais nova primeiro; `?c=` que não existe mais cai na mais recente
  const selectedId = list.find((c) => c.id === wanted)?.id ?? list[0]?.id ?? null;

  const select = (id: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('c', id);
        return next;
      },
      { replace: true },
    );

  // "Nova campanha com este local" / "Atualizar agora": abre o formulário preenchido e limpa a URL.
  // Espera a lista carregar para achar o nicho da campanha de origem.
  const wantsNew = params.get('novo') === '1';
  useEffect(() => {
    if (!wantsNew || !campaigns.isFetched) return;
    setPrefill(prefillFromParams(params, campaigns.data ?? []));
    setDialog('campaign');
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const key of PREFILL_PARAMS) next.delete(key);
        return next;
      },
      { replace: true },
    );
  }, [wantsNew, campaigns.isFetched, campaigns.data, params, setParams]);

  const openNew = () => {
    setPrefill(undefined);
    setDialog('campaign');
  };
  const startDemo = () => createDemo.mutate(DEMO_CAMPAIGN, { onSuccess: ({ id }) => select(id) });

  return (
    // mobile-sections: no celular cada bloco vira um card translúcido separado (ver globals.css)
    <div className="mobile-sections space-y-6 max-md:space-y-3">
      <PageHeader
        title="Campanhas"
        subtitle="Empresas locais, contatos e motivos para uma boa abordagem"
        actions={
          <>
            <Button variant="secondary" className="max-sm:flex-1" onClick={() => setDialog('import')}>
              <FileUp size={15} />
              Importar lista
            </Button>
            <Button className="max-sm:flex-1" onClick={openNew}>
              <Plus size={15} />
              Nova campanha
            </Button>
          </>
        }
      />

      {campaigns.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : campaigns.isError ? (
        <div className="card">
          <EmptyState
            icon={Radar}
            title="Não foi possível carregar as campanhas"
            description="Verifique a conexão e tente de novo."
            action={{ label: 'Tentar de novo', onClick: () => void campaigns.refetch() }}
          />
        </div>
      ) : !selectedId ? (
        <div className="card">
          <EmptyState
            icon={Radar}
            title="Um nicho. Uma região. Novas oportunidades."
            description="Crie sua primeira campanha ou explore uma amostra fictícia (10 empresas, sem credenciais e sem custo)."
            action={{ label: createDemo.isPending ? 'Criando…' : 'Explorar demonstração', onClick: startDemo }}
          />
        </div>
      ) : (
        <div className="mobile-split grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <CampaignList campaigns={list} selectedId={selectedId} onSelect={select} />
          </aside>
          <div className="mobile-split flex min-w-0 flex-col gap-5 max-md:gap-3">
            <div className="lg:hidden">
              <SelectField
                label="Trocar campanha"
                aria-label="Trocar campanha"
                value={selectedId}
                onChange={(e) => select(e.target.value)}
                options={list.map((c) => ({ value: c.id, label: `${c.config.niche} · ${shortCity(c.config.city)} · ${formatDate(c.createdAt)}` }))}
              />
            </div>
            <CampaignView key={selectedId} campaignId={selectedId} />
          </div>
        </div>
      )}

      <CampaignDialog open={dialog === 'campaign'} prefill={prefill} onClose={() => setDialog(null)} onCreated={select} />
      <ImportDialog open={dialog === 'import'} onClose={() => setDialog(null)} onCreated={select} />
    </div>
  );
}
