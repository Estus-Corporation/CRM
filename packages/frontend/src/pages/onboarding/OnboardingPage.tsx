import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Kanban, UserPlus, ArrowRight, Check } from 'lucide-react';
import { api } from '@/services/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LogoIcon } from '@/components/ui/LogoIcon';
import { toast } from 'sonner';

const pipelineSchema = z.object({
  pipelineName: z.string().min(1, 'Nome do pipeline é obrigatório').max(80),
});

const inviteSchema = z.object({
  email: z.string().email('Digite um e-mail válido'),
  fullName: z.string().min(2, 'Nome é obrigatório'),
});

type PipelineForm = z.infer<typeof pipelineSchema>;
type InviteForm = z.infer<typeof inviteSchema>;

const DEFAULT_STAGES = [
  { name: 'Prospecção', color: '#8A90A0' },
  { name: 'Qualificação', color: '#F5B547' },
  { name: 'Proposta', color: '#38B27E' },
  { name: 'Fechamento', color: '#4FD69C' },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [creatingPipeline, setCreatingPipeline] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  const pipelineForm = useForm<PipelineForm>({
    resolver: zodResolver(pipelineSchema),
    defaultValues: { pipelineName: 'Pipeline de Vendas' },
  });

  const inviteForm = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
  });

  const handleCreatePipeline = async (data: PipelineForm) => {
    setCreatingPipeline(true);
    try {
      const pipelineRes = await api.post('/pipelines', {
        name: data.pipelineName,
        isDefault: true,
      });
      const id = pipelineRes.data.data.id as string;
      setPipelineId(id);

      // Create default stages sequentially
      for (let i = 0; i < DEFAULT_STAGES.length; i++) {
        await api.post(`/pipelines/${id}/stages`, {
          name: DEFAULT_STAGES[i].name,
          color: DEFAULT_STAGES[i].color,
          position: i,
          probability: Math.round(((i + 1) / DEFAULT_STAGES.length) * 100),
        });
      }

      setStep(2);
    } catch {
      toast.error('Erro ao criar pipeline. Tente novamente.');
    } finally {
      setCreatingPipeline(false);
    }
  };

  const handleInvite = async (data: InviteForm) => {
    try {
      await api.post('/users/invite', {
        email: data.email,
        fullName: data.fullName,
        role: 'seller',
      });
      setInviteSent(true);
      toast.success(`Convite enviado para ${data.email}`);
    } catch {
      toast.error('Erro ao enviar convite.');
    }
  };

  const handleFinish = () => {
    navigate(pipelineId ? `/pipeline/${pipelineId}` : '/pipeline');
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <LogoIcon size={22} />
          <span className="text-xl font-bold text-text-primary">TitanFlow</span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 ${
                step > s
                  ? 'bg-accent-green text-bg-darker'
                  : step === s
                  ? 'bg-accent-green text-bg-darker'
                  : 'bg-bg-border text-text-muted'
              }`}>
                {step > s ? <Check size={14} /> : s}
              </div>
              {s < 2 && (
                <div className={`h-px flex-1 ${step > s ? 'bg-accent-green' : 'bg-bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1 — Pipeline */}
        {step === 1 && (
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-green/10 flex items-center justify-center">
                <Kanban size={20} className="text-accent-green" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-text-primary">Seu primeiro pipeline</h1>
                <p className="text-sm text-text-secondary">Como você quer chamar seu funil de vendas?</p>
              </div>
            </div>

            <form onSubmit={pipelineForm.handleSubmit(handleCreatePipeline)} className="space-y-4">
              <Input
                {...pipelineForm.register('pipelineName')}
                id="pipelineName"
                label="Nome do pipeline"
                placeholder="Pipeline de Vendas"
                error={pipelineForm.formState.errors.pipelineName?.message}
                autoFocus
              />

              <div className="space-y-1.5">
                <p className="text-xs text-text-muted">Etapas criadas automaticamente:</p>
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_STAGES.map((s) => (
                    <span
                      key={s.name}
                      className="text-xs px-2 py-1 rounded-full border"
                      style={{ borderColor: s.color, color: s.color, backgroundColor: `${s.color}15` }}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={creatingPipeline}>
                {creatingPipeline ? 'Criando…' : (
                  <span className="flex items-center gap-2">
                    Continuar <ArrowRight size={16} />
                  </span>
                )}
              </Button>
            </form>
          </div>
        )}

        {/* Step 2 — Invite */}
        {step === 2 && (
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-green/10 flex items-center justify-center">
                <UserPlus size={20} className="text-accent-green" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-text-primary">Convide seu time</h1>
                <p className="text-sm text-text-secondary">Opcional — você pode fazer isso depois nas configurações.</p>
              </div>
            </div>

            {!inviteSent ? (
              <form onSubmit={inviteForm.handleSubmit(handleInvite)} className="space-y-4">
                <Input
                  {...inviteForm.register('fullName')}
                  id="fullName"
                  label="Nome"
                  placeholder="Maria Oliveira"
                  error={inviteForm.formState.errors.fullName?.message}
                />
                <Input
                  {...inviteForm.register('email')}
                  id="email"
                  type="email"
                  label="E-mail"
                  placeholder="maria@empresa.com"
                  error={inviteForm.formState.errors.email?.message}
                />
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={handleFinish}
                  >
                    Pular
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={inviteForm.formState.isSubmitting}
                  >
                    {inviteForm.formState.isSubmitting ? 'Enviando…' : 'Enviar convite'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-accent-green/10 border border-accent-green/20">
                  <Check size={18} className="text-accent-green flex-shrink-0" />
                  <p className="text-sm text-text-primary">
                    Convite enviado com sucesso!
                  </p>
                </div>
                <Button className="w-full" onClick={handleFinish}>
                  <span className="flex items-center gap-2">
                    Ir para o pipeline <ArrowRight size={16} />
                  </span>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
