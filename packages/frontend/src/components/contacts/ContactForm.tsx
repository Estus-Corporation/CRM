import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatPhone } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { useUsers } from '@/hooks/useUsers';
import { useContactNiches } from '@/hooks/useContacts';
import type { Contact } from '@/services/contacts.service';

const phoneRegex = /^\(\d{2}\) \d{4,5}-\d{4}$/;

const schema = z.object({
  type: z.enum(['lead', 'contact', 'client']).default('lead'),
  fullName: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional().refine(
    (val) => !val || phoneRegex.test(val),
    { message: 'Telefone inválido. Use (XX) XXXXX-XXXX' }
  ),
  companyName: z.string().optional(),
  jobTitle: z.string().optional(),
  source: z.string().optional(),
  niche: z.string().max(100).optional(),
  customSource: z.string().optional(),
  ownerId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ContactFormProps {
  defaultValues?: Partial<Contact>;
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const typeOptions = [
  { value: 'lead', label: 'Lead' },
  { value: 'contact', label: 'Contato' },
  { value: 'client', label: 'Cliente' },
];

const jobTitleOptions = [
  { value: 'CEO', label: 'CEO' },
  { value: 'CFO', label: 'CFO' },
  { value: 'CTO', label: 'CTO' },
  { value: 'COO', label: 'COO' },
  { value: 'Diretor', label: 'Diretor' },
  { value: 'Gerente', label: 'Gerente' },
  { value: 'Coordenador', label: 'Coordenador' },
  { value: 'Supervisor', label: 'Supervisor' },
  { value: 'Analista', label: 'Analista' },
  { value: 'Consultor', label: 'Consultor' },
  { value: 'Vendedor', label: 'Vendedor' },
  { value: 'Assistente', label: 'Assistente' },
  { value: 'Estagiário', label: 'Estagiário' },
  { value: 'Autônomo', label: 'Autônomo' },
  { value: 'Empresário', label: 'Empresário' },
  { value: 'Outro', label: 'Outro' },
];

const sourceOptions = [
  { value: '', label: 'Nenhuma' },
  { value: 'paid_traffic', label: 'Tráfego pago' },
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'custom', label: 'Personalizado' },
];

// Predefined source values — any other value stored is treated as custom
const PREDEFINED_SOURCES = ['', 'paid_traffic', 'landing_page', 'ecommerce'];

export function ContactForm({ defaultValues, onSubmit, onCancel, isSubmitting }: ContactFormProps) {
  const { data: usersData } = useUsers();
  const activeUsers = usersData?.data.filter((u) => u.is_active) ?? [];

  const existingSource = defaultValues?.source ?? '';
  const isExistingCustom = !!existingSource && !PREDEFINED_SOURCES.includes(existingSource);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: (defaultValues?.type as FormData['type']) ?? 'lead',
      fullName: defaultValues?.full_name ?? '',
      email: defaultValues?.email ?? '',
      phone: defaultValues?.phone ?? '',
      companyName: defaultValues?.company_name ?? '',
      jobTitle: defaultValues?.job_title ?? '',
      niche: defaultValues?.niche ?? '',
      source: isExistingCustom ? 'custom' : existingSource,
      customSource: isExistingCustom ? existingSource : '',
      ownerId: defaultValues?.owner_id ?? '',
    },
  });

  const { data: niches = [] } = useContactNiches();
  const typeValue = useWatch({ control, name: 'type' });
  const isClient = typeValue === 'client';

  const handleFormSubmit = handleSubmit((data) => {
    const resolvedSource = data.source === 'custom' ? (data.customSource || '') : data.source;
    return onSubmit({ ...data, source: resolvedSource, ownerId: data.ownerId || undefined });
  });

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <CustomSelect
            label="Tipo"
            options={typeOptions}
            value={field.value ?? ''}
            onChange={(val) => {
              field.onChange(val);
              if (val === 'client') setValue('ownerId', '');
            }}
          />
        )}
      />

      <Input
        {...register('fullName')}
        id="fullName"
        label="Nome completo *"
        placeholder="João Silva"
        error={errors.fullName?.message}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          {...register('email')}
          id="email"
          type="email"
          label="E-mail"
          placeholder="joao@empresa.com"
          error={errors.email?.message}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <Input
              id="phone"
              label="Telefone"
              placeholder="(11) 99999-9999"
              error={errors.phone?.message}
              value={field.value ?? ''}
              onChange={(e) => field.onChange(formatPhone(e.target.value))}
            />
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          {...register('companyName')}
          id="companyName"
          label="Empresa"
          placeholder="Acme Corp"
        />
        <Controller
          control={control}
          name="jobTitle"
          render={({ field }) => (
            <CustomSelect
              label="Cargo"
              placeholder="Selecione um cargo"
              options={jobTitleOptions}
              value={field.value ?? ''}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      {/* Nicho: texto livre com sugestões dos nichos já usados no workspace */}
      <Input
        {...register('niche')}
        id="niche"
        label="Nicho"
        placeholder="Ex.: Saúde, Tecnologia, Varejo"
        list="contact-niche-options"
        autoComplete="off"
      />
      <datalist id="contact-niche-options">
        {niches.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <Controller
        control={control}
        name="source"
        render={({ field }) => (
          <div className="flex flex-col gap-2">
            <CustomSelect
              label="Origem"
              placeholder="Nenhuma"
              options={sourceOptions.filter((o) => o.value !== '')}
              value={field.value ?? ''}
              onChange={field.onChange}
            />
            {field.value === 'custom' && (
              <input
                {...register('customSource')}
                className="input-base mt-1"
                placeholder="Digite a origem personalizada"
              />
            )}
          </div>
        )}
      />

      {!isClient && (
        <Controller
          control={control}
          name="ownerId"
          render={({ field }) => (
            <CustomSelect
              label="Responsável"
              placeholder="Sem responsável"
              options={activeUsers.map((u) => ({ value: u.id, label: u.full_name }))}
              value={field.value ?? ''}
              onChange={field.onChange}
            />
          )}
        />
      )}

      <div className="flex gap-2 pt-2 justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
