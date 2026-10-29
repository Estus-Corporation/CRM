import { db } from '../../db';
import { createNotification } from '../notifications/notifications.service';
import { sendCompaniesToContacts, splitSendable } from './contacts';
import * as store from './store';

// Entrega automática dos pedidos de leads: quando a campanha de um pedido termina, as empresas viram
// contatos do CRM (dono = quem pediu) e o pedido fecha, tudo numa transação. Nunca faz chamada paga.
// Registrada em server.ts como `onCampaignFinished.handler`.

type FinalStatus = 'done' | 'partial' | 'failed';

const FINISHED_TITLES: Record<FinalStatus, string> = {
  done: 'Seu pedido de leads foi atendido',
  partial: 'Seu pedido de leads foi atendido em parte',
  failed: 'Não foi possível atender seu pedido de leads',
};
const FINISHED_STATES: readonly store.CampaignState[] = ['completed', 'partial', 'failed', 'cancelled', 'interrupted'];
const DELIVERY_FAILED = 'Falha interna ao entregar os leads.';

/** Mapeamento do estado da campanha para o do pedido (D10, spec 7.4). */
function statusFor(state: store.CampaignState, hasSendable: boolean): FinalStatus {
  if (state === 'completed') return 'done';
  if (state === 'partial') return 'partial';
  if (state === 'failed') return 'failed';
  return hasSendable ? 'partial' : 'failed'; // cancelled e interrupted
}

interface Requester {
  id: string;
  niche: string;
  city: string;
  requestedBy: string | null;
}

/** Depois do commit e sem derrubar a entrega: só registra a falha do aviso. */
function notifyRequester(tenantId: string, request: Requester, status: FinalStatus, body: string): Promise<void> {
  if (!request.requestedBy) return Promise.resolve();
  return createNotification({
    tenantId,
    userId: request.requestedBy,
    type: 'lead_request.finished',
    title: FINISHED_TITLES[status],
    body: `${request.niche} · ${request.city} — ${body}`,
    resourceType: 'lead_request',
    resourceId: request.id,
  }).then(
    () => undefined,
    (error) => console.error('[leadhunter] falha ao notificar pedido de leads', error),
  );
}

async function deliver(tenantId: string, campaign: store.Campaign, requestId: string) {
  return db.transaction(async (trx) => {
    const { pending, skipped } = splitSendable(await store.companies(tenantId, campaign.id, trx));
    // `skipped` = já enviadas ao CRM por campanha anterior: contam como empresas do pedido
    const status = statusFor(campaign.state, pending.length + skipped > 0);

    // Portão atômico: só uma entrega passa; as concorrentes esperam o commit e veem o pedido já fechado.
    // Só a campanha do pedido o fecha (uma campanha órfã com o mesmo leadRequestId não passa).
    const [row] = await trx('lead_requests')
      .where({ id: requestId, tenant_id: tenantId, campaign_id: campaign.id, status: 'running' })
      .update({ status, updated_at: new Date() })
      .returning(['id', 'niche', 'city', 'requested_by']);
    if (!row) return null;
    const request: Requester = { id: row.id, niche: row.niche, city: row.city, requestedBy: row.requested_by };

    // Quem pediu ainda é membro ativo? Senão os leads entram sem dono e sem notificação
    const member = request.requestedBy
      ? await trx('user_tenants').where({ tenant_id: tenantId, user_id: request.requestedBy, is_active: true }).first('role')
      : null;
    const items = pending.length
      ? (
          await sendCompaniesToContacts(tenantId, undefined, {
            campaignId: campaign.id,
            ownerId: member ? request.requestedBy : null,
            leadRequestId: requestId,
            trx,
          })
        ).items
      : [];

    const imported = items.filter((item) => item.status === 'imported');
    const existing = items.filter((item) => item.status === 'duplicate').length + skipped;
    const failed = items.filter((item) => item.status === 'error').length;
    const finalStatus: FinalStatus = status === 'done' && failed ? 'partial' : status;
    const notes = [
      existing ? `${existing} já existiam no CRM` : '',
      failed ? `${failed} não puderam ser criadas no CRM` : '',
    ].filter(Boolean);
    await trx('lead_requests')
      .where({ id: requestId, tenant_id: tenantId })
      .update({
        status: finalStatus,
        message: [campaign.message, ...notes].filter(Boolean).join(' · ') || null,
        delivered_count: imported.length,
        finished_at: new Date(),
        updated_at: new Date(),
      });

    // Captador: os leads novos entram em "Meus leads" (e não sobram para a distribuição automática)
    if (member?.role === 'captador') {
      const assignments = imported
        .filter((item) => item.contactId)
        .map((item) => ({ tenant_id: tenantId, contact_id: item.contactId, captador_id: request.requestedBy }));
      if (assignments.length) {
        await trx('lead_assignments').insert(assignments).onConflict(['tenant_id', 'contact_id']).ignore();
      }
    }

    const summary = `${imported.length} empresa(s) nova(s)${notes.length ? ` · ${notes.join(' · ')}` : ''}`;
    return { request, finalStatus, notify: member ? summary : null };
  });
}

