import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, SearchCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useUsers } from '@/hooks/useUsers';
import { useCancelLeadRequest, useLeadRequest, useLeadRequests } from '@/hooks/useLeadRequests';
import type { LeadRequest, LeadRequestStatus } from '@/services/leadRequests.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { DataList, DataListBody, DataListRow, DataListSkeleton } from '@/components/ui/DataList';
import { LeadRequestForm } from '@/components/lead-requests/LeadRequestForm';

const STATUS: Record<LeadRequestStatus, { label: string; variant: 'default' | 'green' | 'red' | 'blue' | 'manager' }> = {
  queued: { label: 'Na fila', variant: 'default' },
  claimed: { label: 'Reservado', variant: 'blue' },
  running: { label: 'Em execução', variant: 'blue' },
  done: { label: 'Concluído', variant: 'green' },
  partial: { label: 'Parcial', variant: 'manager' },
  failed: { label: 'Falhou', variant: 'red' },
  cancelled: { label: 'Cancelado', variant: 'default' },
};

// Uma coluna só: cada pedido é um bloco empilhado (sem rolagem lateral no celular)
const ROW_GRID = 'grid-cols-1';

function DeliveredContacts({ id, isCaptador }: { id: string; isCaptador: boolean }) {
  const { data, isLoading } = useLeadRequest(id);
  if (isLoading) return <Spinner />;
  const contacts = data?.contacts ?? [];
  if (contacts.length === 0) return <p className="text-xs text-text-muted">Nenhuma empresa nova entregue neste pedido.</p>;
  return (
    <ul className="space-y-1.5">
      {contacts.map((c) => (
        <li key={c.id} className="min-w-0">
          <Link
            to={isCaptador ? '/meus-leads' : `/contacts/${c.id}`}
            className="block truncate text-sm text-accent-green hover:underline"
          >
            {c.company_name ?? c.full_name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

interface RowProps {
  r: LeadRequest;
  index: number;
  canSeeRequester: boolean;
  canCancel: boolean;
  isCaptador: boolean;
}

function RequestRow({ r, index, canSeeRequester, canCancel, isCaptador }: RowProps) {
  const [open, setOpen] = useState(false);
  const cancel = useCancelLeadRequest();
  const st = STATUS[r.status];
  const hasContacts = r.delivered_count > 0;

  return (
    <DataListRow grid={ROW_GRID} index={index} onClick={hasContacts ? () => setOpen((v) => !v) : undefined}>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="min-w-0 break-words text-sm font-medium text-text-primary">
            {r.niche} · {r.city}
          </p>
          <Badge variant={st.variant}>{st.label}</Badge>
          {hasContacts && (
            <ChevronDown size={15} className={cn('text-text-muted transition-transform', open && 'rotate-180')} />
          )}
          {canCancel && r.status === 'queued' && (
            <Button
              variant="secondary"
              size="sm"
              className="ml-auto"
              disabled={cancel.isPending}
              onClick={(e) => {
                e.stopPropagation();
                cancel.mutate(r.id);
              }}
            >
              Cancelar
            </Button>
          )}
        </div>
        <p className="text-xs text-text-muted">
          {r.quantity} {r.quantity === 1 ? 'empresa' : 'empresas'} pedidas · {r.delivered_count} entregue(s) ·{' '}
          {format(new Date(r.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          {canSeeRequester && <> · Pedido por {r.requester_name ?? 'ex-membro'}</>}
        </p>
        {r.message && <p className="break-words text-xs text-text-secondary">{r.message}</p>}
        {open && (
          <div className="pt-1" onClick={(e) => e.stopPropagation()}>
            <DeliveredContacts id={r.id} isCaptador={isCaptador} />
          </div>
        )}
      </div>
    </DataListRow>
  );
}

/** Só admin/gerente renderizam: a lista de usuários não é pedida pelos demais papéis */
function UserFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useUsers();
  return (
    <select
      aria-label="Filtrar por usuário"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input-base max-sm:w-full sm:w-56"
    >
      <option value="">Todos os usuários</option>
      {(data?.data ?? []).map((u) => (
        <option key={u.id} value={u.id}>{u.full_name}</option>
      ))}
    </select>
  );
}

export function LeadRequestsPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const isManagerial = role === 'admin' || role === 'manager';
  const [userId, setUserId] = useState('');
  const { data, isLoading } = useLeadRequests(isManagerial && userId ? { userId } : {});
  const requests = data ?? [];

  return (
    // mobile-sections: no celular cada bloco vira um card translúcido separado (ver globals.css)
    <div className="mobile-sections space-y-5 max-md:space-y-3">
      <PageHeader
        title="Solicitações de leads"
        subtitle="Peça empresas por nicho e cidade; o Radar Local busca e entrega aqui"
        actions={isManagerial ? <UserFilter value={userId} onChange={setUserId} /> : undefined}
      />

      <div>
        <LeadRequestForm />
      </div>

      <div>
        {isLoading ? (
          <DataListSkeleton grid={ROW_GRID} cells={1} rows={3} />
        ) : requests.length === 0 ? (
          <div className="card">
            <EmptyState icon={SearchCheck} title="Nenhum pedido ainda" description="Faça um pedido acima e acompanhe o andamento por aqui." />
          </div>
        ) : (
          <DataList>
            <DataListBody>
              {requests.map((r, i) => (
                <RequestRow
                  key={r.id}
                  r={r}
                  index={i}
                  canSeeRequester={isManagerial}
                  canCancel={isManagerial || r.requested_by === user?.id}
                  isCaptador={role === 'captador'}
                />
              ))}
            </DataListBody>
          </DataList>
        )}
      </div>
    </div>
  );
}
