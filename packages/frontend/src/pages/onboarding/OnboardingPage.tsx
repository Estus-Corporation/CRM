import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Kanban, UserPlus, ArrowRight, Check } from 'lucide-react';
import { api } from '@/services/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LogoIcon } from '@/components/ui/LogoIcon';
import { CompanyProfileForm } from '@/components/company/CompanyProfileForm';
import { AddMemberModal } from '@/components/team/AddMemberModal';
import { useTenant } from '@/hooks/useTenant';
import { useUsers } from '@/hooks/useUsers';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const pipelineSchema = z.object({
  pipelineName: z.string().min(1, 'Nome do pipeline é obrigatório').max(80),
});

type PipelineForm = z.infer<typeof pipelineSchema>;

const DEFAULT_STAGES = [
  { name: 'Prospecção', color: '#8A90A0' },
  { name: 'Qualificação', color: '#F5B547' },
  { name: 'Proposta', color: '#38B27E' },
  { name: 'Fechamento', color: '#4FD69C' },
];

const STEPS = [1, 2, 3] as const;
type Step = (typeof STEPS)[number];

function StepHeader({ icon: Icon, title, subtitle }: { icon: typeof Kanban; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-accent-green/10">
        <Icon size={20} className="text-accent-green" />
      </div>
      <div>
        <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
        <p className="text-sm text-text-secondary">{subtitle}</p>
      </div>
    </div>
  );
}

/** Pós-cadastro: 1) perfil da empresa  2) primeiro pipeline  3) equipe (opcional) */
export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [creatingPipeline, setCreatingPipeline] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { data: tenant } = useTenant();
  const { data: users } = useUsers();
  const teamSize = users?.data.length ?? 1;

  const pipelineForm = useForm<PipelineForm>({
    resolver: zodResolver(pipelineSchema),
    defaultValues: { pipelineName: 'Pipeline de Vendas' },
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

      setStep(3);
    } catch {
      toast.error('Erro ao criar pipeline. Tente novamente.');
    } finally {
      setCreatingPipeline(false);
    }
  };

  const handleFinish = () => {
    navigate(pipelineId ? `/pipeline/${pipelineId}` : '/pipeline');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary p-4">
      {/* O passo da empresa tem textos longos: card mais largo */}
      <div className={cn('w-full py-8', step === 1 ? 'max-w-2xl' : 'max-w-md')}>
        {/* Header */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <LogoIcon size={22} />
          <span className="text-xl font-bold text-text-primary">TitanFlow</span>
        </div>

        {/* Progress */}
        <div className="mx-auto mb-8 flex max-w-md items-center gap-2">
          {STEPS.map((s) => (
            <div key={s} className={cn('flex items-center gap-2', s < STEPS.length && 'flex-1')}>
              <div
                className={cn(
                  'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  step >= s ? 'bg-accent-green text-bg-darker' : 'bg-bg-border text-text-muted',
                )}
              >
                {step > s ? <Check size={14} /> : s}
              </div>
              {s < STEPS.length && <div className={cn('h-px flex-1', step > s ? 'bg-accent-green' : 'bg-bg-border')} />}
            </div>
          ))}
        </div>

        {/* Step 1 — Empresa */}
        {step === 1 && (
          <div className="card space-y-5 p-6">
            <StepHeader
              icon={Building2}
              title="Conte sobre a sua empresa"
              subtitle="Sua equipe vai ler isso em “Sobre a empresa” para entender o que vender e como abordar."
            />
            <CompanyProfileForm
              tenant={tenant}
              submitLabel="Continuar"
              onSaved={() => setStep(2)}
              secondaryAction={
                <Button type="button" variant="ghost" onClick={() => setStep(2)}>
                  Preencher depois
                </Button>
              }
            />
          </div>
        )}

        {/* Step 2 — Pipeline */}
        {step === 2 && (
          <div className="card space-y-5 p-6">
            <StepHeader icon={Kanban} title="Seu primeiro pipeline" subtitle="Como você quer chamar seu funil de vendas?" />

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
                      className="rounded-full border px-2 py-1 text-xs"
                      style={{ borderColor: s.color, color: s.color, backgroundColor: `${s.color}15` }}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={creatingPipeline}>
                {creatingPipeline ? (
                  'Criando…'
                ) : (
                  <span className="flex items-center gap-2">
                    Continuar <ArrowRight size={16} />
                  </span>
                )}
              </Button>
            </form>
          </div>
        )}

        {/* Step 3 — Equipe */}
        {step === 3 && (
          <div className="card space-y-5 p-6">
            <StepHeader
              icon={UserPlus}
              title="Monte sua equipe"
              subtitle="Opcional — você pode fazer isso depois em Configurações."
            />

            <p className="text-sm text-text-secondary">
              Adicione vendedores ou captadores pelo e-mail da conta deles no TitanFlow. Quem ainda não tem conta recebe o link para se cadastrar.
            </p>
            {teamSize > 1 && (
              <div className="flex items-center gap-3 rounded-lg border border-accent-green/20 bg-accent-green/10 px-4 py-3">
                <Check size={18} className="flex-shrink-0 text-accent-green" />
                <p className="text-sm text-text-primary">
                  {teamSize - 1} pessoa{teamSize - 1 !== 1 ? 's' : ''} na equipe além de você
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setAddOpen(true)}>
                <UserPlus size={15} />
                Adicionar alguém
              </Button>
              <Button className="flex-1" onClick={handleFinish}>
                <span className="flex items-center gap-2">
                  {teamSize > 1 ? 'Concluir' : 'Pular'} <ArrowRight size={16} />
                </span>
              </Button>
            </div>

            <AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
