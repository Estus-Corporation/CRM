import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Check, Copy, MessageCircle, UserCheck, UserX } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersService, type TeamMember } from '@/services/users.service';
import { useTenant } from '@/hooks/useTenant';
import type { UserRole } from '@/store/authStore';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';

const ROLE_OPTIONS: { value: UserRole; label: string; hint: string }[] = [
  { value: 'captador', label: 'Captador', hint: 'Só vê os leads que você atribuir a ele, em "Meus leads".' },
  { value: 'seller', label: 'Vendedor', hint: 'Contatos, negócios, pipeline e agenda.' },
  { value: 'manager', label: 'Gerente', hint: 'Tudo do vendedor + relatórios e captação.' },
  { value: 'admin', label: 'Admin', hint: 'Acesso total, inclusive equipe, plano e comissões.' },
];

const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map((o) => [o.value, o.label]));

const schema = z.object({
  email: z.string().trim().email('E-mail inválido'),
  role: z.enum(['admin', 'manager', 'seller', 'captador']),
});

type FormData = z.infer<typeof schema>;

type Result = { kind: 'added'; member: TeamMember } | { kind: 'no_account'; email: string };

interface Props {
  open: boolean;
  onClose: () => void;
  /** Papel já escolhido (ex.: tela de Captação adiciona só captadores) */
  fixedRole?: UserRole;
}

/**
 * Adiciona ao workspace alguém que JÁ tem conta no TitanFlow (busca pelo e-mail).
 * Sem conta: mostra o link de cadastro pra mandar à pessoa — depois é só adicionar de novo.
 */
export function AddMemberModal({ open, onClose, fixedRole }: Props) {
  const qc = useQueryClient();
  const { data: tenant } = useTenant();
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', role: fixedRole ?? 'captador' },
  });
  const role = watch('role');

  const add = useMutation({
    mutationFn: usersService.invite,
    onSuccess: (member) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['captacao'] });
      setResult({ kind: 'added', member });
    },
    onError: (err, input) => {
      const code = (err as { response?: { data?: { code?: string } } }).response?.data?.code;
      if (code === 'account_not_found') setResult({ kind: 'no_account', email: input.email });
      else if (code === 'already_member') toast.error('Essa pessoa já faz parte deste workspace');
      else toast.error('Não foi possível adicionar');
    },
  });

  const handleClose = () => {
    onClose();
    // Limpa depois da animação de saída
    setTimeout(() => {
      setResult(null);
      setCopied(false);
      reset({ email: '', role: fixedRole ?? 'captador' });
    }, 250);
  };

  const signupUrl = `${window.location.origin}/register`;
  const inviteMessage = [
    `Olá! Quero te adicionar ao ${tenant?.name ?? 'nosso workspace'} no TitanFlow.`,
    '',
    `1. Crie sua conta grátis: ${signupUrl}`,
    result?.kind === 'no_account' ? `2. Use este e-mail: ${result.email}` : '',
    '3. Me avise que eu te adiciono na equipe.',
  ]
    .filter(Boolean)
    .join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteMessage);
      setCopied(true);
      toast.success('Mensagem copiada');
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const title = fixedRole === 'captador' ? 'Adicionar captador' : 'Adicionar membro';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={result?.kind === 'added' ? 'Adicionado à equipe' : result?.kind === 'no_account' ? 'Essa pessoa ainda não tem conta' : title}
      description={
        result
          ? undefined
          : 'Digite o e-mail da conta da pessoa no TitanFlow. Ela passa a ver este workspace no seletor dela.'
      }
    >
      {result?.kind === 'added' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-accent-green/10 px-4 py-3">
            <Avatar name={result.member.full_name} src={result.member.avatar_url ?? undefined} className="h-10 w-10" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">{result.member.full_name}</p>
              <p className="truncate text-xs text-text-muted">{result.member.email}</p>
            </div>
            <span className="flex items-center gap-1 text-xs font-medium text-accent-green">
              <UserCheck size={14} /> {ROLE_LABEL[result.member.role]}
            </span>
          </div>
          <p className="text-xs text-text-muted">
            Ela recebeu um aviso na caixa de entrada e já pode trocar para este workspace no seletor do menu.
          </p>
          <div className="flex justify-end">
            <Button onClick={handleClose}>Concluir</Button>
          </div>
        </div>
      ) : result?.kind === 'no_account' ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-accent-amber/10 px-4 py-3 text-sm text-text-secondary">
            <UserX size={18} className="mt-0.5 flex-shrink-0 text-accent-amber" />
            <p>
              Não existe conta com <strong className="text-text-primary">{result.email}</strong>. Mande o link de cadastro
              para a pessoa; quando ela criar a conta, é só adicionar de novo.
            </p>
          </div>
          <pre className="whitespace-pre-wrap rounded-lg border border-fg/[0.08] bg-fg/[0.03] p-3 font-sans text-xs text-text-secondary">
            {inviteMessage}
          </pre>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setResult(null)}>
              Voltar
            </Button>
            <Button variant="secondary" asChild>
              <a href={`https://wa.me/?text=${encodeURIComponent(inviteMessage)}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={15} />
                WhatsApp
              </a>
            </Button>
            <Button onClick={copy}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copiado' : 'Copiar mensagem'}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit((data) => add.mutate(data))} className="space-y-4">
          <Input
            {...register('email')}
            id="member-email"
            type="email"
            label="E-mail da conta *"
            placeholder="tarcisio@email.com"
            autoComplete="off"
            error={errors.email?.message}
          />

          {!fixedRole && (
            <div className="flex flex-col gap-1">
              <label htmlFor="member-role" className="text-xs font-medium text-text-secondary">
                Papel neste workspace
              </label>
              <select id="member-role" {...register('role')} className="input-base">
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-text-muted">{ROLE_OPTIONS.find((o) => o.value === role)?.hint}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? 'Procurando…' : 'Adicionar'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
