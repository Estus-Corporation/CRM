import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { captacaoService } from '@/services/captacao.service';
import { useCaptadores } from '@/hooks/useCaptacao';
import { useContactNiches } from '@/hooks/useContacts';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const schema = z.object({
  fullName: z.string().trim().min(1, 'Nome é obrigatório').max(255),
  phone: z.string().trim().max(50),
  email: z.string().trim().email('E-mail inválido').max(255).or(z.literal('')),
  companyName: z.string().trim().max(255),
  jobTitle: z.string().trim().max(255),
  niche: z.string().trim().max(100),
  address: z.string().trim().max(500),
  mapsUrl: z.string().trim().max(1000),
  instagram: z.string().trim().max(255),
  website: z.string().trim().max(500),
  leadContext: z.string().trim().max(5000),
  captadorId: z.string(),
});

type FormData = z.infer<typeof schema>;

const EMPTY: FormData = {
  fullName: '', phone: '', email: '', companyName: '', jobTitle: '', niche: '',
  address: '', mapsUrl: '', instagram: '', website: '', leadContext: '', captadorId: '',
};

/**
 * Cadastro rápido de lead, sem planilha. "Salvar e adicionar outro" mantém nicho e captador,
 * pra digitar uma lista inteira em sequência. Pode entregar direto a um captador.
 */
export function AddLeadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: captadores = [] } = useCaptadores();
  const { data: niches = [] } = useContactNiches();
  const [added, setAdded] = useState(0);
  const [saving, setSaving] = useState(false);
  const active = captadores.filter((c) => c.is_active);

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setFocus,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      reset(EMPTY);
      setAdded(0);
    }, 250);
  };

  const save = (another: boolean) =>
    handleSubmit(async (data) => {
      setSaving(true);
      try {
        const lead = await captacaoService.createLead({
          fullName: data.fullName,
          phone: data.phone || undefined,
          email: data.email || undefined,
          companyName: data.companyName || undefined,
          jobTitle: data.jobTitle || undefined,
          niche: data.niche || undefined,
          address: data.address || undefined,
          mapsUrl: data.mapsUrl || undefined,
          instagram: data.instagram || undefined,
          website: data.website || undefined,
          leadContext: data.leadContext || undefined,
          captadorId: data.captadorId || undefined,
        });
        qc.invalidateQueries({ queryKey: ['captacao'] });
        qc.invalidateQueries({ queryKey: ['contacts'] });
        const captador = active.find((c) => c.id === data.captadorId);
        toast.success(captador ? `${lead.full_name} entregue para ${captador.full_name}` : `${lead.full_name} entrou na fila`);
        if (another) {
          // Mantém nicho e captador: a próxima linha da lista costuma ser do mesmo tipo
          const { niche, captadorId } = getValues();
          reset({ ...EMPTY, niche, captadorId });
          setAdded((n) => n + 1);
          setTimeout(() => setFocus('fullName'), 0);
        } else {
          handleClose();
        }
      } catch (err) {
        const res = (err as { response?: { data?: { code?: string; existing?: string } } }).response?.data;
        if (res?.code === 'duplicate_lead') {
          toast.error(`Já existe um lead com esse telefone ou e-mail${res.existing ? `: ${res.existing}` : ''}`);
        } else {
          toast.error('Não foi possível salvar o lead');
        }
      } finally {
        setSaving(false);
      }
    })();

  return (
    <Modal open={open} onClose={handleClose} className="max-w-xl" title="Adicionar lead" description="Cadastre um lead à mão — ele entra na fila de distribuição ou vai direto para um captador.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
        className="space-y-4"
      >
        <Input {...register('fullName')} id="lead-name" label="Nome *" placeholder="Maria Souza" autoFocus error={errors.fullName?.message} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input {...register('phone')} id="lead-phone" label="Telefone / WhatsApp" placeholder="(16) 99999-0000" inputMode="tel" />
          <Input {...register('email')} id="lead-email" type="email" label="E-mail" placeholder="maria@empresa.com" error={errors.email?.message} />
          <Input {...register('companyName')} id="lead-company" label="Empresa" placeholder="Padaria Pão Bom" />
          <Input {...register('jobTitle')} id="lead-job" label="Cargo" placeholder="Sócia" />
          <div>
            <Input {...register('niche')} id="lead-niche" label="Nicho" placeholder="Ex.: Odontologia" list="lead-niche-options" />
            <datalist id="lead-niche-options">
              {niches.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <Input {...register('instagram')} id="lead-instagram" label="Instagram" placeholder="@padariapaobom" />
          <Input {...register('website')} id="lead-website" label="Site" placeholder="Deixe vazio se não tiver site" />
          <div className="sm:col-span-2">
            <Input {...register('address')} id="lead-address" label="Endereço" placeholder="Rua das Flores, 120 - Centro, Ribeirão Preto - SP" />
          </div>
          <div className="sm:col-span-2">
            <Input {...register('mapsUrl')} id="lead-maps" label="Link do Google (Maps)" placeholder="https://maps.google.com/..." />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor="lead-context" className="text-xs font-medium text-text-secondary">
              Contexto da empresa
            </label>
            <textarea
              {...register('leadContext')}
              id="lead-context"
              rows={3}
              maxLength={5000}
              placeholder="O que a empresa faz, porte, dores, quem decide… Ajuda o captador a saber com quem está falando."
              className="input-base min-h-[72px] resize-y py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="lead-captador" className="text-xs font-medium text-text-secondary">
              Entregar para
            </label>
            <select id="lead-captador" {...register('captadorId')} className="input-base">
              <option value="">Deixar na fila</option>
              {active.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {added > 0 && (
            <span className="mr-auto flex items-center gap-1 text-xs text-accent-green">
              <Check size={13} />
              {added} adicionado{added !== 1 ? 's' : ''}
            </span>
          )}
          <Button type="button" variant="ghost" onClick={handleClose}>
            {added > 0 ? 'Fechar' : 'Cancelar'}
          </Button>
          <Button type="button" variant="secondary" disabled={saving} onClick={() => save(true)}>
            Salvar e adicionar outro
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar lead'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
