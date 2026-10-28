import './config/env';
import express from 'express';
import { corsMiddleware } from './config/cors';
import { errorHandler } from './shared/middleware/errorHandler';
import { env } from './config/env';
import { db } from './db';

import authRoutes from './modules/auth/auth.routes';
import googleRoutes from './modules/auth/google.routes';
import tenantRoutes from './modules/tenants/tenants.routes';
import userRoutes from './modules/users/users.routes';
import inviteRoutes from './modules/invites/invites.routes';
import leadRequestRoutes from './modules/lead-requests/lead-requests.routes';
import contactRoutes from './modules/contacts/contacts.routes';
import pipelineRoutes from './modules/pipeline/pipeline.routes';
import dealRoutes from './modules/deals/deals.routes';
import activityRoutes from './modules/activities/activities.routes';
import calendarRoutes from './modules/calendar/calendar.routes';
import reportRoutes from './modules/reports/reports.routes';
import billingRoutes from './modules/billing/billing.routes';
import apiKeyRoutes from './modules/api-keys/api-keys.routes';
import integrationRoutes from './modules/integrations/integrations.routes';
import publicRoutes from './modules/public/public.routes';
import searchRoutes from './modules/search/search.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import contractRoutes from './modules/contracts/contracts.routes';
import captacaoRoutes from './modules/captacao/captacao.routes';
import notesRoutes from './modules/notes/notes.routes';
import leadhunterRoutes from './modules/leadhunter/leadhunter.routes';
import { startWorker } from './modules/leadhunter/engine';
import { tierRateLimiter } from './shared/middleware/rateLimiter';

const app = express();

app.use(corsMiddleware);
// Webhook route needs raw body — must be registered before express.json()
app.use('/api/v1/billing/webhook', express.raw({ type: 'application/json' }));
// 1 MB: logo da empresa (data URL) e lotes de importação de leads passam do padrão de 100 KB
app.use(express.json({ limit: '1mb' }));
app.use('/api/v1', tierRateLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auth', googleRoutes);
app.use('/api/v1/tenant', tenantRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/invites', inviteRoutes);
app.use('/api/v1/lead-requests', leadRequestRoutes);
app.use('/api/v1/contacts', contactRoutes);
app.use('/api/v1/pipelines', pipelineRoutes);
app.use('/api/v1/deals', dealRoutes);
app.use('/api/v1/activities', activityRoutes);
app.use('/api/v1/calendar/events', calendarRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/api-keys', apiKeyRoutes);
app.use('/api/v1/integrations', integrationRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/contacts/:contactId/contracts', contractRoutes);
app.use('/api/v1/captacao', captacaoRoutes);
app.use('/api/v1/notes', notesRoutes);
app.use('/api/v1/leadhunter', leadhunterRoutes);

app.use(errorHandler);

db.migrate.latest().then(() => {
  console.log('[db] Migrations up to date');
  // Worker do LeadHunter no próprio processo (supõe uma instância no Railway); nos testes não sobe
  if (env.NODE_ENV !== 'test') startWorker();
  app.listen(env.PORT, () => {
    console.log(`[server] Running on http://localhost:${env.PORT}`);
  });
}).catch((err) => {
  console.error('[db] Migration failed:', err);
  process.exit(1);
});

export default app;
