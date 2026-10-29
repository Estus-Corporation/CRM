import { forwardRef, useState } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { useEstimate, useLeadHunterStatus } from '@/hooks/useLeadHunter';
import { cn } from '@/lib/utils';
import type { CampaignInput, LeadHunterService, LeadHunterSource } from '@/services/leadhunter.service';

// Campos do formulário de campanha, compartilhados com o pedido de leads (Task 13). Limites iguais aos do backend (validateCampaign).

const MAX_TERMS = 3;
const MAX_POINTS = 3;
const MAX_TERM_LENGTH = 180;
const POINT_MESSAGE = 'Ponto deve ser latitude,longitude,zoom (ex.: -22.0174,-47.8909,14z).';

export const SERVICE_OPTIONS: { value: LeadHunterService; label: string }[] = [
  { value: 'google', label: 'Presença no Google' },
  { value: 'website', label: 'Criação de site' },
  { value: 'marketing', label: 'Marketing digital' },
];

/** Termos: um por linha; vírgula e ponto e vírgula também separam */
const splitTerms = (value: string) => value.split(/[\n\r,;]+/).map((s) => s.trim()).filter(Boolean);
const splitLines = (value: string) => value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

const inRange = (raw: string | undefined, min: number, max: number) => {
  const n = Number(raw);
  return raw !== undefined && raw !== '' && Number.isFinite(n) && n >= min && n <= max;
};

/** lat,lon,zoom — zoom inteiro de 3 a 21, "z" final opcional */
function isSearchPoint(point: string): boolean {
  const [lat, lon, zoom, ...rest] = point.replace(/ /g, '').split(',');
  const zoomValue = zoom?.replace(/z$/, '');
  return rest.length === 0 && inRange(lat, -90, 90) && inRange(lon, -180, 180) && inRange(zoomValue, 3, 21) && Number.isInteger(Number(zoomValue));
}

export const campaignFieldsSchema = z.object({
  niche: z.string().trim().min(1, 'Informe o nicho.').max(100, 'O nicho deve ter até 100 caracteres.'),
  city: z.string().trim().min(1, 'Informe a cidade.').max(100, 'A cidade deve ter até 100 caracteres.'),
  service: z.enum(['google', 'website', 'marketing']),
  limit: z
    .number({ invalid_type_error: 'Informe a quantidade de empresas.' })
    .int('Informe um número inteiro.')
    .min(1, 'A quantidade mínima é 1.')
    .max(50, 'A quantidade máxima é 50.'),
  keywords: z
    .string()
    .refine((v) => splitTerms(v).length <= MAX_TERMS, 'Use de um a três termos de busca.')
    .refine((v) => splitTerms(v).every((t) => t.length <= MAX_TERM_LENGTH), `Cada termo deve ter até ${MAX_TERM_LENGTH} caracteres.`),
  coordinates: z
    .string()
    .refine((v) => splitLines(v).length <= MAX_POINTS, 'Use até três pontos de busca.')
    .refine((v) => splitLines(v).every(isSearchPoint), POINT_MESSAGE),
  enrich: z.boolean(),
  useJev: z.boolean(),
  forceRefresh: z.boolean(),
});

export type CampaignFieldsValues = z.infer<typeof campaignFieldsSchema>;

export const CAMPAIGN_FIELDS_DEFAULTS: CampaignFieldsValues = {
  niche: '',
  city: '',
  service: 'google',
  limit: 10,
  keywords: '',
  coordinates: '',
  enrich: true,
  useJev: true,
  forceRefresh: false,
};

/** Valores validados do formulário → corpo da API (termos e pontos viram listas; vazio = padrão do backend) */
export function toCampaignInput(values: CampaignFieldsValues, source: LeadHunterSource): CampaignInput {
  return {
    niche: values.niche,
    city: values.city,
    source,
    service: values.service,
    limit: values.limit,
    keywords: splitTerms(values.keywords),
    coordinates: splitLines(values.coordinates),
    enrich: values.enrich,
    useJev: values.useJev,
    forceRefresh: values.forceRefresh,
  };
}

