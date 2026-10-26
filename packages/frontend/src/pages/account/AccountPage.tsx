import { forwardRef, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Camera, KeyRound, LogIn, LogOut, Plus, Trash2, UserRound } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/authStore';
import { useEnterWorkspace, useLeaveWorkspace, useWorkspaces } from '@/hooks/useWorkspaces';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { ImageCropModal } from '@/components/ui/ImageCropModal';
import { CompanyLogo } from '@/components/company/CompanyLogo';
import { CreateWorkspaceModal } from '@/components/layout/CreateWorkspaceModal';
import { cn, withPhoneMask } from '@/lib/utils';

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', manager: 'Gerente', seller: 'Vendedor', captador: 'Captador' };

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-bg-border px-5 py-4">
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <p className="mt-0.5 text-xs text-text-muted">{description}</p>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }>(
  ({ id, label, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-text-secondary">
        {label}
      </label>
      <textarea ref={ref} id={id} rows={4} className="input-base min-h-[96px] resize-y py-2.5 text-sm leading-relaxed" {...props} />
    </div>
  ),
);
TextArea.displayName = 'TextArea';

// ── Perfil ──────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Nome é obrigatório').max(255),
  jobTitle: z.string().max(120),
  phone: z.string().max(30),
  bio: z.string().max(2000),
});
type ProfileForm = z.infer<typeof profileSchema>;

function ProfileSection() {
  const user = useAuthStore((s) => s.user);
  const patchUser = useAuthStore((s) => s.patchUser);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [avatar, setAvatar] = useState<string | null>(user?.avatar_url ?? null);
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: '', jobTitle: '', phone: '', bio: '' },
  });

  // Dados frescos do servidor (o store pode ser de antes destes campos existirem)
  useEffect(() => {
    authService
      .getMe()
      .then((me) => {
        patchUser({ full_name: me.full_name, avatar_url: me.avatar_url, job_title: me.job_title, phone: me.phone, bio: me.bio });
        reset({ fullName: me.full_name, jobTitle: me.job_title ?? '', phone: me.phone ?? '', bio: me.bio ?? '' });
        setAvatar(me.avatar_url ?? null);
      })
      .catch(() => {});
  }, [patchUser, reset]);

  const onSubmit = async (data: ProfileForm) => {
    setSaving(true);
    try {
      const me = await authService.updateMe({
        fullName: data.fullName,
        jobTitle: data.jobTitle || null,
        phone: data.phone || null,
        bio: data.bio || null,
        ...(avatarDirty ? { avatar } : {}),
      });
      patchUser({ full_name: me.full_name, avatar_url: me.avatar_url, job_title: me.job_title, phone: me.phone, bio: me.bio });
      reset({ fullName: me.full_name, jobTitle: me.job_title ?? '', phone: me.phone ?? '', bio: me.bio ?? '' });
      setAvatarDirty(false);
      toast.success('Perfil atualizado');
    } catch {
      toast.error('Não foi possível salvar o perfil');
    } finally {
      setSaving(false);
    }
  };

  const name = watch('fullName') || user?.full_name || '';

  return (
    <Section title="Perfil" description="Como você aparece para as equipes dos workspaces em que participa.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative flex-shrink-0 rounded-full"
            title="Trocar foto"
          >
            <Avatar name={name || '?'} src={avatar} className="h-20 w-20 text-2xl" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Camera size={20} />
            </span>
          </button>
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                <Camera size={14} />
                {avatar ? 'Trocar foto' : 'Enviar foto'}
              </Button>
              {avatar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAvatar(null);
                    setAvatarDirty(true);
                  }}
                >
                  <Trash2 size={14} />
                  Remover
                </Button>
              )}
            </div>
            <p className="text-xs text-text-muted">{user?.email}</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              if (file.size > 8 * 1024 * 1024) return void toast.error('Imagem maior que 8 MB');
              setCropFile(file);
            }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input {...register('fullName')} id="me-name" label="Nome *" error={errors.fullName?.message} />
          <Input {...register('jobTitle')} id="me-job" label="Cargo" placeholder="Ex.: SDR, Consultor comercial" />
          <Input {...withPhoneMask(register('phone'))} id="me-phone" label="Telefone / WhatsApp" placeholder="(16) 99999-0000" />
        </div>
        <TextArea
          {...register('bio')}
          id="me-bio"
          label="Sobre você"
          placeholder="Sua experiência, o que você faz, como prefere trabalhar…"
          maxLength={2000}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={saving || (!isDirty && !avatarDirty)}>
            {saving ? 'Salvando…' : 'Salvar perfil'}
          </Button>
        </div>
      </form>

      <ImageCropModal
        file={cropFile}
        title="Ajustar foto"
        round
        onClose={() => setCropFile(null)}
        onConfirm={(dataUrl) => {
          setAvatar(dataUrl);
          setAvatarDirty(true);
          setCropFile(null);
        }}
      />
    </Section>
  );
}

