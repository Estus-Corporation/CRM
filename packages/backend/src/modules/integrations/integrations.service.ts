import crypto from 'crypto';
import { db } from '../../db';
import { z } from 'zod';

export const SUPPORTED_EVENTS = [
  'contact.created',
  'contact.updated',
  'contact.deleted',
  'deal.created',
  'deal.updated',
  'deal.stage_changed',
  'deal.won',
  'deal.lost',
  'deal.reopened',
] as const;

export type WebhookEvent = (typeof SUPPORTED_EVENTS)[number];

export const integrationSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  secret: z.string().min(8).max(255),
  events: z.array(z.enum(SUPPORTED_EVENTS)).min(1),
});

export const updateIntegrationSchema = integrationSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export async function listIntegrations(tenantId: string) {
  return db('integrations')
    .where({ tenant_id: tenantId })
    .select(
      'id', 'name', 'url', 'events', 'is_active',
      'last_triggered_at', 'last_response_status', 'created_at',
    )
    .orderBy('created_at', 'desc');
}

export async function createIntegration(tenantId: string, input: z.infer<typeof integrationSchema>) {
  const [row] = await db('integrations')
    .insert({
      tenant_id: tenantId,
      name: input.name,
      url: input.url,
      secret: input.secret,
      events: input.events,
    })
    .returning('*');
  return row;
}

export async function updateIntegration(
  tenantId: string,
  id: string,
  input: z.infer<typeof updateIntegrationSchema>,
) {
  const update: Record<string, unknown> = { updated_at: new Date() };
  if (input.name !== undefined) update.name = input.name;
  if (input.url !== undefined) update.url = input.url;
  if (input.secret !== undefined) update.secret = input.secret;
  if (input.events !== undefined) update.events = input.events;
  if (input.isActive !== undefined) update.is_active = input.isActive;

  const [row] = await db('integrations')
    .where({ id, tenant_id: tenantId })
    .update(update)
    .returning('*');

  if (!row) throw Object.assign(new Error('Integration not found'), { status: 404 });
  return row;
}

export async function deleteIntegration(tenantId: string, id: string) {
  const count = await db('integrations').where({ id, tenant_id: tenantId }).delete();
  if (count === 0) throw Object.assign(new Error('Integration not found'), { status: 404 });
}

function buildSignature(secret: string, body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function deliverWebhook(
  integration: { id: string; url: string; secret: string },
  event: string,
  payload: unknown,
): Promise<void> {
  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  const signature = buildSignature(integration.secret, body);

  let status = 0;
  let responseBody = '';

  try {
    const res = await fetch(integration.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Titan-Signature': signature,
        'X-Titan-Event': event,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });
    status = res.status;
    responseBody = await res.text().catch(() => '');
  } catch (err) {
    status = 0;
    responseBody = err instanceof Error ? err.message : 'Unknown error';
  }

  await db('integrations').where({ id: integration.id }).update({
    last_triggered_at: new Date(),
    last_response_status: status,
    last_response_body: responseBody.slice(0, 2000),
    updated_at: new Date(),
  });
}

export async function fireWebhook(tenantId: string, event: WebhookEvent, payload: unknown) {
  const integrations = await db('integrations')
    .where({ tenant_id: tenantId, is_active: true })
    .whereRaw('? = ANY(events)', [event])
    .select('id', 'url', 'secret');

  for (const integration of integrations) {
    deliverWebhook(integration, event, payload).catch(() => {});
  }
}

export async function testIntegration(tenantId: string, id: string) {
  const integration = await db('integrations')
    .where({ id, tenant_id: tenantId })
    .first('id', 'url', 'secret');

  if (!integration) throw Object.assign(new Error('Integration not found'), { status: 404 });

  await deliverWebhook(integration, 'webhook.test', { message: 'Test payload from Titan Labs CRM' });

  const updated = await db('integrations')
    .where({ id })
    .first('last_response_status', 'last_response_body', 'last_triggered_at');

  return updated;
}
