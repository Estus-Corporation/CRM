import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { capitalizeName, cn, JOB_TITLE_OPTIONS, lowerEmail, withPhoneMask, withTransform } from '@/lib/utils';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  AtSign,
  Briefcase,
  Building2,
  Check,
  FileText,
  Globe,
  Mail,
  Map,
  MapPin,
  Pencil,
  Phone,
  Send,
  Tag,
  User,
  UserPlus,
  X,
  type LucideIcon,
} from 'lucide-react';
import { captacaoService, type ManagerLead } from '@/services/captacao.service';
import { contactsService } from '@/services/contacts.service';
import { useCaptadores } from '@/hooks/useCaptacao';
import { useContactNiches } from '@/hooks/useContacts';
import { Modal } from '@/components/ui/Modal';
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
 * `self`: o próprio captador cadastrando — o lead vai pros leads dele (sem "Entregar para").
 * `editing`: admin editando um lead existente (mesmo formulário, sem "Entregar para" e sem "adicionar outro").
 */
export function AddLeadModal({
  open,
  onClose,
  self = false,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  self?: boolean;
  editing?: ManagerLead;
}) {
  const qc = useQueryClient();
  // Lista de captadores e nichos são rotas de admin/gerente: o captador não consulta
  const { data: captadores = [] } = useCaptadores({ enabled: !self });
  const { data: niches = [] } = useContactNiches({ enabled: !self });
  const [added, setAdded] = useState(0);
  const [saving, setSaving] = useState(false);
  const active = captadores.filter((c) => c.is_active);

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setFocus,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  // Cargo: lista pronta; "Outro" (ou um cargo que não está na lista) vira campo livre
  const [customJob, setCustomJob] = useState(false);
  const jobTitle = watch('jobTitle');

  // Editar: ao abrir, o formulário vem preenchido com os dados atuais do lead
  useEffect(() => {
    if (!open) return;
    if (!editing) {
      setCustomJob(false);
      return;
    }
    setCustomJob(!!editing.job_title && !JOB_TITLE_OPTIONS.includes(editing.job_title));
    reset({
      ...EMPTY,
      fullName: editing.full_name,
      phone: editing.phone ?? '',
      email: editing.email ?? '',
      companyName: editing.company_name ?? '',
      jobTitle: editing.job_title ?? '',
      niche: editing.niche ?? '',
      address: editing.address ?? '',
      mapsUrl: editing.maps_url ?? '',
      instagram: editing.instagram ?? '',
      website: editing.website ?? '',
      leadContext: editing.lead_context ?? '',
    });
  }, [open, editing, reset]);

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      reset(EMPTY);
      setAdded(0);
      setCustomJob(false);
    }, 250);
  };

  const save = (another: boolean) =>
    handleSubmit(async (data) => {
      setSaving(true);
      try {
        if (editing) {
          // Campo vazio = apagar o valor (o backend grava null)
          await contactsService.update(editing.id, {
            fullName: data.fullName,
            phone: data.phone,
            email: data.email,
            companyName: data.companyName,
            jobTitle: data.jobTitle,
            niche: data.niche,
            address: data.address,
            mapsUrl: data.mapsUrl,
            instagram: data.instagram,
            website: data.website,
            leadContext: data.leadContext,
          });
          qc.invalidateQueries({ queryKey: ['captacao'] });
          qc.invalidateQueries({ queryKey: ['contacts'] });
          toast.success('Lead atualizado');
          handleClose();
          return;
        }
        const fields = {
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
        };
        const lead = self
          ? await captacaoService.createMyLead(fields)
          : await captacaoService.createLead({ ...fields, captadorId: data.captadorId || undefined });
        qc.invalidateQueries({ queryKey: ['captacao'] });
        if (!self) qc.invalidateQueries({ queryKey: ['contacts'] });
        const captador = active.find((c) => c.id === data.captadorId);
        toast.success(
          self
            ? `${lead.full_name} entrou nos seus leads`
            : captador
              ? `${lead.full_name} entregue para ${captador.full_name}`
              : `${lead.full_name} entrou na fila`,
        );
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
          // O captador não vê os contatos do workspace: sem o nome do lead que já existe
          toast.error(`Já existe um lead com esse telefone ou e-mail${res.existing && !self ? `: ${res.existing}` : ''}`);
        } else {
          toast.error('Não foi possível salvar o lead');
        }
      } finally {
        setSaving(false);
      }
    })();

  return (
    <Modal open={open} onClose={handleClose} className="max-w-2xl overflow-hidden p-0" title={editing ? 'Editar lead' : 'Adicionar lead'} hideHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
        className="flex max-h-[min(88vh,820px)] flex-col"
      >
        {/* Cabeçalho: ícone no quadrado verde (mesmo dos KPIs) + título e descrição */}
        <div className="flex items-start gap-4 border-b border-fg/[0.06] px-6 pb-5 pt-6">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[13px] border border-accent-green/20 bg-gradient-to-br from-accent-green/[0.22] to-accent-green/[0.06] text-accent-green shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            {editing ? <Pencil size={19} strokeWidth={1.9} /> : <UserPlus size={20} strokeWidth={1.9} />}
          </span>
          <div className="min-w-0 pr-8">
            <p className="text-[18px] font-semibold tracking-[-0.01em] text-text-primary">{editing ? 'Editar lead' : 'Adicionar lead'}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
              {editing
                ? 'Corrija ou complete os dados — vale para todos que veem este lead.'
                : self
                ? 'Cadastre um lead que você encontrou — ele entra direto nos seus leads de hoje.'
                : 'Cadastre um lead à mão — ele entra na fila de distribuição ou vai direto para um captador.'}
            </p>
          </div>
        </div>

        {/* Corpo com rolagem própria: cabeçalho e rodapé ficam sempre visíveis */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <Section icon={User} title="Contato">
            <Field icon={User} id="lead-name" label="Nome" required error={errors.fullName?.message} className="sm:col-span-2">
              <input {...withTransform(register('fullName'), capitalizeName)} id="lead-name" placeholder="Maria Souza" autoFocus className={fieldClass(!!errors.fullName)} />
            </Field>
            <Field icon={Phone} id="lead-phone" label="Telefone / WhatsApp">
              <input {...withPhoneMask(register('phone'))} id="lead-phone" placeholder="(16) 99999-0000" inputMode="tel" className={fieldClass()} />
            </Field>
            <Field icon={Mail} id="lead-email" label="E-mail" error={errors.email?.message}>
              <input {...withTransform(register('email'), lowerEmail)} id="lead-email" type="email" inputMode="email" autoCapitalize="none" placeholder="maria@empresa.com" className={fieldClass(!!errors.email)} />
            </Field>
          </Section>

          <Section icon={Building2} title="Empresa">
            <Field icon={Building2} id="lead-company" label="Empresa">
              <input {...register('companyName')} id="lead-company" placeholder="Padaria Pão Bom" className={fieldClass()} />
            </Field>
            <Field icon={Briefcase} id="lead-job" label="Cargo">
              {customJob ? (
                <>
                  <input {...register('jobTitle')} id="lead-job" placeholder="Qual cargo?" autoFocus className={cn(fieldClass(), 'pr-9')} />
                  <button
                    type="button"
                    title="Voltar pras opções"
                    onClick={() => {
                      setCustomJob(false);
                      setValue('jobTitle', '');
                    }}
                    className="absolute right-2 top-1/2 z-[1] -translate-y-1/2 rounded-md p-1 text-text-muted hover:text-text-primary"
                  >
                    <X size={13} />
                  </button>
                </>
              ) : (
                <select
                  id="lead-job"
                  value={jobTitle}
                  onChange={(e) => {
                    if (e.target.value === '__other') {
                      setCustomJob(true);
                      setValue('jobTitle', '');
                    } else setValue('jobTitle', e.target.value);
                  }}
                  className={cn(fieldClass(), !jobTitle && 'text-text-muted')}
                >
                  <option value="">Selecione o cargo</option>
                  {JOB_TITLE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                  <option value="__other">Outro…</option>
                </select>
              )}
            </Field>
            <Field icon={Tag} id="lead-niche" label="Nicho">
              <input {...register('niche')} id="lead-niche" placeholder="Ex.: Odontologia" list="lead-niche-options" className={fieldClass()} />
              <datalist id="lead-niche-options">
                {niches.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </Field>
            <Field icon={AtSign} id="lead-instagram" label="Instagram">
              <input {...register('instagram')} id="lead-instagram" placeholder="@padariapaobom" className={fieldClass()} />
            </Field>
            <Field icon={Globe} id="lead-website" label="Site" hint="Deixe vazio se não tiver" className="sm:col-span-2">
              <input {...register('website')} id="lead-website" placeholder="padariapaobom.com.br" className={fieldClass()} />
            </Field>
          </Section>

          <Section icon={MapPin} title="Localização">
            <Field icon={MapPin} id="lead-address" label="Endereço" className="sm:col-span-2">
              <input {...register('address')} id="lead-address" placeholder="Rua das Flores, 120 - Centro, Ribeirão Preto - SP" className={fieldClass()} />
            </Field>
            <Field icon={Map} id="lead-maps" label="Link do Google Maps" className="sm:col-span-2">
              <input {...register('mapsUrl')} id="lead-maps" placeholder="https://maps.google.com/..." className={fieldClass()} />
            </Field>
          </Section>

          <Section icon={FileText} title="Contexto">
            <div className="sm:col-span-2">
              <textarea
                {...register('leadContext')}
                id="lead-context"
                aria-label="Contexto da empresa"
                rows={3}
                maxLength={5000}
                placeholder="O que a empresa faz, porte, dores, quem decide… Ajuda a saber com quem está falando."
                className="input-base min-h-[88px] w-full resize-y py-2.5 text-sm leading-relaxed"
              />
            </div>
            {!self && !editing && (
              <Field icon={Send} id="lead-captador" label="Entregar para" className="sm:col-span-2">
                <select id="lead-captador" {...register('captadorId')} className={fieldClass()}>
                  <option value="">Deixar na fila</option>
                  {active.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </Section>
        </div>

        {/* Rodapé fixo */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-fg/[0.06] bg-fg/[0.02] px-6 py-4">
          {added > 0 && (
            <span className="mr-auto flex items-center gap-1.5 rounded-full bg-accent-green/10 px-2.5 py-1 text-xs font-medium text-accent-green">
              <Check size={13} />
              {added} adicionado{added !== 1 ? 's' : ''}
            </span>
          )}
          <Button type="button" variant="ghost" onClick={handleClose}>
            {added > 0 ? 'Fechar' : 'Cancelar'}
          </Button>
          {!editing && (
            <Button type="button" variant="secondary" disabled={saving} onClick={() => save(true)}>
              Salvar e adicionar outro
            </Button>
          )}
          <Button type="submit" disabled={saving} className="px-5">
            {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Salvar lead'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Campo com ícone à esquerda (pl-10 abre espaço pra ele) */
function fieldClass(error = false) {
  return cn('input-base w-full pl-10', error && 'border-status-lost focus:border-status-lost focus:ring-status-lost');
}

/** Grupo de campos com título pequeno e ícone; os campos ficam em 2 colunas */
function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-3 flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        <Icon size={13} strokeWidth={2.2} className="text-accent-green" />
        {title}
        <span className="h-px flex-1 bg-fg/[0.06]" />
      </p>
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  icon: Icon,
  id,
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  icon: LucideIcon;
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="flex items-baseline gap-1.5 text-xs font-medium text-text-secondary">
        {label}
        {required && <span className="text-accent-green">*</span>}
        {hint && <span className="font-normal text-text-muted">· {hint}</span>}
      </label>
      <div className="relative">
        <Icon size={15} strokeWidth={1.9} className="pointer-events-none absolute left-3.5 top-1/2 z-[1] -translate-y-1/2 text-text-muted" />
        {children}
      </div>
      {error && <p className="text-xs text-status-lost">{error}</p>}
    </div>
  );
}