// ── Senha ───────────────────────────────────────────────────────────────────

const passwordSchema = z
  .object({
    currentPassword: z.string(),
    password: z.string().min(8, 'Mínimo de 8 caracteres'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: 'As senhas não são iguais', path: ['confirm'] });
type PasswordForm = z.infer<typeof passwordSchema>;

function PasswordSection() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: '', password: '', confirm: '' } });

  const onSubmit = async (data: PasswordForm) => {
    try {
      await authService.updateMe({ password: data.password, currentPassword: data.currentPassword });
      reset();
      toast.success('Senha alterada');
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string } } }).response?.data?.code;
      if (code === 'wrong_password') setError('currentPassword', { message: 'Senha atual incorreta' });
      else toast.error('Não foi possível alterar a senha');
    }
  };

  return (
    <Section title="Senha" description="Use pelo menos 8 caracteres.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            {...register('currentPassword')}
            id="pw-current"
            type="password"
            label="Senha atual"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
          />
          <Input {...register('password')} id="pw-new" type="password" label="Nova senha" autoComplete="new-password" error={errors.password?.message} />
          <Input {...register('confirm')} id="pw-confirm" type="password" label="Confirmar" autoComplete="new-password" error={errors.confirm?.message} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" disabled={isSubmitting}>
            <KeyRound size={14} />
            {isSubmitting ? 'Alterando…' : 'Alterar senha'}
          </Button>
        </div>
      </form>
    </Section>
  );
}

// ── Workspaces ──────────────────────────────────────────────────────────────

function WorkspacesSection() {
  const user = useAuthStore((s) => s.user);
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const enter = useEnterWorkspace();
  const leave = useLeaveWorkspace();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <Section title="Meus workspaces" description="O seu e os que te convidaram. Troque também pelo seletor no rodapé do menu.">
      <ul className="divide-y divide-bg-border">
        {isLoading && <li className="py-3 text-sm text-text-muted">Carregando…</li>}
        {workspaces.map((ws) => {
          const current = ws.id === user?.tenant_id;
          const fallback = workspaces.find((w) => w.id !== ws.id);
          return (
            <li key={ws.id} className="flex flex-wrap items-center gap-3 py-3">
              <CompanyLogo name={ws.name} logoUrl={ws.logo_url} className="h-10 w-10 flex-shrink-0 text-sm" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-text-primary">
                  {ws.name}
                  {current && (
                    <span className="rounded bg-accent-green/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent-green">ATUAL</span>
                  )}
                </p>
                <p className="text-xs text-text-muted">{ROLE_LABEL[ws.role] ?? ws.role}</p>
              </div>
              <div className="flex gap-1.5">
                {!current && (
                  <Button size="sm" variant="secondary" onClick={() => enter.mutate(ws)} disabled={enter.isPending}>
                    <LogIn size={13} />
                    Entrar
                  </Button>
                )}
                {/* Sair do único workspace deixaria a conta sem lugar nenhum */}
                {workspaces.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className={cn('text-text-muted hover:text-status-lost')}
                    disabled={leave.isPending}
                    onClick={() => {
                      if (confirm(`Sair de "${ws.name}"? Você perde o acesso até ser adicionado de novo.`)) {
                        leave.mutate({ workspace: ws, fallback });
                      }
                    }}
                  >
                    <LogOut size={13} />
                    Sair
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <Button variant="secondary" size="sm" className="mt-3" onClick={() => setCreateOpen(true)}>
        <Plus size={14} />
        Criar novo workspace
      </Button>
      <CreateWorkspaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </Section>
  );
}

/** Minha conta: perfil pessoal, senha e workspaces — existe pra qualquer papel, inclusive captador */
export function AccountPage() {
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Minha conta" subtitle="Sua conta é sua: vale em todos os workspaces em que você participa" />
      <ProfileSection />
      <PasswordSection />
      <WorkspacesSection />
      <p className="flex items-center gap-1.5 text-xs text-text-muted">
        <UserRound size={13} />
        Para alguém te adicionar a um workspace, basta passar o e-mail desta conta para o admin dele.
      </p>
    </div>
  );
}
