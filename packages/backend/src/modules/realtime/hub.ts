import type { Response } from 'express';
import { db } from '../../db';

/**
 * Avisos em tempo real (SSE): quando algo muda para uma pessoa que já está conectada
 * (convite recebido, papel alterado, notificação nova...), o servidor avisa pelo canal aberto
 * e a tela busca de novo só o que mudou, sem F5 e sem esperar o polling.
 *
 * Em memória: supõe 1 instância do backend (mesma suposição do worker do LeadHunter).
 * O aviso é só um "algo mudou" (sem dados): quem recebe busca pela API normal, com as permissões de sempre.
 */
export type RealtimeEvent =
  | 'notifications' // notificação nova
  | 'invites' // convite recebido/cancelado/respondido
  | 'workspaces' // a lista de workspaces da pessoa mudou
  | 'team' // equipe do workspace mudou (membros, convites pendentes)
  | 'session'; // papel/acesso da pessoa mudou: renovar a sessão

const MAX_CONNECTIONS_PER_USER = 8;
const connections = new Map<string, Set<Response>>();

export function subscribe(userId: string, res: Response) {
  let set = connections.get(userId);
  if (!set) connections.set(userId, (set = new Set()));
  // Abas esquecidas não acumulam: passou do limite, fecha a mais antiga
  if (set.size >= MAX_CONNECTIONS_PER_USER) {
    const oldest = set.values().next().value as Response;
    set.delete(oldest);
    oldest.end();
  }
  set.add(res);
  return () => {
    set!.delete(res);
    if (set!.size === 0) connections.delete(userId);
  };
}

export function publishToUser(userId: string | null | undefined, event: RealtimeEvent) {
  if (!userId) return;
  for (const res of connections.get(userId) ?? []) res.write(`event: ${event}\ndata: {}\n\n`);
}

/** Admins e gerentes ativos do workspace (quem enxerga a equipe e os convites) */
export async function publishToTenantManagers(tenantId: string, event: RealtimeEvent) {
  try {
    const rows = await db('user_tenants')
      .where({ tenant_id: tenantId, is_active: true })
      .whereIn('role', ['admin', 'manager'])
      .select('user_id');
    for (const r of rows) publishToUser(r.user_id, event);
  } catch {
    // aviso em tempo real nunca derruba a operação que o disparou
  }
}

export function heartbeat() {
  for (const set of connections.values()) for (const res of set) res.write(': ping\n\n');
}
