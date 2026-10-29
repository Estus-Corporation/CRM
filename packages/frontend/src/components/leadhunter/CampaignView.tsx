import { useMemo, useState } from 'react';
import { Download, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCampaign, useExportCampaign } from '@/hooks/useLeadHunter';
import { downloadBlob } from '@/lib/utils';
import type { CompanyFilters } from '@/services/leadhunter.service';
import { CampaignSummary, isActive } from './CampaignSummary';
import { CompaniesTable, filterCompanies } from './CompaniesTable';
import { CompanyDrawer } from './CompanyDrawer';
import { SendContactsDialog } from './SendContactsDialog';

/** Filtro vazio não vai na URL do CSV */
const activeFilters = ({ q, priority, stage }: CompanyFilters): CompanyFilters => ({
  ...(q?.trim() && { q: q.trim() }),
  ...(priority && { priority }),
  ...(stage && { stage }),
});

/** Uma campanha: resumo, lista de empresas, ficha, exportação e envio ao CRM. O pai usa `key={campaignId}` para reiniciar filtros e seleção. */
export function CampaignView({ campaignId }: { campaignId: string }) {
  const { data, isLoading, isError, refetch } = useCampaign(campaignId);
  const exportCsv = useExportCampaign();
  const [filters, setFilters] = useState<CompanyFilters>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const companies = useMemo(() => data?.companies ?? [], [data]);
  // Seleção só vale para empresas ainda na campanha (excluir uma na ficha a tira daqui)
  const selectedIds = useMemo(() => new Set(companies.filter((c) => selected.has(c.id)).map((c) => c.id)), [companies, selected]);
  const visible = filterCompanies(companies, filters);
  const openCompany = companies.find((c) => c.id === openId) ?? null;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="card">
        <EmptyState
          icon={UserPlus}
          title="Não foi possível carregar a campanha"
          description="Verifique a conexão e tente de novo."
          action={{ label: 'Tentar de novo', onClick: () => void refetch() }}
        />
      </div>
    );
  }

  const { campaign, usage, coverage } = data;
  const download = () =>
    exportCsv.mutate(
      { id: campaign.id, filters: activeFilters(filters) },
      { onSuccess: (blob) => downloadBlob(blob, `leadhunter-${campaign.config.niche.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.csv`) },
    );

  return (
    <>
      <CampaignSummary campaign={campaign} companies={companies} usage={usage} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-text-primary">
          Lista de prospecção
          <span className="rounded-full bg-fg/[0.08] px-2 py-0.5 text-xs font-semibold tabular-nums text-text-secondary">{visible.length}</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={visible.length === 0 || exportCsv.isPending} onClick={download}>
            <Download size={14} />
            {exportCsv.isPending ? 'Exportando…' : 'Exportar CSV'}
          </Button>
          <Button
            size="sm"
            disabled={companies.length === 0 || campaign.config.source === 'demo'}
            title={campaign.config.source === 'demo' ? 'Empresas de demonstração não são enviadas ao CRM.' : undefined}
            onClick={() => setSending(true)}
          >
            <UserPlus size={14} />
            Criar contatos{selectedIds.size ? ` (${selectedIds.size})` : ''}
          </Button>
        </div>
      </div>

      <CompaniesTable
        companies={companies}
        filters={filters}
        onFiltersChange={setFilters}
        selected={selectedIds}
        onSelectedChange={setSelected}
        onOpen={setOpenId}
        emptyDescription={isActive(campaign) ? campaign.message || 'Aguarde o processamento da campanha.' : 'Esta campanha não encontrou empresas.'}
      />

      <p className="text-xs leading-relaxed text-text-muted">
        <strong className="text-text-secondary">Evidências antes da abordagem.</strong> Uma busca é uma amostra. Confira região, identidade e contatos na
        ficha de cada empresa.
      </p>

      <CompanyDrawer company={openCompany} campaign={campaign} coverage={coverage} onClose={() => setOpenId(null)} />
      <SendContactsDialog
        open={sending}
        onClose={() => setSending(false)}
        campaignId={campaign.id}
        companies={companies}
        selectedIds={selectedIds}
      />
    </>
  );
}
