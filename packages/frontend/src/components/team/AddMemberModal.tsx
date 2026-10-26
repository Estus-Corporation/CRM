import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Check, Copy, MailCheck, MessageCircle, UserPlus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersService, type SentInvite } from '@/services/users.service';
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

type Result = { kind: 'sent'; invite: SentInvite };

interface Props {
  open: boolean;
  onClose: () => void;
  /** Papel já escolhido (ex.: tela de Captação adiciona só captadores) */
  fixedRole?: UserRole;
}

/**
 * Convida alguém pelo e-mail. A pessoa recebe o convite na caixa de entrada (e por e-mail) e aceita
 * ou recusa. Sem conta ainda: o convite aparece quando ela se cadastrar — mostramos o link pra mandar.
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
    onSuccess: (invite) => {
      qc.invalidateQueries({ queryKey: ['invites', 'tenant'] });
      setResult({ kind: 'sent', invite });
    },
    onError: (err) => {
      const code = (err as { response?: { data?: { code?: string } } }).response?.data?.code;
      if (code === 'already_member') toast.error('Essa pessoa já faz parte deste workspace');
      else toast.error('Não foi possível enviar o convite');
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
    `Olá! Te convidei para o ${tenant?.name ?? 'nosso workspace'} no TitanFlow.`,
    '',
    `1. Crie sua conta grátis: ${signupUrl}`,
    result ? `2. Use este e-mail: ${result.invite.email}` : '',
    '3. Aceite o convite na caixa de entrada.',
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

  const title = fixedRole === 'captador' ? 'Convidar captador' : 'Convidar membro';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={result ? 'Convite enviado' : title}
      description={
        result
          ? undefined
          : 'Digite o e-mail da pessoa. Ela recebe o convite na caixa de entrada e escolhe se quer participar.'
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-accent-green/10 px-4 py-3">
            <Avatar
              name={result.invite.full_name ?? result.invite.email}
              src={result.invite.avatar_url ?? undefined}
              className="h-10 w-10"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">{result.invite.full_name ?? result.invite.email}</p>
              {result.invite.full_name && <p className="truncate text-xs text-text-muted">{result.invite.email}</p>}
            </div>
            <span className="flex flex-shrink-0 items-center gap-1 text-xs font-medium text-accent-green">
              <MailCheck size={14} /> {ROLE_LABEL[result.invite.role]}
            </span>
          </div>

          {result.invite.has_account ? (
            <p className="text-xs text-text-muted">
              O convite está na caixa de entrada dela. Quando aceitar, ela entra na equipe e você recebe um aviso.
            </p>
          ) : (
            <>
              <p className="text-xs text-text-muted">
                Essa pessoa ainda não tem conta. O convite fica guardado e aparece na caixa de entrada dela assim que se
                cadastrar com esse e-mail. Mande o link:
              </p>
              <pre className="whitespace-pre-wrap rounded-lg border border-fg/[0.08] bg-fg/[0.03] p-3 font-sans text-xs text-text-secondary">
                {inviteMessage}
              </pre>
            </>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {!result.invite.has_account && (
              <>
                <Button variant="secondary" asChild>
                  <a href={`https://wa.me/?text=${encodeURIComponent(inviteMessage)}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle size={15} />
                    WhatsApp
                  </a>
                </Button>
                <Button variant="secondary" onClick={copy}>
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </>
            )}
            <Button onClick={handleClose}>Concluir</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit((data) => add.mutate(data))} className="space-y-4">
          <Input
            {...register('email')}
            id="member-email"
            type="email"
            label="E-mail *"
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
              <UserPlus size={15} />
              {add.isPending ? 'Enviando…' : 'Enviar convite'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
