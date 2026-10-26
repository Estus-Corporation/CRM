import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn, formatPhone, withPhoneMask } from '@/lib/utils';
import { toast } from 'sonner';
import { ImagePlus, Pencil, Trash2 } from 'lucide-react';
import { useUpdateTenant, type Tenant } from '@/hooks/useTenant';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CompanyLogo } from './CompanyLogo';
import { ImageCropModal } from '@/components/ui/ImageCropModal';
import { OfferFileField } from './OfferFile';

const SERVICE_SUGGESTIONS = [
  'Agência de marketing',
  'Consultoria',
  'Software / SaaS',
  'Clínica / Saúde',
  'Odontologia',
  'Estética',
  'Imobiliária',
  'Educação / Cursos',
  'Serviços financeiros',
  'Seguros',
  'Energia solar',
  'Advocacia',
  'Contabilidade',
];

const schema = z.object({
  name: z.string().trim().min(2, 'Nome é obrigatório').max(255),
  email: z.string().trim().email('E-mail inválido').max(255).or(z.literal('')),
  serviceType: z.string().trim().min(2, 'Diga que tipo de serviço a empresa presta').max(120),
  about: z.string().trim().min(20, 'Escreva pelo menos algumas linhas sobre a empresa').max(20000),
  pitch: z.string().max(20000),
  phone: z.string().trim().max(40),
  instagram: z.string().trim().max(255),
  website: z.string().trim().max(255),
  address: z.string().trim().max(500),
});

type FormData = z.infer<typeof schema>;

interface Props {
  tenant?: Tenant;
  submitLabel?: string;
  /** Botões extras ao lado do salvar (ex.: "Pular" no onboarding) */
  secondaryAction?: ReactNode;
  onSaved?: () => void;
  /** Ex.: "mobile-split" — cada grupo (identidade/contatos, textos) vira um bloco no celular */
  className?: string;
}

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string };

// forwardRef: o register do react-hook-form lê o valor pelo ref — sem ele o campo ficava "vazio"
const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({ id, label, hint, error, rows, ...props }, ref) => (
  <div className="flex flex-col gap-1">
    <label htmlFor={id} className="text-xs font-medium text-text-secondary">
      {label}
    </label>
    <textarea
      ref={ref}
      id={id}
      rows={rows ?? 4}
      className="input-base min-h-[96px] resize-y py-2.5 text-sm leading-relaxed"
      {...props}
    />
    {error ? <p className="text-xs text-status-lost">{error}</p> : hint && <p className="text-xs text-text-muted">{hint}</p>}
  </div>
));
TextArea.displayName = 'TextArea';

/**
 * Perfil da empresa: o que a equipe (principalmente os captadores) precisa saber pra vender.
 * Usado no onboarding (logo após criar o workspace) e em Configurações.
 */
