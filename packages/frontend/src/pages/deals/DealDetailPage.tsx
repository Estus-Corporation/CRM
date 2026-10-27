import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, X, DollarSign, Calendar, User, RotateCcw, Trash2, Pencil, Check } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dealsService } from '@/services/pipeline.service';
import { useMarkWon, useMarkLost, useMarkOpen, useDeleteDeal, useUpdateDeal } from '@/hooks/usePipeline';
import { useUsers } from '@/hooks/useUsers';
import { ActivityTimeline } from '@/components/activities/ActivityTimeline';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';

const statusLabel: Record<string, string> = {
  open: 'Em aberto',
  won: 'Ganho',
  lost: 'Perdido',
};

const statusVariant: Record<string, 'green' | 'default' | 'red'> = {
  open: 'default',
  won: 'green',
  lost: 'red',
};

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
}

export function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState(false);
  const [pendingOwnerId, setPendingOwnerId] = useState<string>('');

  const dealQueryKey = ['deals', id];

  const { data: deal, isLoading } = useQuery({
    queryKey: dealQueryKey,
    queryFn: () => dealsService.get(id!),
    enabled: !!id,
  });

  const markWon = useMarkWon();
  const markLost = useMarkLost();
  const markOpen = useMarkOpen();
  const deleteDeal = useDeleteDeal();
  const updateDeal = useUpdateDeal();
  const { data: usersData } = useUsers();
  const users = usersData?.data ?? [];

  const invalidateDeal = () => qc.invalidateQueries({ queryKey: dealQueryKey });

  const handleOwnerSave = () => {
    updateDeal.mutate(
      { id: deal!.id, input: { ownerId: pendingOwnerId || null } },
      { onSuccess: () => { invalidateDeal(); setEditingOwner(false); } },
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><Spinner /></div>;
  }

  if (!deal) {
    return <div className="text-center py-24 text-text-muted">Negócio não encontrado.</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="page-title-sm flex-1">{deal.title}</h1>
        <Badge variant={statusVariant[deal.status] ?? 'default'}>
          {statusLabel[deal.status] ?? deal.status}
        </Badge>

        {/* Open → can mark Won or Lost */}
        {deal.status === 'open' && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => markWon.mutate(deal.id, { onSuccess: invalidateDeal })}
              disabled={markWon.isPending}
            >
              <Trophy size={13} /> Ganho
            </Button>
            <Button
              size="sm"
              variant="warning"
              onClick={() => setLostModalOpen(true)}
            >
              <X size={13} /> Perdido
            </Button>
          </div>
        )}

        {/* Won → can reopen or mark Lost */}
        {deal.status === 'won' && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => markOpen.mutate(deal.id, { onSuccess: invalidateDeal })}
              disabled={markOpen.isPending}
            >
              <RotateCcw size={13} /> Reabrir
            </Button>
            <Button
              size="sm"
              variant="warning"
              onClick={() => setLostModalOpen(true)}
            >
              <X size={13} /> Marcar como perdido
            </Button>
          </div>
        )}

        {/* Lost → can reopen or mark Won */}
        {deal.status === 'lost' && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => markOpen.mutate(deal.id, { onSuccess: invalidateDeal })}
              disabled={markOpen.isPending}
            >
              <RotateCcw size={13} /> Reabrir
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => markWon.mutate(deal.id, { onSuccess: invalidateDeal })}
              disabled={markWon.isPending}
            >
              <Trophy size={13} /> Marcar como ganho
            </Button>
          </div>
        )}

        {/* Delete — always visible */}
        <Button
          size="sm"
          variant="danger"
          onClick={() => setDeleteModalOpen(true)}
        >
          <Trash2 size={13} /> Excluir
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5 space-y-4">
          <p className="text-sm font-medium text-text-primary">Detalhes</p>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-text-secondary">
              <DollarSign size={14} className="text-text-muted flex-shrink-0" />
              <span className="font-medium text-accent-green">
                {formatCurrency(Number(deal.value), deal.currency)}
              </span>
            </div>

            {deal.contact_name && (
              <div className="flex items-center gap-2 text-text-secondary">
                <User size={14} className="text-text-muted flex-shrink-0" />
                <span>{deal.contact_name}</span>
              </div>
            )}

            {deal.expected_close && (
              <div className="flex items-center gap-2 text-text-secondary">
                <Calendar size={14} className="text-text-muted flex-shrink-0" />
                <span>Previsão: {new Date(deal.expected_close).toLocaleDateString('pt-BR')}</span>
              </div>
            )}

            <div className="flex items-start gap-2 text-text-secondary">
              <User size={14} className="text-text-muted flex-shrink-0 mt-0.5" />
              {editingOwner ? (
                <div className="flex items-center gap-1.5 flex-1">
                  <select
                    className="input-base flex-1 text-sm py-0.5 h-7"
                    value={pendingOwnerId}
                    onChange={(e) => setPendingOwnerId(e.target.value)}
                    autoFocus
                  >
                    <option value="">— Sem responsável</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleOwnerSave}
                    disabled={updateDeal.isPending}
                    className="p-1 rounded text-accent-green hover:bg-accent-green/10 transition-colors"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    onClick={() => setEditingOwner(false)}
                    className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-border transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-1 group">
                  <span className="text-sm">
                    {deal.owner_name ? `Responsável: ${deal.owner_name}` : 'Sem responsável'}
                  </span>
                  <button
                    onClick={() => { setPendingOwnerId(deal.owner_id ?? ''); setEditingOwner(true); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-muted hover:text-accent-green transition-all"
                  >
                    <Pencil size={11} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-bg-border text-xs text-text-muted space-y-1">
            <p>Criado em: {new Date(deal.created_at).toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        <div className="lg:col-span-2 card p-5">
          <ActivityTimeline dealId={deal.id} />
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Excluir negócio">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Tem certeza que deseja excluir <span className="font-semibold text-text-primary">"{deal.title}"</span>?
            Essa ação é irreversível — o negócio, seu histórico de atividades, notificações e registros de auditoria serão removidos permanentemente.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={() => deleteDeal.mutate(deal.id, { onSuccess: () => navigate('/deals') })}
              disabled={deleteDeal.isPending}
            >
              {deleteDeal.isPending ? 'Excluindo...' : 'Excluir permanentemente'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Lost reason modal — used both when marking lost from open and from won */}
      <Modal open={lostModalOpen} onClose={() => setLostModalOpen(false)} title="Marcar como perdido">
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-secondary">Motivo da perda (opcional)</label>
            <textarea
              className="input-base resize-none"
              rows={3}
              placeholder="Ex: Cliente escolheu concorrente..."
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setLostModalOpen(false)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={() => {
                markLost.mutate(
                  { id: deal.id, reason: lostReason },
                  { onSuccess: () => { setLostModalOpen(false); invalidateDeal(); } },
                );
              }}
              disabled={markLost.isPending}
            >
              {markLost.isPending ? 'Salvando...' : 'Confirmar perda'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
