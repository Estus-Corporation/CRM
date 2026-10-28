import { Globe, MapPin, Target } from 'lucide-react';
import { useContactLeadHunter } from '@/hooks/useContacts';
import type { Contact, LeadHunterInfo, LeadHunterPriority } from '@/services/contacts.service';
import { googleUrl, instagramHandle, instagramUrl, websiteLabel, websiteUrl } from '@/lib/captacao';
import { GoogleIcon, InstagramIcon } from '@/components/ui/BrandIcons';
import { QuickLink } from '@/components/ui/QuickLink';
import { Badge } from '@/components/ui/Badge';

const PRIORITY_VARIANT: Record<LeadHunterPriority, 'green' | 'manager' | 'default' | 'blue' | 'red'> = {
  high: 'green',
  medium: 'manager',
  low: 'default',
  review: 'blue',
  excluded: 'red',
};

const VISIBILITY_LABEL: Record<NonNullable<LeadHunterInfo['analysis']>['visibility'], string> = {
  not_measured: 'Visibilidade não medida',
  top: 'Boa visibilidade no Maps',
  middle: 'Visibilidade média no Maps',
  low: 'Baixa visibilidade no Maps',
};

/** Os dados vêm de terceiros: só http(s) vira link (bloqueia javascript:, data: etc.) */
function httpOnly(url: string | null | undefined): string | null {
  return url && /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm text-text-primary break-words">{children}</dd>
    </div>
  );
}

/** Dados de prospecção do contato (LeadHunter ou colunas próprias); não renderiza nada se não houver */
export function LeadHunterPanel({ contact }: { contact: Contact }) {
  const { data: info } = useContactLeadHunter(contact.id, contact.source === 'leadhunter');
  const analysis = info?.analysis ?? null;

  const mapsUrl = info?.mapsUrl ?? contact.maps_url ?? null;
  const address = info?.address ?? contact.address ?? null;
  const website = info?.website ?? contact.website ?? null;
  const instagram = info?.instagram ?? contact.instagram ?? null;
  const rating = info?.rating ?? contact.google_rating ?? null;
  const reviews = info?.reviews ?? contact.google_reviews ?? null;
  const score = analysis?.score ?? contact.lead_score ?? null;
  // Pode conter observações internas do operador: só como alternativa quando não há dados do LeadHunter
  const leadContext = info ? null : (contact.lead_context ?? null);
  const collectedAt = info ? new Date(info.collectedAt) : null;

  if (!info && !mapsUrl && !address && !website && !instagram && rating === null && score === null && !leadContext) {
    return null;
  }

  const mapsHref = mapsUrl || address
    ? httpOnly(googleUrl({ maps_url: mapsUrl, full_name: contact.full_name, company_name: info?.name ?? contact.company_name ?? null, address }))
    : null;
  const instagramHref = instagram ? httpOnly(instagramUrl(instagram)) : null;
  const isInstagramUnconfirmed = info?.instagramStatus === 'candidate' && !!instagram;
  const websiteHref = website ? httpOnly(websiteUrl(website)) : null;
  const candidates =
    info?.instagramStatus === 'candidate' && !instagram
      ? info.instagramCandidates.flatMap((c) => {
          const href = httpOnly(c.url);
          return href ? [{ ...c, url: href }] : [];
        })
      : [];

  const place = [info?.category, info?.borough, info?.city].filter(Boolean).join(' · ');

  return (
    <section className="card p-5 space-y-5" aria-labelledby="leadhunter-heading">
      <div className="flex flex-wrap items-center gap-3">
        <Target size={16} className="text-accent-green flex-shrink-0" aria-hidden />
        <h2 id="leadhunter-heading" className="font-semibold text-text-primary flex-1 min-w-0">
          Dados de prospecção
        </h2>
        {score !== null && (
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tabular-nums text-text-primary">{score}/100</span>
            {analysis && (
              <Badge variant={PRIORITY_VARIANT[analysis.priority]}>{analysis.priorityLabel}</Badge>
            )}
          </div>
        )}
      </div>

      {(mapsHref || instagramHref || websiteHref) && (
        <div className="flex flex-wrap items-center gap-2">
          {mapsHref && (
            <QuickLink href={mapsHref} label="Abrir no Google Maps">
              <GoogleIcon size={19} />
            </QuickLink>
          )}
          {instagramHref && instagram && (
            <QuickLink
              href={instagramHref}
              label={`Instagram ${instagramHandle(instagram)}${isInstagramUnconfirmed ? ' (não confirmado)' : ''}`}
            >
              <InstagramIcon size={23} />
            </QuickLink>
          )}
          {isInstagramUnconfirmed && (
            <span className="text-xs text-accent-amber">Instagram não confirmado: conferir o perfil.</span>
          )}
          {websiteHref && website && (
            <QuickLink href={websiteHref} label={`Site: ${websiteLabel(website)}`} className="text-text-primary">
              <Globe size={19} />
            </QuickLink>
          )}
        </div>
      )}

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {rating !== null && (
          <Fact label="Google">
            ★ {rating.toLocaleString('pt-BR')}
            {reviews !== null && ` (${reviews.toLocaleString('pt-BR')} avaliações)`}
          </Fact>
        )}
        {address && (
          <Fact label="Endereço">
            <span className="inline-flex items-start gap-1.5">
              <MapPin size={13} className="mt-1 flex-shrink-0 text-text-muted" aria-hidden />
              {address}
            </span>
          </Fact>
        )}
        {place && <Fact label="Segmento e região">{place}</Fact>}
        {analysis && (
          <Fact label="Visibilidade">
            {VISIBILITY_LABEL[analysis.visibility]}
            {analysis.visibility !== 'not_measured' && (
              <span className="block text-xs text-text-secondary">
                {[
                  analysis.rankMedian !== null && `${analysis.rankMedian}ª posição mediana`,
                  `${analysis.rankSamples} amostra${analysis.rankSamples === 1 ? '' : 's'}`,
                  analysis.coverage &&
                    `Presente em ${analysis.coverage.appeared} de ${analysis.coverage.searched} busca${analysis.coverage.searched === 1 ? '' : 's'}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          </Fact>
        )}
        {analysis && <Fact label="Completude dos dados">{analysis.completeness}%</Fact>}
      </dl>

      {analysis && analysis.reasons.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-primary mb-2">Por que priorizar</h3>
          <ul className="space-y-1.5 text-sm text-text-secondary">
            {analysis.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-9 flex-shrink-0 tabular-nums text-accent-green">
                  {r.points > 0 ? `+${r.points}` : r.points}
                </span>
                <span className="min-w-0 break-words">{r.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {candidates.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-primary mb-2">Possível perfil · confirmar</h3>
          <ul className="space-y-2">
            {candidates.map((c) => (
              <li key={c.url} className="text-sm min-w-0">
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-green hover:underline break-all"
                >
                  {c.title || c.url}
                </a>
                {c.description && <p className="text-xs text-text-secondary break-words">{c.description}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {leadContext && (
        <div>
          <h3 className="text-sm font-medium text-text-primary mb-1">Contexto</h3>
          <p className="text-sm text-text-secondary whitespace-pre-line break-words">{leadContext}</p>
        </div>
      )}

      {collectedAt && !Number.isNaN(collectedAt.getTime()) && (
        <p className="text-xs text-text-muted">Coletado em {collectedAt.toLocaleDateString('pt-BR')}</p>
      )}
    </section>
  );
}
