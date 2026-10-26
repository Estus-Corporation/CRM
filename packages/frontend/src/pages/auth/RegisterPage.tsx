import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { useState } from 'react';

const schema = z.object({
  workspaceName: z.string().min(2, 'Nome da empresa é obrigatório'),
  fullName: z.string().min(2, 'Seu nome é obrigatório'),
  email: z.string().email('Digite um e-mail válido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
});

type FormData = z.infer<typeof schema>;

function generateSlug(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 50) || 'workspace';
}

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      const result = await authService.register({
        workspaceName: data.workspaceName,
        slug: generateSlug(data.workspaceName),
        fullName: data.fullName,
        email: data.email,
        password: data.password,
      });
      setAuth(result.user, result.accessToken, result.refreshToken);
      navigate('/onboarding');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string; code?: string } } }).response?.data;
      setServerError(
        data?.code === 'email_in_use'
          ? 'Este e-mail já tem conta no TitanFlow. Entre com ele ou use outro e-mail.'
          : (data?.error ?? 'Falha no cadastro'),
      );
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="h-8 w-8 rounded-md bg-accent-green" />
          <span className="text-xl font-bold text-text-primary">TitanFlow</span>
        </div>

        <div className="card p-6 space-y-5">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Crie seu workspace</h1>
            <p className="text-sm text-text-secondary mt-1">Comece em minutos, grátis</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              {...register('workspaceName')}
              id="workspaceName"
              label="Nome da empresa"
              placeholder="Minha Empresa"
              error={errors.workspaceName?.message}
              autoComplete="organization"
            />
            <Input
              {...register('fullName')}
              id="fullName"
              label="Seu nome"
              placeholder="João Silva"
              error={errors.fullName?.message}
              autoComplete="name"
            />
            <Input
              {...register('email')}
              id="email"
              type="email"
              label="E-mail"
              placeholder="joao@empresa.com"
              error={errors.email?.message}
              autoComplete="email"
            />
            <Input
              {...register('password')}
              id="password"
              type="password"
              label="Senha"
              placeholder="Mín. 8 caracteres"
              error={errors.password?.message}
              autoComplete="new-password"
            />

            {serverError && (
              <p className="text-sm text-status-lost bg-status-lost/10 px-3 py-2 rounded">
                {serverError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Criando workspace…' : 'Começar grátis'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-bg-border" />
            </div>
            <div className="relative flex justify-center text-xs text-text-muted">
              <span className="px-2 bg-bg-surface">ou cadastre-se com</span>
            </div>
          </div>

          <GoogleButton label="Continuar com Google" />

          <p className="text-sm text-text-secondary text-center">
            Já tem um workspace?{' '}
            <Link to="/login" className="text-accent-green hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
