import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useCompanyHistory } from '@/hooks/useLeadHunter';
import type { Company, SearchCoverage } from '@/services/leadhunter.service';
import { CRM_LABEL, fitLabel, formatBrPhone, formatDate, formatNumber, safeUrl } from './companyLabels';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-fg/[0.08] pt-5">
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {children}
    </section>
  );
}

export const Hint = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn('text-xs leading-relaxed text-text-muted', className)}>{children}</p>
);

/** Link externo só para URL http/https; senão mostra o texto puro */
export function ExtLink({ url, label, button }: { url: string | null; label: string; button?: boolean }) {
  const href = safeUrl(url);
  if (!href) return <>{label}</>;
  const link = (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 break-all text-accent-green hover:underline">
      {label}
      <ExternalLink size={13} className="flex-shrink-0" aria-hidden />
    </a>
  );
  if (!button) return link;
  return (
    <Button asChild variant="secondary" size="sm">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {label}
        <ExternalLink size={13} aria-hidden />
      </a>
    </Button>
  );
}

const Pair = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <span className="text-xs text-text-muted">{label}</span>
    <p className="break-words text-sm text-text-primary">{children}</p>
  </div>
);

export function MainInfo({ company }: { company: Company }) {
  const host = (() => {
    try {
      return new URL(company.website ?? '').hostname || company.website || '';
    } catch {
      return company.website ?? '';
    }
  })();
  return (
    <Section title="Informações principais">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Pair label="Telefone comercial">{formatBrPhone(company.phone) || 'Não informado'}</Pair>
        <Pair label="Categoria">{company.category || 'Não informada'}</Pair>
        <Pair label="Site">{company.website ? <ExtLink url={company.website} label={host} /> : 'Não informado pela fonte'}</Pair>
        <Pair label="Avaliações">
          {formatNumber(company.rating)} / 5 · {formatNumber(company.reviews)} avaliações
        </Pair>
      </div>
      <div className="flex flex-wrap gap-2">
        {company.mapsUrl && <ExtLink url={company.mapsUrl} label="Abrir no Google Maps" button />}
        {company.sourceUrl && <ExtLink url={company.sourceUrl} label="Ver fonte" button />}
      </div>
      <Hint>Coletado em {formatDate(company.collectedAt)}. Telefone informado não significa WhatsApp confirmado.</Hint>
    </Section>
  );
}

export function Reasons({ company }: { company: Company }) {
  const reasons = company.analysis?.reasons ?? [];
  return (
    <Section title="Por que conferir esta empresa?">
      <ul className="space-y-1.5">
        {reasons.length ? (
          reasons.map((r, i) => (
            <li key={`${r.text}-${i}`} className="flex gap-2 text-sm text-text-secondary">
              <b className="flex-shrink-0 tabular-nums text-accent-green">+{r.points}</b>
              <span className="min-w-0 break-words">{r.text}</span>
            </li>
          ))
        ) : (
          <li className="text-sm text-text-secondary">Dados insuficientes para pontuar.</li>
        )}
      </ul>
      <Hint>{fitLabel(company.analysis?.fit)}. Pontuação v1 de triagem; não estima intenção de compra.</Hint>
    </Section>
  );
}

const Observed = ({ title, detail, link }: { title: string; detail: string; link?: ReactNode }) => (
  <div className="rounded-xl border border-fg/[0.08] bg-fg/[0.03] px-3 py-2">
    <p className="break-words text-sm font-medium text-text-primary">{title}</p>
    <p className="break-words text-xs text-text-muted">{detail}</p>
    {link && <p className="mt-1 text-xs">{link}</p>}
  </div>
);

export function Visibility({ company, coverage }: { company: Company; coverage: SearchCoverage[] }) {
  const observations = company.observations ?? [];
  const seen = new Set(observations.filter((o) => o.rank != null).map((o) => `${o.query}\n${o.location}`));
  const absences = coverage.filter((s) => !seen.has(`${s.query}\n${s.location}`));
  const summary = company.analysis?.coverage;
  return (
    <Section title="Visibilidade observada">
      {summary && (
        <Hint>
          Presente em {summary.appeared} de {summary.searched} busca(s) concluída(s). Ausência na amostra não é posição nem prova de falta de presença.
        </Hint>
      )}
      {observations.map((o) => (
        <Observed
          key={`${o.query}|${o.location}|${o.observedAt}`}
          title={`${o.query} · posição ${o.rank ?? 'não medida'}`}
          detail={`${o.location} · ${formatDate(o.observedAt)} · limite ${o.depth} resultados`}
          link={o.sourceUrl ? <ExtLink url={o.sourceUrl} label="Conferir busca" /> : undefined}
        />
      ))}
      {absences.map((s) => (
        <Observed
          key={`${s.query}|${s.location}|${s.observedAt}`}
          title={`${s.query} · não apareceu`}
          detail={`${s.location} · ${formatDate(s.observedAt)} · nos primeiros ${s.depth} resultados`}
        />
      ))}
      {!observations.length && !absences.length && <Hint>Não há medição de posição para esta empresa.</Hint>}
      <Hint>Mediana somente das posições encontradas. A amostra não representa toda a cidade.</Hint>
    </Section>
  );
}

/** Só aparece quando a empresa foi vista em 2+ campanhas */
export function History({ companyId }: { companyId: string }) {
  const { data } = useCompanyHistory(companyId);
  if (!data || new Set(data.map((h) => h.campaignId)).size < 2) return null;
  return (
    <Section title="Histórico entre campanhas">
      {data.map((h) => (
        <Observed
          key={`${h.campaignId}|${h.query}|${h.location}|${h.observedAt}`}
          title={`${h.query} · ${h.rank != null ? `posição ${h.rank}` : 'posição não medida'}`}
          detail={`${h.location} · ${formatDate(h.observedAt)} · ${h.niche}`}
        />
      ))}
      <Hint>Posições observadas em datas e buscas diferentes; compare apenas o mesmo termo e local.</Hint>
    </Section>
  );
}

export function CrmStatus({ company }: { company: Company }) {
  const crm = company.crm;
  return (
    <Section title="No CRM">
      {!crm ? (
        <p className="text-sm text-text-secondary">Não enviado</p>
      ) : (
        <div className="space-y-1">
          <p className={cn('text-sm font-medium', crm.status === 'error' ? 'text-status-lost' : 'text-text-primary')}>
            {CRM_LABEL[crm.status]}
            <span className="font-normal text-text-muted"> · {formatDate(crm.sentAt)}</span>
          </p>
          {crm.status === 'error' && crm.error && <p className="break-words text-xs text-status-lost">{crm.error}</p>}
          {crm.contactId && (
            <Link to={`/contacts/${crm.contactId}`} className="inline-flex items-center gap-1.5 text-sm text-accent-green hover:underline">
              Abrir contato
            </Link>
          )}
        </div>
      )}
    </Section>
  );
}
