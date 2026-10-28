import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useLeadHunterStatus } from '@/hooks/useLeadHunter';

interface ProviderCardProps {
  symbol: string;
  title: string;
  /** `null` enquanto o status carrega */
  configured: boolean | null;
  configuredLabel: string;
  missingLabel: string;
  description: string;
  steps: string[];
  linkLabel: string;
  linkHref: string;
}

/** Só mostra se há credencial (booleano do servidor): a chave nunca chega ao navegador */
function ProviderCard({ symbol, title, configured, configuredLabel, missingLabel, description, steps, linkLabel, linkHref }: ProviderCardProps) {
  return (
    <article className="card flex flex-col gap-3 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent-green/15 text-lg font-bold text-accent-green">
          {symbol}
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          {configured === null ? (
            <Skeleton className="h-5 w-40 rounded-full" />
          ) : (
            <Badge variant={configured ? 'green' : 'default'}>{configured ? configuredLabel : missingLabel}</Badge>
          )}
        </div>
      </div>
      <p className="text-sm text-text-secondary">{description}</p>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-text-secondary">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="mt-auto pt-1">
        <Button asChild variant="secondary" size="sm">
          <a href={linkHref} target="_blank" rel="noopener noreferrer">
            {linkLabel}
            <ExternalLink size={13} />
          </a>
        </Button>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-fg/[0.05] px-4 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-text-primary">{value}</p>
    </div>
  );
}

export function IntegrationsPage() {
  const { data: status, isError, refetch } = useLeadHunterStatus();

  return (
    // mobile-sections: no celular cada bloco vira um card translúcido separado (ver globals.css)
    <div className="mobile-sections space-y-6 max-md:space-y-3">
      <PageHeader title="Integrações" subtitle="Credenciais e limites do LeadHunter" />

      {isError && (
        <p role="alert" className="text-sm text-status-lost">
          Não foi possível carregar o status das integrações.{' '}
          <button type="button" className="underline" onClick={() => void refetch()}>
            Tentar de novo
          </button>
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <ProviderCard
          symbol="G"
          title="Busca Maps e web"
          configured={status ? status.dataforseo : null}
          configuredLabel="Credenciais configuradas · não testadas"
          missingLabel="Aguardando credenciais"
          description="Descoberta de empresas e pesquisa de candidatos de Instagram via DataForSEO."
          steps={[
            'Crie sua conta e obtenha as credenciais da API.',
            'Defina DATAFORSEO_LOGIN e DATAFORSEO_PASSWORD nas variáveis do servidor.',
            'Reinicie o servidor.',
          ]}
          linkLabel="Abrir DataForSEO"
          linkHref="https://app.dataforseo.com/"
        />
        <ProviderCard
          symbol="J"
          title="Qualificação com Jev"
          configured={status ? status.jev : null}
          configuredLabel="Chave configurada · não testada"
          missingLabel="Regras locais disponíveis"
          description="Analisa a aderência ao nicho. Casos incertos continuam disponíveis para revisão."
          steps={[
            'Obtenha uma chave da TypeSafe.',
            'Defina TYPESAFE_API_KEY nas variáveis do servidor.',
            'Mantenha o modelo versionado ou ajuste após validar.',
            'Reinicie o servidor.',
          ]}
          linkLabel="Abrir TypeSafe"
          linkHref="https://console.typesafe.ai/keys"
        />
      </div>

      <section aria-label="Controle de consumo" className="space-y-3">
        <h2 className="text-base font-semibold text-text-primary">Controle de consumo</h2>
        {status ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Chamadas por campanha" value={`até ${status.runLimit.toLocaleString('pt-BR')}`} />
            <Stat label="Chamadas por dia (UTC)" value={`até ${status.dailyLimit.toLocaleString('pt-BR')}`} />
            <Stat label="Chamadas hoje" value={`${status.callsToday.toLocaleString('pt-BR')} de ${status.dailyLimit.toLocaleString('pt-BR')}`} />
            <Stat label="Modelo Jev configurado" value={status.jevModel} />
          </div>
        ) : (
          !isError && <Skeleton className="h-16 w-full rounded-xl" />
        )}
        <p className="text-sm text-text-secondary">
          O limite diário é compartilhado entre todos os workspaces. Os limites contam tentativas, inclusive falhas. Chamadas pagas não se
          repetem automaticamente. Tokens Jev e custos informados pela busca são registrados separadamente.
        </p>
      </section>
    </div>
  );
}
