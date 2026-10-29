import { CheckCircle2, CircleDotDashed, Hourglass, PhoneCall, Trophy, XCircle, type LucideIcon } from 'lucide-react';
import type { CallStatus, LeadResult, LostReason, Outcome, WhatsappStatus } from '@/services/captacao.service';
import { hasStartedContact, LOST_REASON_LABEL } from '@/lib/captacao';
import { cn } from '@/lib/utils';

interface StatusLead {
  outcome: Outcome;
  concluded_at: string | null;
  on_hold_at: string | null;
  lead_result: LeadResult | null;
  lost_reason: LostReason | null;
  call_status: CallStatus;
  whatsapp_at: string | null;
  whatsapp_status: WhatsappStatus | null;
  attempts_count: number;
}

export interface LeadStatus {
  label: string;
  icon: LucideIcon;
  className: string;
  at?: string;
}

/** Em que pé o captador deixou o lead (quem define é o captador; "fechou/não fechou" é a decisão do admin) */
export function leadStatus(a: StatusLead): LeadStatus {
  if (a.outcome === 'won') return { label: 'Fechou negócio', icon: Trophy, className: 'border-accent-green/30 bg-accent-green/10 text-accent-green' };
  if (a.outcome === 'lost') return { label: 'Não fechou', icon: XCircle, className: 'border-fg/[0.1] bg-fg/[0.05] text-text-muted' };
  if (a.concluded_at && a.lead_result === 'won')
    return { label: 'Ganhou', icon: Trophy, className: 'border-accent-green/30 bg-accent-green/10 text-accent-green', at: a.concluded_at };
  if (a.concluded_at && a.lead_result === 'lost')
    return {
      label: a.lost_reason ? `Perdeu · ${LOST_REASON_LABEL[a.lost_reason]}` : 'Perdeu',
      icon: XCircle,
      className: 'border-status-lost/30 bg-status-lost/10 text-status-lost',
      at: a.concluded_at,
    };
  if (a.concluded_at)
    return { label: 'Concluído', icon: CheckCircle2, className: 'border-accent-green/30 bg-accent-green/10 text-accent-green', at: a.concluded_at };
  if (a.on_hold_at)
    return { label: 'Em aguardo', icon: Hourglass, className: 'border-accent-amber/30 bg-accent-amber/10 text-accent-amber', at: a.on_hold_at };
  if (hasStartedContact(a))
    return { label: 'Em qualificação', icon: PhoneCall, className: 'border-fg/[0.22] bg-fg/[0.07] text-text-primary', at: a.whatsapp_at ?? undefined };
  return { label: 'Pendente', icon: CircleDotDashed, className: 'border-fg/[0.1] bg-fg/[0.03] text-text-muted' };
}

const shortDate = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function statusTitle(s: LeadStatus) {
  return `${s.label}${s.at ? ` em ${shortDate(s.at)}` : ''}`;
}

/** O status como um ícone só, num quadradinho (o nome aparece ao passar o mouse) */
export function LeadStatusIcon({ status, title, size = 'md' }: { status: LeadStatus; title?: string; size?: 'sm' | 'md' }) {
  const Icon = status.icon;
  return (
    <span
      title={title ?? statusTitle(status)}
      aria-label={status.label}
      className={cn('flex flex-shrink-0 items-center justify-center rounded-xl border', size === 'sm' ? 'h-8 w-8' : 'h-10 w-11', status.className)}
    >
      <Icon size={size === 'sm' ? 16 : 19} />
    </span>
  );
}