/** A entrega desfeita não pode deixar o pedido preso em `running`: fecha como `failed` com o motivo. */
async function failRequest(tenantId: string, requestId: string, campaignId: string, error: unknown): Promise<void> {
  console.error('[leadhunter] entrega do pedido falhou', requestId, error);
  const status = (error as { status?: number } | null)?.status;
  const reason = error instanceof Error && status !== undefined && status < 500 ? error.message : DELIVERY_FAILED;
  const [row] = await db('lead_requests')
    .where({ id: requestId, tenant_id: tenantId, campaign_id: campaignId, status: 'running' })
    .update({ status: 'failed', message: `Não foi possível entregar os leads: ${reason}`, finished_at: new Date(), updated_at: new Date() })
    .returning(['id', 'niche', 'city', 'requested_by']);
  if (!row?.requested_by) return;
  const member = await db('user_tenants').where({ tenant_id: tenantId, user_id: row.requested_by, is_active: true }).first('user_id');
  if (member) {
    await notifyRequester(tenantId, { id: row.id, niche: row.niche, city: row.city, requestedBy: row.requested_by }, 'failed', reason);
  }
}

/**
 * Fecha o pedido ligado à campanha que terminou (no-op se a campanha não é de um pedido em andamento).
 * Idempotente: o portão `running → final` deixa uma única entrega acontecer.
 */
export async function deliverForCampaign(tenantId: string, campaignId: string): Promise<void> {
  const campaign = await store.getCampaign(tenantId, campaignId);
  const requestId = campaign?.config.leadRequestId;
  if (!campaign || !requestId || !FINISHED_STATES.includes(campaign.state)) return;

  let delivered: Awaited<ReturnType<typeof deliver>>;
  try {
    delivered = await deliver(tenantId, campaign, requestId);
  } catch (error) {
    await failRequest(tenantId, requestId, campaign.id, error);
    return;
  }
  if (delivered?.notify) await notifyRequester(tenantId, delivered.request, delivered.finalStatus, delivered.notify);
}

/**
 * No boot e a cada minuto: fecha os pedidos ainda `running` cuja campanha já está em estado final. Cobre o
 * processo que morreu entre o estado final da campanha e a entrega (o hook não roda de novo), as campanhas
 * que o `recover()` marcou como `interrupted` (sem hook) e a campanha que termina antes de o pedido que a
 * criou ser gravado (a campanha é criada em outra conexão). A entrega é idempotente: o portão deixa uma só
 * passar. Uma campanha com falha não impede as demais.
 */
export async function deliverFinishedCampaigns(): Promise<void> {
  const rows = await db('lead_requests as lr')
    .join('lh_campaigns as c', function join() {
      this.on('c.id', 'lr.campaign_id').andOn('c.tenant_id', 'lr.tenant_id');
    })
    .where('lr.status', 'running')
    .whereIn('c.state', FINISHED_STATES as store.CampaignState[])
    .select('lr.tenant_id', 'lr.campaign_id');
  for (const row of rows) {
    try {
      await deliverForCampaign(row.tenant_id, row.campaign_id);
    } catch (err) {
      console.error('[leadhunter] entrega do pedido falhou', row.campaign_id, err);
    }
  }
}