const errorText = (err: unknown) =>
  (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Não foi possível estimar as chamadas.';

/** Quantas chamadas pagas a coleta real faria (debounce de 400 ms no hook) */
function EstimateLine({ form, source }: { form: UseFormReturn<CampaignFieldsValues>; source: LeadHunterSource }) {
  const values = useWatch({ control: form.control });
  const status = useLeadHunterStatus();
  const parsed = campaignFieldsSchema.safeParse(values);
  const estimate = useEstimate(source === 'live' && parsed.success ? toCampaignInput(parsed.data, 'live') : null);

  let text: string;
  if (source !== 'live') text = 'Demonstração: até 10 empresas fictícias e nenhuma chamada de API.';
  else if (!parsed.success) text = 'Preencha nicho, cidade e quantidade para estimar as chamadas.';
  else if (estimate.isError) text = errorText(estimate.error);
  else if (!estimate.data) text = 'Calculando…';
  else {
    const { reused, searches, calls } = estimate.data;
    text =
      `${reused} de ${searches} consulta${searches > 1 ? 's' : ''} reaproveitada${searches > 1 ? 's' : ''} · até ${calls} chamada(s) paga(s) nesta campanha.` +
      (status.data ? ` Limite configurado: ${status.data.runLimit}.` : '') +
      (status.data && !status.data.dataforseo ? ' Configure a busca em Integrações antes de iniciar.' : '');
  }
  return (
    <p aria-live="polite" className={cn('text-xs leading-relaxed', estimate.isError && source === 'live' ? 'text-status-lost' : 'text-text-muted')}>
      {text}
    </p>
  );
}

interface Props {
  form: UseFormReturn<CampaignFieldsValues>;
  /** Teto da quantidade de empresas (padrão 50) */
  maxLimit?: number;
  /** `demo` não estima chamadas pagas (padrão `live`) */
  source?: LeadHunterSource;
  /** "Avançado" já aberto (ex.: formulário preenchido a partir de Locais pesquisados) */
  advancedOpen?: boolean;
}

const Check = forwardRef<HTMLInputElement, { label: string } & React.InputHTMLAttributes<HTMLInputElement>>(({ label, ...props }, ref) => (
  <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
    <input ref={ref} type="checkbox" className="h-4 w-4 accent-accent-green" {...props} />
    {label}
  </label>
));
Check.displayName = 'Check';

/** Campos da campanha + "Avançado" recolhível + linha de estimativa. Quem usa fornece o `useForm` com `campaignFieldsSchema`. */
export function CampaignFields({ form, maxLimit = 50, source = 'live', advancedOpen = false }: Props) {
  const {
    register,
    formState: { errors },
  } = form;
  const [open, setOpen] = useState(advancedOpen);
  // Erro dentro do "Avançado" fechado ficaria invisível: abre sozinho
  const showAdvanced = open || !!errors.keywords || !!errors.coordinates;
  const cap = Math.min(maxLimit, 50);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="lh-niche" label="Nicho" maxLength={100} placeholder="Loja de moda feminina" error={errors.niche?.message} {...register('niche')} />
        <div>
          <Input
            id="lh-city"
            label="Cidade e região"
            maxLength={100}
            placeholder="Sao Carlos,State of Sao Paulo,Brazil"
            error={errors.city?.message}
            {...register('city')}
          />
          <p className="mt-1 text-xs text-text-muted">Na coleta real, use o nome da localidade reconhecido pelo provedor.</p>
        </div>
        <SelectField id="lh-service" label="Serviço que você oferece" options={SERVICE_OPTIONS} error={errors.service?.message} {...register('service')} />
        <Input
          id="lh-limit"
          type="number"
          inputMode="numeric"
          min={1}
          max={cap}
          label={`Quantidade máxima (até ${cap})`}
          error={errors.limit?.message}
          {...register('limit', { valueAsNumber: true })}
        />
      </div>

      <details open={showAdvanced} onToggle={(e) => setOpen(e.currentTarget.open)} className="rounded-xl border border-fg/[0.08] bg-fg/[0.02] px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-text-primary">Ajustar termos, pontos e enriquecimento</summary>
        <div className="mt-4 space-y-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">Termos de busca</span>
            <textarea
              rows={3}
              className="input-base"
              placeholder="Até três termos, um por linha (vírgula ou ponto e vírgula também separam). Em branco: nicho + cidade."
              {...register('keywords')}
            />
            {errors.keywords && <span className="text-xs text-status-lost">{errors.keywords.message}</span>}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">Pontos de busca (opcional)</span>
            <textarea rows={2} className="input-base" placeholder="latitude,longitude,zoom — um por linha. Ex.: -22.0174,-47.8909,14z" {...register('coordinates')} />
            {errors.coordinates ? (
              <span className="text-xs text-status-lost">{errors.coordinates.message}</span>
            ) : (
              <span className="text-xs text-text-muted">Sem pontos, a busca usa a localidade informada.</span>
            )}
          </label>
          <div className="space-y-2">
            <Check label="Procurar Instagram em resultados públicos" {...register('enrich')} />
            <Check label="Usar Jev para analisar o nicho, quando configurado" {...register('useJev')} />
            <Check label="Forçar busca nova (ignora buscas salvas e paga de novo)" {...register('forceRefresh')} />
          </div>
        </div>
      </details>

      <EstimateLine form={form} source={source} />
    </div>
  );
}
