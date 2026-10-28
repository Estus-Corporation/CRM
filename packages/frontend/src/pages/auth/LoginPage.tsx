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
  email: z.string().email('Digite um e-mail válido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
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
      const result = await authService.login(data);
      setAuth(result.user, result.accessToken, result.refreshToken);
      navigate('/dashboard');
    } catch (err: unknown) {
      const e = err as { code?: string; response?: { status?: number; data?: { error?: string } } };
      if (!e.response) {
        // Sem resposta: servidor desligado, tempo esgotado ou bloqueado pelo navegador
        setServerError(
          e.code === 'ECONNABORTED'
            ? 'O servidor demorou demais para responder. Tente de novo em instantes.'
            : 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.',
        );
      } else if (e.response.status === 401) {
        setServerError('E-mail ou senha incorretos.');
      } else {
        setServerError(e.response.data?.error ?? 'Falha no login');
      }
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
            <h1 className="text-lg font-semibold text-text-primary">Entrar</h1>
            <p className="text-sm text-text-secondary mt-1">Bem-vindo de volta ao seu workspace</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              {...register('email')}
              id="email"
              type="email"
              label="E-mail"
              placeholder="voce@empresa.com"
              error={errors.email?.message}
              autoComplete="email"
            />
            <Input
              {...register('password')}
              id="password"
              type="password"
              label="Senha"
              placeholder="••••••••"
              error={errors.password?.message}
              autoComplete="current-password"
            />

            {serverError && (
              <p className="text-sm text-status-lost bg-status-lost/10 px-3 py-2 rounded">
                {serverError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-bg-border" />
            </div>
            <div className="relative flex justify-center text-xs text-text-muted">
              <span className="px-2 bg-bg-surface">ou</span>
            </div>
          </div>

          <GoogleButton label="Entrar com Google" />

          <p className="text-sm text-text-secondary text-center">
            Não tem um workspace?{' '}
            <Link to="/register" className="text-accent-green hover:underline">
              Criar um
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
