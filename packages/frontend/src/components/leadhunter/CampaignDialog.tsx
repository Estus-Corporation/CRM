import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useCreateCampaign } from '@/hooks/useLeadHunter';
import type { Campaign, LeadHunterSource } from '@/services/leadhunter.service';
import {
  CAMPAIGN_FIELDS_DEFAULTS,
  CampaignFields,
  campaignFieldsSchema,
  toCampaignInput,
  type CampaignFieldsValues,
} from './CampaignFields';

/** Formulário já preenchido (vindo de "Locais pesquisados"); sem isto abre vazio, em demonstração */
export interface CampaignPrefill {
  values: Partial<CampaignFieldsValues>;
  source: LeadHunterSource;
}

/** Local de busca por ponto: `lat,lon,zoomz` */
const isPoint = (location: string) => /^-?\d+(\.\d+)?,-?\d+(\.\d+)?,\d+z$/.test(location);

/**
 * Lê o contrato de `campaignFromSearchPath` (SearchCards): `keyword`, `location`, `force=1` e `campaign` (nicho de origem).
 * Ponto vai para os pontos de busca (a cidade vem da campanha de origem); senão o local é a cidade.
 */
export function prefillFromParams(params: URLSearchParams, campaigns: Campaign[]): CampaignPrefill {
  const location = params.get('location') ?? '';
  const origin = campaigns.find((c) => c.id === params.get('campaign'));
  const point = isPoint(location);
  return {
    source: 'live',
    values: {
      niche: origin?.config.niche ?? '',
      city: point ? (origin?.config.city ?? '') : location,
      keywords: params.get('keyword') ?? '',
      coordinates: point ? location : '',
      forceRefresh: params.get('force') === '1',
    },
  };
}

const SOURCES: { value: LeadHunterSource; title: string; hint: string }[] = [
  { value: 'demo', title: 'Demonstração', hint: 'Dados fictícios, sem chamadas externas' },
  { value: 'live', title: 'Coleta real', hint: 'Usa suas credenciais e saldo de API' },
];

function CampaignForm({ prefill, onClose, onCreated }: { prefill?: CampaignPrefill; onClose: () => void; onCreated: (id: string) => void }) {
  const [source, setSource] = useState<LeadHunterSource>(prefill?.source ?? 'demo');
  const create = useCreateCampaign();
  const form = useForm<CampaignFieldsValues>({
    resolver: zodResolver(campaignFieldsSchema),
    defaultValues: { ...CAMPAIGN_FIELDS_DEFAULTS, ...prefill?.values },
  });

  // Erros da API (credenciais, limite de chamadas) já saem em toast pelo hook
  const submit = form.handleSubmit((values) =>
    create.mutate(toCampaignInput(values, source), {
      onSuccess: ({ id }) => {
        toast.success('Campanha adicionada à fila.');
        onCreated(id);
        onClose();
      },
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="max-h-[calc(100dvh-10rem)] space-y-4 overflow-y-auto pr-1">
      <CampaignFields form={form} source={source} advancedOpen={!!prefill} />

      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-medium text-text-secondary">Como deseja pesquisar?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {SOURCES.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-fg/[0.1] bg-fg/[0.03] p-3 has-[:checked]:border-accent-green/60 has-[:checked]:bg-accent-green/[0.06]"
            >
              <input
                type="radio"
                name="lh-source"
                value={o.value}
                checked={source === o.value}
                onChange={() => setSource(o.value)}
                className="mt-0.5 h-4 w-4 accent-accent-green"
              />
              <span className="text-sm font-medium text-text-primary">
                {o.title}
                <span className="block text-xs font-normal text-text-muted">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Iniciando…' : 'Iniciar campanha'}
        </Button>
      </div>
    </form>
  );
}

interface Props {
  open: boolean;
  prefill?: CampaignPrefill;
  onClose: () => void;
  onCreated: (id: string) => void;
}

/** Nova campanha: demonstração ou coleta real. O formulário só existe com o modal aberto, então reinicia a cada abertura. */
export function CampaignDialog({ open, prefill, onClose, onCreated }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Nova campanha" description="Defina seu próximo mercado." className="max-w-xl">
      <CampaignForm prefill={prefill} onClose={onClose} onCreated={onCreated} />
    </Modal>
  );
}
