import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useCancelCampaign } from '@/hooks/useLeadHunter';
import type { Campaign, CampaignState, CampaignUsage, Company } from '@/services/leadhunter.service';
import { formatDate, formatNumber } from './companyLabels';

export const STATE_LABEL: Record<CampaignState, string> = {
  importing: 'Importando',
  queued: 'Na fila',
  running: 'Em execução',
  completed: 'Concluída',
  partial: 'Concluída em parte',
  failed: 'Falhou',
  cancelled: 'Cancelada',
  interrupted: 'Interrompida',
};

export const isActive = (c: Campaign) => c.state === 'queued' || c.state === 'running';

const PROBLEM_STATES: CampaignState[] = ['failed', 'partial', 'interrupted', 'cancelled'];
const HIDDEN_STAGES = ['discarded', 'do_not_contact'];

function sourceBadge(campaign: Campaign) {
  const { source, leadRequestId } = campaign.config;
  if (leadRequestId) return <Badge variant="manager">Pedido de leads</Badge>;
  if (source === 'demo') return <Badge variant="blue">DADOS FICTÍCIOS</Badge>;
  return <Badge>{source === 'import' ? 'BASE IMPORTADA' : 'COLETA REAL'}</Badge>;
}

/** "Sao Carlos,State of Sao Paulo,Brazil" → "Sao Carlos · State of Sao Paulo" */
export const shortCity = (city: string) => city.split(',').slice(0, 2).join(' · ');

function usageLine(usage: CampaignUsage[]): string {
  return usage
    .map(
      (u) =>
        `${u.provider === 'typesafe' ? 'Jev' : 'Busca'}: ${u.calls} chamada(s)` +
        (u.cost != null ? ` · US$ ${u.cost.toFixed(4)}` : '') +
        (u.tokens ? ` · ${formatNumber(u.tokens)} tokens` : '') +
        (u.incomplete ? ` · ${u.incomplete} sem sucesso confirmado` : ''),
    )
    .join(' | ');
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <article className="card p-4">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-text-primary">{formatNumber(value)}</p>
      <p className="mt-1 text-xs text-text-muted">{hint}</p>
    </article>
  );
}

interface Props {
  campaign: Campaign;
  companies: Company[];
  usage: CampaignUsage[];
}

/** Cabeçalho da campanha: selo, avisos, progresso com cancelamento, totais e consumo */
export function CampaignSummary({ campaign, companies, usage }: Props) {
  const cancel = useCancelCampaign();
  const notices = [...new Set([...(PROBLEM_STATES.includes(campaign.state) ? [campaign.message] : []), ...campaign.warnings])].filter(Boolean);
  const progress = Math.max(0, Math.min(100, campaign.progress));
  const high = companies.filter((c) => c.analysis?.priority === 'high' && !HIDDEN_STAGES.includes(c.stage)).length;
  const withContact = companies.filter((c) => c.phone || c.instagramStatus === 'confirmed').length;
  const lowVisibility = companies.filter((c) => c.analysis?.visibility === 'low').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold text-text-primary">{campaign.config.niche}</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {shortCity(campaign.config.city)} · {formatDate(campaign.createdAt)} · {STATE_LABEL[campaign.state] ?? campaign.state}
          </p>
        </div>
        {sourceBadge(campaign)}
      </div>

      {notices.map((n) => (
        <p key={n} role="note" className="rounded-xl bg-accent-amber/10 px-3 py-2 text-sm text-accent-amber">
          {n}
        </p>
      ))}

      {isActive(campaign) && (
        <div className="card space-y-2 p-4">
          <div className="flex items-center justify-between gap-3">
            <p role="status" className="min-w-0 break-words text-sm text-text-primary">
              {campaign.message || 'Aguardando início…'}
            </p>
            <Button
              variant="ghost"
              size="sm"
              disabled={campaign.cancelRequested || cancel.isPending}
              onClick={() => cancel.mutate(campaign.id)}
            >
              {campaign.cancelRequested ? 'Cancelando…' : 'Cancelar busca'}
            </Button>
          </div>
          <div role="progressbar" aria-label="Progresso da campanha" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-2 overflow-hidden rounded-full bg-fg/[0.08]">
            <div className="h-full rounded-full bg-accent-green transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Empresas encontradas" value={companies.length} hint="Na campanha selecionada" />
        <Stat label="Prioridade alta" value={high} hint="Oportunidades para conferir" />
        <Stat label="Contato disponível" value={withContact} hint="Telefone ou Instagram confirmado" />
        <Stat label="Baixa visibilidade" value={lowVisibility} hint="Mediana acima de 10 na amostra" />
      </div>

      {usage.length > 0 && <p className="text-xs leading-relaxed text-text-muted">{usageLine(usage)}</p>}
    </div>
  );
}