export function CompanyProfileForm({ tenant, submitLabel = 'Salvar', secondaryAction, onSaved, className }: Props) {
  const update = useUpdateTenant();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState<string | null>(tenant?.logo_url ?? null);
  const [logoDirty, setLogoDirty] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [logoMenu, setLogoMenu] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', serviceType: '', about: '', pitch: '', phone: '', instagram: '', website: '', address: '' },
  });

  // Preenche quando o workspace carrega (e depois de salvar)
  useEffect(() => {
    if (!tenant) return;
    reset({
      name: tenant.name ?? '',
      email: tenant.email ?? '',
      serviceType: tenant.service_type ?? '',
      about: tenant.about ?? '',
      pitch: tenant.pitch ?? '',
      phone: formatPhone(tenant.phone ?? ''),
      instagram: tenant.instagram ?? '',
      website: tenant.website ?? '',
      address: tenant.address ?? '',
    });
    setLogo(tenant.logo_url ?? null);
    setLogoDirty(false);
  }, [tenant, reset]);

  const pickLogo = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Escolha uma imagem (PNG, JPG ou WebP)');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Imagem maior que 8 MB');
      return;
    }
    // Abre o editor (zoom + enquadrar); o logo só muda ao confirmar
    setCropFile(file);
  };

  const onSubmit = (data: FormData) => {
    update.mutate(
      {
        ...data,
        email: data.email || null,
        pitch: data.pitch || null,
        phone: data.phone || null,
        instagram: data.instagram || null,
        website: data.website || null,
        address: data.address || null,
        ...(logoDirty ? { logo } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Perfil da empresa salvo');
          onSaved?.();
        },
      },
    );
  };

  const name = watch('name');
  const dirty = isDirty || logoDirty;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={cn('space-y-5', className)}>
      {/* Grupo 1: identidade, serviço e contatos */}
      <div className="space-y-5">
      <div className="flex items-center gap-4">
        {/* Logo: lápis no hover; com logo, o lápis abre Trocar/Remover; sem logo, já escolhe o arquivo */}
        <div className="relative flex-shrink-0" onMouseLeave={() => setLogoMenu(false)}>
          <button
            type="button"
            onClick={() => (logo ? setLogoMenu((v) => !v) : fileRef.current?.click())}
            aria-label={logo ? 'Editar logo' : 'Enviar logo'}
            className="group relative block rounded-2xl"
          >
            <CompanyLogo name={name} logoUrl={logo} className="h-16 w-16 text-2xl" />
            <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {logo ? <Pencil size={18} /> : <ImagePlus size={18} />}
            </span>
          </button>
          {logoMenu && (
            <div className="glass-panel absolute left-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl p-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setLogoMenu(false);
                  fileRef.current?.click();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-text-primary hover:bg-fg/[0.06]"
              >
                <ImagePlus size={14} />
                Trocar logo
              </button>
              <button
                type="button"
                onClick={() => {
                  setLogoMenu(false);
                  setLogo(null);
                  setLogoDirty(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-status-lost hover:bg-status-lost/10"
              >
                <Trash2 size={14} />
                Remover logo
              </button>
            </div>
          )}
        </div>
        {/* Nome e e-mail editáveis aqui mesmo — sem repetir em campos abaixo */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <input
            {...register('name')}
            aria-label="Nome da empresa"
            placeholder="Nome da empresa *"
            maxLength={255}
            className="-mx-2 h-9 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-base font-semibold text-text-primary outline-none transition-colors placeholder:text-text-muted hover:border-fg/[0.1] focus:border-accent-green/50 focus:bg-field"
          />
          <input
            {...register('email')}
            type="email"
            aria-label="E-mail da empresa"
            placeholder="E-mail da empresa"
            maxLength={255}
            className="-mx-2 h-8 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-sm text-text-secondary outline-none transition-colors placeholder:text-text-muted hover:border-fg/[0.1] focus:border-accent-green/50 focus:bg-field"
          />
          {(errors.name || errors.email) && (
            <p className="text-xs text-status-lost">{errors.name?.message ?? errors.email?.message}</p>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) pickLogo(file);
          }}
        />
      </div>

      <div>
          <Input
            {...register('serviceType')}
            id="company-service"
            label="Que tipo de serviço presta? *"
            placeholder="Ex.: Agência de marketing"
            list="company-service-suggestions"
            error={errors.serviceType?.message}
          />
          <datalist id="company-service-suggestions">
            {SERVICE_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
      </div>

      {/* Contatos e redes: viram atalhos (ícones) na página "Sobre a empresa" */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input {...withPhoneMask(register('phone'))} id="company-phone" label="WhatsApp / telefone" placeholder="(11) 99999-9999" inputMode="tel" />
        <Input {...register('instagram')} id="company-instagram" label="Instagram" placeholder="@suaempresa" />
        <Input {...register('website')} id="company-website" label="Site" placeholder="suaempresa.com.br" />
        <Input {...register('address')} id="company-address" label="Endereço" placeholder="Rua, número, cidade" />
      </div>

      </div>

      {/* Grupo 2: o que a equipe lê (sobre, preços, abordagem) + salvar */}
      <div className="space-y-5">
      <TextArea
        {...register('about')}
        id="company-about"
        label="Sobre a empresa *"
        rows={5}
        placeholder="O que a empresa faz, há quanto tempo, para quem, o que a diferencia da concorrência…"
        hint="É a primeira coisa que a equipe lê para entender o negócio."
        error={errors.about?.message}
      />
      <OfferFileField tenant={tenant} />
      <TextArea
        {...register('pitch')}
        id="company-pitch"
        label="Estratégia de abordagem"
        rows={5}
        placeholder={'Ex.:\n• Como começar a ligação\n• Perguntas para qualificar o lead\n• Respostas para objeções ("tá caro", "já tenho fornecedor")\n• Objetivo da ligação: marcar a reunião'}
        hint="O roteiro que você quer que o captador siga."
        error={errors.pitch?.message}
      />

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        {secondaryAction}
        <Button type="submit" disabled={update.isPending || (!!tenant && !dirty && !!tenant.about)}>
          {update.isPending ? 'Salvando…' : submitLabel}
        </Button>
      </div>

      <ImageCropModal
        title="Ajustar logo"
        file={cropFile}
        onClose={() => setCropFile(null)}
        onConfirm={(dataUrl) => {
          setLogo(dataUrl);
          setLogoDirty(true);
          setCropFile(null);
        }}
      />
      </div>
    </form>
  );
}
