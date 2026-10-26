import { useRef, useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { dropdownMotion } from '@/lib/motion';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bell, Check, CheckCheck, Trophy, TrendingDown, ArrowRightLeft, PhoneCall, UserCheck, UserX, Users, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/useNotifications';
import type { Notification } from '@/services/notifications.service';
import type { WorkspaceInvite } from '@/services/invites.service';
import { useAcceptInvite, useDeclineInvite, useMyInvites } from '@/hooks/useInvites';
import { CompanyLogo } from '@/components/company/CompanyLogo';

const TYPE_ICON: Record<string, LucideIcon> = {
  'deal.won': Trophy,
  'deal.lost': TrendingDown,
  'deal.stage_changed': ArrowRightLeft,
  'leads.assigned': PhoneCall,
  'leads.won': Trophy,
  'workspace.added': Users,
  'workspace.invite_accepted': UserCheck,
  'workspace.invite_declined': UserX,
};

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', manager: 'Gerente', seller: 'Vendedor', captador: 'Captador' };

/** Convite pra entrar num workspace: aceitar cria o vínculo, recusar só some daqui */
function InviteItem({ invite }: { invite: WorkspaceInvite }) {
  const accept = useAcceptInvite();
  const decline = useDeclineInvite();
  const busy = accept.isPending || decline.isPending;
  return (
    <div className="bg-accent-green/[0.06] px-4 py-3">
      <div className="flex items-start gap-3">
        <CompanyLogo name={invite.tenant_name} logoUrl={invite.tenant_logo_url} className="h-9 w-9 flex-shrink-0 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary">
            Convite para <span className="text-accent-green">{invite.tenant_name}</span>
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {invite.invited_by_name ?? 'Um admin'} quer você como <strong className="text-text-secondary">{ROLE_LABEL[invite.role] ?? invite.role}</strong>
          </p>
          <p className="mt-1 text-[10px] text-text-muted">
            {formatDistanceToNow(new Date(invite.created_at), { addSuffix: true, locale: ptBR })}
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex gap-2 pl-12">
        <button
          type="button"
          disabled={busy}
          onClick={() => accept.mutate(invite.id)}
          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent-green text-xs font-semibold text-[rgb(var(--on-accent))] transition-colors hover:bg-accent-green-dim disabled:opacity-60"
        >
          <Check size={13} strokeWidth={2.5} />
          Aceitar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decline.mutate(invite.id)}
          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-fg/[0.1] text-xs font-medium text-text-secondary transition-colors hover:bg-fg/[0.05] hover:text-text-primary disabled:opacity-60"
        >
          <X size={13} />
          Recusar
        </button>
      </div>
    </div>
  );
}

function NotificationItem({ n, onRead }: { n: Notification; onRead: (id: string) => void }) {
  const Icon = TYPE_ICON[n.type] ?? Bell;
  return (
    <button
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-bg-border transition-colors',
        !n.read && 'bg-accent-green/5',
      )}
      onClick={() => !n.read && onRead(n.id)}
    >
      <div
        className={cn(
          'mt-0.5 p-1.5 rounded-full flex-shrink-0',
          (n.type === 'deal.won' || n.type === 'leads.won') && 'bg-status-won/20 text-status-won',
          (n.type === 'leads.assigned' || n.type === 'workspace.added' || n.type === 'workspace.invite_accepted') &&
            'bg-accent-green/15 text-accent-green',
          n.type === 'workspace.invite_declined' && 'bg-fg/[0.08] text-text-muted',
          n.type === 'deal.lost' && 'bg-status-lost/20 text-status-lost',
          n.type === 'deal.stage_changed' && 'bg-status-open/20 text-status-open',
          !TYPE_ICON[n.type] && 'bg-bg-border text-text-muted',
        )}
      >
        <Icon size={12} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm truncate', n.read ? 'text-text-secondary' : 'text-text-primary font-medium')}>{n.title}</p>
        {n.body && <p className="text-xs text-text-muted truncate mt-0.5">{n.body}</p>}
        <p className="text-[10px] text-text-muted mt-1">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
        </p>
      </div>
      {!n.read && <span className="w-2 h-2 rounded-full bg-accent-green flex-shrink-0 mt-1.5" />}
    </button>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Botão que abre o painel: o painel se posiciona embaixo dele e cliques nele não contam como "fora" */
  anchorRef: RefObject<HTMLElement>;
}

const PANEL_WIDTH = 320;

/** Caixa de entrada. Renderiza em portal (fixed) pra escapar do overflow do menu lateral. */
export function NotificationPanel({ open, onClose, anchorRef }: Props) {
  const { notifications, markRead, markAllRead } = useNotifications();
  const { data: invites = [] } = useMyInvites();
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: PANEL_WIDTH, origin: 'top left' });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    // Mantém o painel dentro da tela (16px de margem); celular estreito encolhe a largura
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 32);
    const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
    // A animação "cai" a partir do botão que abriu
    setPos({ top: rect.bottom + 8, left, width, origin: `${rect.left + rect.width / 2 - left}px top` });
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('resize', onClose);
    };
  }, [open, onClose, anchorRef]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          {...dropdownMotion}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, transformOrigin: pos.origin }}
          className="z-[70] overflow-hidden rounded-xl border border-bg-border bg-bg-surface shadow-xl"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border">
            <h3 className="text-sm font-semibold text-text-primary">Caixa de entrada</h3>
            {notifications.some((n) => !n.read) && (
              <button
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 text-[11px] text-accent-green hover:text-accent-green-dim transition-colors"
              >
                <CheckCheck size={12} />
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-bg-border">
            {invites.map((i) => (
              <InviteItem key={i.id} invite={i} />
            ))}
            {notifications.length === 0 && invites.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell size={24} className="mx-auto text-text-muted mb-2" />
                <p className="text-sm text-text-muted">Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map((n) => <NotificationItem key={n.id} n={n} onRead={(id) => markRead.mutate(id)} />)
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
