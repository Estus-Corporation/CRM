import type { Notification } from '@/services/notifications.service';

/**
 * Para onde a notificação leva ao ser clicada (null = só informativa).
 * `resource_*` vem do backend; tipos sem recurso caem na tela onde a pessoa age.
 */
export function notificationLink(n: Pick<Notification, 'type' | 'resource_type' | 'resource_id'>): string | null {
  const id = n.resource_id;
  switch (n.type) {
    // Negócio movido/ganho/perdido: a página do negócio tem o histórico
    case 'deal.stage_changed':
    case 'deal.won':
    case 'deal.lost':
      return id ? `/deals/${id}` : '/deals';
    // Alguém entrou/recusou: abre a equipe já destacando a pessoa
    case 'workspace.invite_accepted':
    case 'workspace.invite_declined':
      return id ? `/settings?membro=${id}` : '/settings';
    case 'workspace.added':
      return '/dashboard';
    // Captador
    case 'leads.assigned':
      return '/meus-leads';
    case 'leads.followup':
      return id ? `/meus-leads/lead/${id}` : '/meus-leads';
    case 'leads.won':
      return '/minhas-comissoes';
    // Admin: lead que o captador ganhou/colocou em aguardo
    case 'leads.on_hold':
    case 'leads.reported_won':
      return id ? `/captacao/lead/${id}` : '/captacao?tab=tracking';
    case 'lead_request.finished':
    case 'lead_request.rejected':
      return '/captacao?tab=distribute';
    case 'activity.assigned':
      if (n.resource_type === 'deal' && id) return `/deals/${id}`;
      if (n.resource_type === 'contact' && id) return `/contacts/${id}`;
      return '/calendar';
    default:
      return null;
  }
}
