# TitanFlow — Milestone Plan

> Track build progress. Each milestone is a deployable, independently testable increment.

---

## M1 — Scaffolding & Auth Foundation
**Goal**: Empty repo → working login/logout with JWT, protected routes, tenant + user creation.

### Backend
- [x] Monorepo setup (npm workspaces, docker-compose.yml, .gitignore)
- [x] Express + TypeScript + Knex configured
- [x] Zod env validation
- [x] Migrations: `tenants`, `users`, `refresh_tokens`
- [x] `POST /auth/register` — creates tenant + admin user
- [x] `POST /auth/login` — returns accessToken + refreshToken
- [x] `POST /auth/refresh` — rotates refresh token
- [x] `POST /auth/logout` — revokes refresh token
- [x] `GET /auth/me` — current user
- [x] `PATCH /auth/me` — update own profile
- [x] `requireAuth` + `tenantScope` middleware
- [x] `GET|PATCH /tenant` — workspace settings
- [x] `GET /users`, `POST /users/invite`, `PATCH /users/:id`

### Frontend
- [x] Vite + React + TypeScript + Tailwind with full brand tokens
- [x] Axios instance with JWT interceptor + silent refresh on 401
- [x] Zustand `authStore`
- [x] `LoginPage` and `RegisterPage` (React Hook Form + Zod)
- [x] `AppShell` with `Sidebar` and `Topbar`
- [x] Protected route guard (redirect to `/login`)
- [x] Placeholder `DashboardPage`

**Test**: Create workspace → login → see shell → logout. Silent refresh on 401. ✅

---

## M2 — Contacts Module
**Goal**: Full CRUD contacts/leads with filtering, search, and CSV export.

### Backend
- [x] Migration: `contacts`
- [x] REST CRUD for `/contacts`
- [x] Filtering by type, owner, full-text search
- [x] Pagination (offset-based)
- [x] `requireRole` on delete (manager+)
- [x] `GET /contacts/export` — CSV

### Frontend
- [x] `ContactsPage` — table + search + filters
- [x] `ContactForm` modal — create/edit
- [x] `ContactDetailPage` — profile + deal placeholder
- [x] `useContacts` hook (TanStack Query)
- [x] Export button + CSV download

**Test**: Create/edit/search/filter/delete. Export CSV. Role-based delete restriction.

---

## M3 — Pipeline & Kanban Board
**Goal**: Full Kanban with drag-and-drop deal cards and stage management.

### Backend
- [x] Migrations: `pipelines`, `pipeline_stages`, `deals`
- [x] Pipelines + stages CRUD + `POST /stages/reorder`
- [x] Deals CRUD + `GET /deals/kanban` (grouped by stage)
- [x] `PATCH /deals/:id/stage` (move)
- [x] `PATCH /deals/:id/won` and `/lost`
- [x] `POST /deals/reorder` (position batch update)
- [x] Audit log on stage change

### Frontend
- [x] `KanbanBoard` → `KanbanColumn` → `KanbanCard` hierarchy
- [x] @dnd-kit drag-and-drop (cross-column + within-column)
- [x] Optimistic cache updates on drag
- [x] `DealForm` modal
- [x] Won/Lost quick actions on card hover
- [ ] `DealQuickEditPanel` slide-over (M4)
- [ ] `PipelineSettings` page (M5)

**Test**: Create pipeline → add stages → add deals → drag cards. Won/Lost. Stage reorder persists.

---

## M4 — Dashboard, Activities, Calendar
**Goal**: KPI dashboard, activity tracking, calendar scheduling.

### Backend
- [x] Migrations: `activities`, `calendar_events`, `calendar_event_attendees`
- [x] `/activities` CRUD + `PATCH /activities/:id/done`
- [x] `/calendar/events` CRUD + attendee management
- [x] `GET /reports/kpis` — total open, won MTD, conversion rate, avg cycle
- [x] `GET /reports/funnel` — deals by stage
- [x] `GET /reports/revenue` — grouped by week/month

### Frontend
- [x] `DashboardPage` — 4×KpiCard, FunnelChart, RevenueChart, ActivityFeed
- [x] `ContactDetailPage` — activity timeline
- [x] `DealDetailPage` — activity list + add activity
- [x] `CalendarPage` with FullCalendar (month/week/day)
- [x] `EventModal` — create/edit with deal/contact link + attendees

**Test**: Dashboard shows real numbers. Log activities. Calendar shows events. ✅

---

## M5 — Reports, Export, Team Management
**Goal**: Full reporting, data export, team administration + invite flow.

### Backend
- [x] `GET /reports/activities` — by type + by user
- [x] `GET /reports/leaderboard` — deals won + value per user
- [x] CSV export for deals (`GET /deals/export`, requires pro)
- [x] `POST /users/invite` — sends invitation email (Resend, fallback temp password)
- [x] `POST /contacts/import` — CSV bulk import (multer + csv-parse, requires pro)
- [x] `must_change_password` migration + auth flow (forced password change on first login)

### Frontend
- [x] `ReportsPage` — tabs: Overview / Activities / Leaderboard / Export
- [x] Export buttons (contacts + deals CSV download)
- [x] CSV import for contacts (file picker + progress feedback)
- [x] `SettingsPage` — user list, role change, invite form, deactivate
- [x] `ChangePasswordModal` — force password change on first login after invite

**Test**: Leaderboard accurate. CSV exports open in Excel. Invite email → new user logs in → forced password change modal.

---

## M6 — Integrations API & Webhooks
**Goal**: Developer-facing REST API and HMAC-signed webhook delivery.

### Backend
- [x] Migrations: `api_keys`, `integrations` (audit_logs already existed)
- [x] `/integrations` CRUD + HMAC-signed webhook delivery (`X-Titan-Signature`) + fire-and-forget
- [x] `POST /integrations/:id/test`
- [x] `/api-keys` CRUD (prefix+hash scheme, SHA-256)
- [x] Public API routes (`/public/contacts`, `/public/deals`) authenticated via `X-API-Key`
- [x] Scope enforcement (read/write)
- [x] Webhook auto-fire on contact.created/updated/deleted and deal.created/stage_changed/won/lost

### Frontend
- [x] `WebhooksSection` in SettingsPage — webhook form, event picker, test button, response status
- [x] `ApiKeysSection` in SettingsPage — key list with prefix, dates, last used
- [x] API key generator with show-once modal + copy button

**Test**: Webhook receives signed payload. API key reads contacts via curl. Revoked key → 401.

---

## M7 — Billing, Premium Tiers, Hardening
**Goal**: Stripe billing, feature gating by plan, production hardening.

### Backend
- [x] Migration: `subscriptions`
- [x] Stripe Checkout + Customer Portal + webhook handler
- [x] `requireTier` middleware on gated routes
- [x] Rate limiting by tier (free: 100/day, starter: 1000/day, pro: 10000/day)
- [ ] Audit logs fully populated

### Frontend
- [x] `BillingSection` in SettingsPage — plan display, upgrade CTA, portal link
- [x] `UpgradeModal` — plan comparison, triggered automatically on HTTP 402
- [x] Plan badge in Sidebar (`FREE`, `STARTER`, `PRO`)
- [ ] Lock icons + tooltips on gated items

**Test**: Free user blocked from CSV export with upgrade modal. Stripe Checkout upgrades plan. Webhook cancels subscription.

---

## M8 — Polish, Search, Notifications, Deployment
**Goal**: Production deployment, global search, notifications, final UX polish.

### Backend
- [x] `GET /search?q=` — unified full-text search across contacts/deals/activities
- [x] Notifications table + `GET /notifications` + `PATCH /notifications/:id/read` + `POST /notifications/read-all`
- [x] `GET /health` health check endpoint
- [x] Docker multi-stage build (`packages/backend/Dockerfile`, `packages/frontend/Dockerfile`)

### Frontend
- [x] Cmd+K search modal with keyboard navigation + grouped results
- [x] Notification bell — unread count badge + mark-all-read
- [x] Error boundaries on all pages (AppShell wraps Outlet)
- [x] Loading skeletons (TableSkeleton, KanbanSkeleton, CardSkeleton, Skeleton)
- [x] Empty states with context-aware CTAs on all list pages (EmptyState component)
- [x] Sonner toasts on all mutations
- [x] Mobile responsive layout (hamburger sidebar via AppShell, horizontal Kanban scroll)

### Infra
- [x] `docker-compose.prod.yml` production config (Postgres + backend + nginx)
- [x] GitHub Actions CI (lint + type-check on PR — `.github/workflows/ci.yml`)
- [x] GitHub Actions CD (Docker build + push on merge to main — `.github/workflows/cd.yml`)

**Test**: Global search accurate. Notifications appear on stage change. CI passes. `docker compose -f docker-compose.prod.yml up` starts full system. Mobile layout usable. ✅

---

## M9 — Stripe Live, Admin DB Access, Landing Page, UX Fixes

> Itens pós-lançamento: configuração de produção Stripe, acesso ao banco em produção, landing page de vendas e correções de UX identificadas no uso real.

---

### T1 — Stripe: variáveis de ambiente e fluxo de pagamento em produção

**Problema**: Os Price IDs do Stripe (`STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`) não estão configurados, portanto o botão de upgrade leva a erro. Além disso, falta clareza sobre como o webhook confirma o upgrade de plano.

**O que fazer**:

- [x] No dashboard Stripe (modo live), criar os produtos **Starter** e **Pro** com seus respectivos preços recorrentes e copiar os Price IDs
- [x] Adicionar ao `packages/backend/.env`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`
- [ ] No dashboard Stripe → Webhooks, apontar para `https://<seu-dominio>/api/v1/billing/webhook` e habilitar os eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` — **pendente: aguardando domínio de produção**
- [x] Corrigir erro `StripeInvalidRequestError: No valid payment method types` ao criar Checkout Session — `payment_method_types: ['card']` adicionado em `billing.service.ts`
- [ ] Testar webhook ponta a ponta: `stripe listen --forward-to localhost:3001/api/v1/billing/webhook` + `stripe trigger checkout.session.completed` retornando 200

**Arquivo-chave**: `packages/backend/src/modules/billing/billing.service.ts`

> ✅ `payment_method_types: ['card']` já adicionado em `billing.service.ts` — erro resolvido.

---

### T2 — Acesso ao banco de dados PostgreSQL em produção (Docker)

**Problema**: Em produção com Docker, o banco roda em container isolado. É necessário saber como conectar para operações manuais (conceder plano manualmente, debugar dados, etc.).

**Como acessar o banco em produção**:

#### Opção A — `docker exec` direto (sem expor porta)
```bash
# Listar containers rodando
docker compose -f docker-compose.prod.yml ps

# Abrir psql dentro do container do banco
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d titancrm
```

#### Opção B — Expor porta temporariamente (só quando necessário)
Adicionar ao serviço `db` no `docker-compose.prod.yml`:
```yaml
ports:
  - "5432:5432"   # remover após uso — nunca deixar exposto em produção
```
Depois conectar com qualquer client (DBeaver, TablePlus, psql local).

#### Conceder plano manualmente a um tenant
```sql
-- Ver tenants cadastrados
SELECT id, name, plan FROM tenants;

-- Promover tenant para 'pro' ou 'starter'
UPDATE tenants SET plan = 'pro' WHERE id = '<tenant-uuid>';

-- Ver subscriptions
SELECT * FROM subscriptions WHERE tenant_id = '<tenant-uuid>';

-- Inserir/atualizar subscription manualmente (se necessário)
INSERT INTO subscriptions (tenant_id, plan, status, current_period_end)
VALUES ('<tenant-uuid>', 'pro', 'active', NOW() + INTERVAL '1 year')
ON CONFLICT (tenant_id) DO UPDATE
  SET plan = 'pro', status = 'active', current_period_end = NOW() + INTERVAL '1 year';
```

**Rodar migrations em produção**:
```bash
docker compose -f docker-compose.prod.yml exec backend \
  npx knex --knexfile knexfile.ts migrate:latest
```

- [ ] Documentar esse fluxo no README do projeto
- [ ] Avaliar adicionar rota `POST /admin/grant-plan` protegida por segredo de admin para operações self-service sem psql

---

### T3 — Landing Page de apresentação e venda ✅

**Objetivo**: Página pública em `/` (ou domínio separado) que convença visitantes a criar conta. Deve comunicar o produto, mostrar os planos e ter CTAs claros para cadastro.

**Seções obrigatórias**:

- [x] **Hero** — headline forte + subheadline + CTA primário ("Começar grátis") + screenshot/mockup do produto
- [x] **Dor / Solução** — 3 bullets curtos: problema atual (WhatsApp, planilhas) → como o Titan Labs resolve
- [x] **Features** — 4–6 cards com ícone: Pipeline Kanban, Contatos, Relatórios, Automações/Webhooks, API, Multi-usuário
- [x] **Social proof** — depoimentos placeholder ou logos de clientes (pode ser fictício no MVP)
- [x] **Pricing** — tabela de planos FREE / STARTER / PRO com features por tier e botões de CTA
- [x] **FAQ** — 4–6 perguntas frequentes sobre planos, cancelamento, dados
- [x] **Footer** — links: Termos, Privacidade, Contato, redes sociais

**Decisões técnicas**:
- Criar como página React em `packages/frontend/src/pages/landing/LandingPage.tsx`
- Rota pública `/` no router (sem `ProtectedRoute`)
- Redirecionar `/` para `/dashboard` quando o usuário já estiver autenticado
- Usar o design system existente (tokens de cor, fontes) mas com layout de marketing (full-width, seções alternadas)
- O botão de plano pago na seção Pricing deve chamar `POST /billing/checkout` passando o plano selecionado — se não autenticado, redireciona para `/register?plan=pro`

**Arquivo-chave**: `packages/frontend/src/app/router.tsx` (adicionar rota `/`), `packages/frontend/src/pages/landing/LandingPage.tsx` (criar)

---

### T4 — Navbar: nome do workspace no lugar de "Titan Labs" ✅

**Problema**: O nome fixo "Titan Labs" aparece na sidebar. Deve ser substituído pelo nome da empresa que o admin cadastrou no momento do registro (campo `tenants.name`).

**O que fazer**:

- [x] No `Sidebar.tsx`, buscar o nome do tenant via `GET /api/v1/tenant` (já existe endpoint + hook `useBilling` retorna subscription, mas o tenant name vem de `PATCH /tenant`)
- [x] Criar (ou reutilizar) hook `useTenant()` que chama `GET /api/v1/tenant` e retorna `{ name, plan, ... }`
- [x] Substituir o texto `"Titan Labs"` no `Sidebar.tsx` pelo `tenant.name` (com fallback `"Titan Labs"` enquanto carrega)
- [x] Garantir que `RegisterPage` já salva o `companyName` como `tenants.name` — verificar `POST /auth/register`

**Arquivo-chave**: `packages/frontend/src/components/layout/Sidebar.tsx`

---

### T5 — Pipeline: editar nome das etapas (stages) ✅

**Problema**: Na modal de configurações do pipeline (`PipelineSettingsModal`), é possível excluir etapas mas não renomeá-las. O endpoint `PATCH /pipelines/:pipelineId/stages/:stageId` já existe no backend.

**O que fazer**:

- [x] Em `PipelineSettingsModal.tsx`, adicionar modo de edição inline nas etapas: clicar no nome da etapa transforma em `<input>`, confirmar com Enter ou botão ✓, cancelar com Escape
- [x] Chamar `PATCH /pipelines/:pipelineId/stages/:stageId` com `{ name }` ao confirmar
- [x] Usar `useUpdateStage` (hook já existe em `usePipeline.ts`) para a mutation
- [x] Adicionar toast de sucesso/erro (já no hook)

**Arquivo-chave**: `packages/frontend/src/components/pipeline/PipelineSettingsModal.tsx`

---

### T6 — Contatos: campo "Responsável" funcional com select de membros ✅

**Problema**: A tabela de contatos exibe a coluna "Responsável" e o filtro por owner existe no backend, mas o formulário de criação/edição de contato (`ContactForm.tsx`) não tem campo para selecionar o responsável — o `owner_id` nunca é preenchido.

**O que fazer**:

- [x] Em `ContactForm.tsx`, adicionar campo `<select>` (ou combobox) "Responsável" que lista os usuários ativos do tenant
- [x] Buscar usuários via `useUsers()` (hook já existe) e popular as opções com `{ value: user.id, label: user.full_name }`
- [x] Incluir `ownerId` no schema Zod do formulário e no `CreateContactInput`
- [x] Verificar que o backend já aceita `owner_id` no `POST /contacts` e `PATCH /contacts/:id` — se não, adicionar ao service/controller
- [x] Exibir avatar + nome do responsável na `ContactDetailPage` (já consome `owner_name` do backend)

**Arquivo-chave**: `packages/frontend/src/components/contacts/ContactForm.tsx`

---

## M10 — Conversão e Crescimento

> Melhorias identificadas após análise de pricing e produto. Foco em aumentar conversão Free → Pago.

---

### T1 — Limitar plano Free para forçar conversão

**Problema**: O Free entrega quase tudo (pipeline, relatórios, leaderboard, calendário, contatos ilimitados). O usuário não sente falta de nada — não tem motivo para pagar.

**O que fazer**:

- [x] Limitar contatos no Free a **300** — backend retorna 402 ao atingir limite; frontend exibe `UpgradeModal`
- [x] Mover **Relatórios** (ReportsPage — abas Activities, Leaderboard) para **Starter+** — Free vê cadeado e abre `UpgradeModal` ao clicar
- [x] Implementar contagem de contatos no backend: antes de inserir novo contato, verificar `COUNT` e retornar 402 se Free e >= 300
- [x] Exibir no Dashboard um indicador de uso com barra de progresso (verde/âmbar/vermelho) no plano Free

**Arquivos-chave**:
- `packages/backend/src/modules/contacts/contacts.service.ts` (adicionar check de limite)
- `packages/frontend/src/pages/reports/ReportsPage.tsx` (gate nas abas)
- `packages/frontend/src/pages/dashboard/DashboardPage.tsx` (indicador de uso)

---

### T2 — Landing page: reduzir atrito no CTA principal

**Problema**: O fluxo atual é landing → `/register` com 5 campos (workspace, slug, nome, e-mail, senha). Qualquer campo a mais reduz conversão.

**O que fazer**:

- [x] Simplificar `RegisterPage` para **4 campos**: nome da empresa, seu nome, e-mail, senha — slug gerado automaticamente sem expor ao usuário
- [x] Adicionar opção de **continuar com Google** (OAuth) — `passport-google-oauth20` no backend; `GET /auth/google` + `/auth/google/callback`; botão `GoogleButton` em Login e Register; página `/auth/callback` processa tokens
- [ ] **Configurar credenciais Google OAuth em produção** — adicionar `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env` do backend (as rotas só são montadas se essas variáveis existirem); criar projeto em [console.cloud.google.com](https://console.cloud.google.com), habilitar Google+ API, cadastrar `https://<domínio>/api/v1/auth/google/callback` como Redirect URI autorizado
- [x] Após cadastro, redirecionar para um **onboarding de 2 passos**: (1) nome do pipeline → cria pipeline + 4 etapas padrão; (2) convite opcional de membro — rota `/onboarding`

**Arquivos-chave**:
- `packages/frontend/src/pages/auth/RegisterPage.tsx`
- `packages/backend/src/modules/auth/auth.service.ts`

---

### T3 — Suporte via WhatsApp

**Problema**: Para SaaS B2B pequeno no Brasil, suporte por WhatsApp aumenta conversão e reduz churn — o cliente sente que tem alguém por trás do produto.

**O que fazer**:

- [x] Adicionar botão flutuante de WhatsApp na `LandingPage` e dentro do app (canto inferior direito) — número placeholder, substituir em produção
- [x] Criar template de mensagem dinâmica no AppShell — inclui nome da empresa do tenant (`useTenant()`) na mensagem pré-preenchida do WhatsApp
- [ ] Avaliar integração com **Z-API ou Evolution API** para automação de respostas comuns (boas-vindas, link de docs, status de pagamento)

**Arquivo-chave**: `packages/frontend/src/pages/landing/LandingPage.tsx`, `packages/frontend/src/components/layout/AppShell.tsx`

---

## M11 — Rebrand TitanFlow, Kanban Redesign, Deal Lifecycle ✅

> Polimento visual e funcional pós-lançamento: renomear o produto, redesenhar o kanban, corrigir drag & drop e completar o ciclo de vida dos negócios.

---

### T1 — Rebrand para TitanFlow ✅

- [x] Renomear produto de "Titan Labs CRM" para **TitanFlow** em todos os pontos de exibição: browser tab (`index.html`), LoginPage, RegisterPage, OnboardingPage, LandingPage (nav + footer), AppShell (mensagem WhatsApp)
- [x] Sidebar top-left exibe fixo "TitanFlow" (removido nome dinâmico do tenant)

---

### T2 — Redesign visual do Kanban ✅

- [x] **KanbanColumn**: header card com borda esquerda colorida na cor da etapa; nome da etapa em UPPERCASE + letter-spacing + cor da etapa; valor total abaixo; badge de contagem de deals
- [x] **KanbanCard**: fundo `bg-surface`; título branco bold; valor em verde grande; nome do contato abaixo; linha separadora + ícone owner (ou "Desconhecido") + data (vermelha se vencida); botões Ganho/Perdido apenas no hover
- [x] `onWon` / `onLost` passam `(id, title)` para exibir nome do negócio no toast

---

### T3 — Fix drag & drop entre colunas ✅

**Problema**: ao arrastar um card para outra coluna, ele voltava à coluna original após soltar.

**Causa**: `handleDragOver` movia o card otimisticamente em `localStages`; `handleDragEnd` buscava `activeDealStage` em `localStages` (já modificado) e encontrava o card na coluna destino, tratando como reordenação interna em vez de movimentação — o `invalidateQueries` revertia para o estado do servidor.

**Fix**: `dragOriginStageId` (useRef) captura o `stage_id` original no `handleDragStart`; `handleDragEnd` usa esse ref para determinar se é cross-column ou same-column, independentemente do estado atual de `localStages`.

---

### T4 — Scroll horizontal via roda do mouse ✅

- [x] `onWheel` no container do kanban converte `deltaY` em `scrollLeft` — navega entre colunas com a roda do mouse sem precisar da scrollbar horizontal

---

### T5 — Transições de status dos negócios ✅

- [x] Backend: `PATCH /deals/:id/open` — reabre negócio (status='open', limpa `closed_at` e `lost_reason`)
- [x] Frontend: `useMarkOpen()` hook; `useDeleteDeal()` invalida `['deals']` além de `pipelineKeys.all`
- [x] `DealDetailPage`: botões contextuais por status — open→(Ganho, Perdido), won→(Reabrir, Marcar como perdido), lost→(Reabrir, Marcar como ganho)
- [x] Botão "Perdido" usa variante `warning` (laranja); "Excluir" usa `danger` (vermelho) — diferenciação visual
- [x] Toast com botão "Desfazer" após marcar Ganho/Perdido no kanban — chama `markOpen`

---

### T6 — Exclusão completa de negócios ✅

- [x] Backend: `deleteDeal` roda em transação — deleta `deals` + limpa `audit_logs` (resource_type='deal', resource_id) + `notifications` (resource_id); `activities` cascateia pelo FK `onDelete('CASCADE')`
- [x] Frontend: modal de confirmação com aviso de irreversibilidade; após excluir redireciona para `/deals`
- [x] Seta de voltar no `DealDetailPage` usa `navigate(-1)` — volta para onde o usuário veio (pipeline ou lista de negócios)

---

## M13 — Multi-Workspace, UX Fixes e Atividades com Responsável

> Melhorias de produto identificadas no uso: suporte a múltiplos workspaces por usuário, correção de cor no gráfico funil, edição de responsável no negócio e campo de responsável em atividades com notificação.

### T1 — Workspace Switcher (multi-workspace por usuário) ✅

- [x] Migration `20240018_create_user_tenants`: tabela pivot `user_tenants` (user_id, tenant_id, role) + migração dos dados existentes
- [x] Backend: `GET /auth/workspaces` — lista workspaces do usuário autenticado
- [x] Backend: `POST /auth/switch-workspace` — emite novo access+refresh token com `tenantId` diferente, valida membership na pivot
- [x] `inviteUser` e `register` inserem registro em `user_tenants` automaticamente
- [x] Frontend: `WorkspaceSwitcher` component (Topbar, dropdown com nome/plano/role de cada workspace)
- [x] Troca de workspace limpa o cache do TanStack Query (`qc.clear()`) para recarregar dados do novo tenant

**Arquivo-chave**: `packages/backend/src/modules/auth/auth.service.ts`, `packages/frontend/src/components/layout/WorkspaceSwitcher.tsx`

---

### T2 — FunnelChart: cor do tooltip ✅

- [x] `itemStyle: { color: '#72d296' }` adicionado ao `<Tooltip>` — valor dos negócios agora exibe em verde em vez de preto ilegível

**Arquivo-chave**: `packages/frontend/src/components/dashboard/FunnelChart.tsx`

---

### T3 — DealDetailPage: responsável editável ✅

- [x] Campo "Responsável" no painel de detalhes do negócio com edição inline (lápis → select → confirmar/cancelar)
- [x] Usa `useUpdateDeal()` com `ownerId` via `PATCH /deals/:id` (backend já suportava)
- [x] `dealsService.update` e `useUpdateDeal` expandidos para aceitar `ownerId` e `contactId`

**Arquivo-chave**: `packages/frontend/src/pages/deals/DealDetailPage.tsx`

---

### T4 — Atividades: campo de responsável com notificação ✅

- [x] Migration `20240019_add_assignee_to_activities`: coluna `assignee_id` (FK → users, SET NULL)
- [x] Backend schema, service e controller atualizados: `assignee_id` persistido no create/update
- [x] Notificação disparada para o responsável ao criar/atualizar atividade com assignee diferente do criador
- [x] `ActivityForm`: campo "Responsável" (select de usuários ativos) com hint de notificação
- [x] `ActivityTimeline`: exibe "resp: NomeDoResponsável" em verde quando diferente do criador

**Arquivo-chave**: `packages/backend/src/modules/activities/activities.service.ts`, `packages/frontend/src/components/activities/ActivityForm.tsx`

---

## M12 — Bugfixes, Cache e Qualidade ✅

> Correções de bugs encontrados no uso real e ajustes de qualidade pós-deploy.

### T1 — Cache e reatividade entre rotas ✅
- [x] `queryClient`: `staleTime: 0` + `refetchOnWindowFocus: true` — dados sempre frescos ao navegar entre rotas (antes ficavam em cache por até 5 min)
- [x] `usePipeline`: helper `invalidateDeals()` invalida `['pipelines']` + `['deals']` + `['reports']` em todas as mutations de deal (move, markWon, markLost, markOpen, delete, create, update) — gráficos e dashboard atualizam imediatamente sem F5
- [x] Removidos `staleTime` individuais redundantes de `useReports`, `useDeals`, `useTenant`

### T2 — Gráfico de receita redesenhado ✅
- [x] `RevenueChart`: substituído `AreaChart` por `ComposedChart` (barras + linha de tendência tracejada)
- [x] YAxis visível com valores formatados em compact (R$120k)
- [x] Tooltip rico: valor completo + quantidade de negócios fechados no período
- [x] Barra do mês/semana de maior receita destacada em verde vivo; demais em verde escuro
- [x] Modo semanal usa label `dd/MM` em vez de número de semana

### T3 — Bugfixes backend ✅
- [x] `rateLimiter`: usar `ipKeyGenerator` do `express-rate-limit` — corrige `ERR_ERL_KEY_GEN_IPV6` (IPv6 bypass)
- [x] `reports.service`: fix SQL — `SUM(CASE WHEN a.is_done THEN 1 ELSE 0 END) as done` com alias fora da função (erro de sintaxe PostgreSQL `42601`)

### T4 — Remoção de scroll horizontal por roda do mouse no Pipeline ✅
- [x] `PipelinePage`: removido `onWheel` que convertia scroll vertical em horizontal — comportamento confuso

### T5 — Fix build Vercel (TypeScript errors) ✅
- [x] `DealForm`: removido `watch` não utilizado; parâmetro `c` no `.map()` tipado explicitamente
- [x] `Sidebar`: removida variável `tenant` declarada mas não utilizada

### T6 — Seed limpo ✅
- [x] `01_dev_seed.ts`: removidos todos os dados mockados; seed agora apenas limpa as tabelas na ordem correta (respeitando FK constraints)

---

## M14 — Deals em lista, Export de Atividades, Kanban Lazy Load

> Melhorias de usabilidade e performance identificadas após uso real: busca e paginação na lista de negócios, export CSV de atividades e carregamento sob demanda no Kanban.

---

### T1 — Deals: busca por texto + paginação real ✅

**Objetivo**: `DealsListPage` hoje carrega fixo 50 itens sem busca textual. Com volume real isso torna a lista inutilizável.

- [x] Backend: campo `q` adicionado ao `listDealsQuerySchema` (Zod) e ao `listDeals` service — ILIKE em `d.title` e `c.full_name`; COUNT corrigido para incluir o join com contacts ao filtrar por `q`
- [x] Frontend: campo de busca com ícone lupa na `DealsListPage`; paginação com Anterior/Próxima + indicador "Página X de Y — N negócios"; reset de página ao mudar qualquer filtro; `limit` fixo de 50 substituído por 20 com paginação real
- [x] `useDeals.ts`: campo `q` adicionado ao tipo `DealsFilters`; removido `[key: string]: unknown` (index signature desnecessário)

**Arquivos**: `deals.schema.ts`, `deals.service.ts`, `DealsListPage.tsx`, `useDeals.ts`

---

### T2 — Export de atividades CSV ✅

**Objetivo**: Relatórios exportam contatos e deals mas não atividades — dado valioso para gestores.

- [x] Backend: `GET /activities/export` — query com joins (contact, deal, assignee), gera CSV; `requireTier('starter')`
- [x] Frontend: botão "Exportar atividades" na aba Export da `ReportsPage`; Free vê cadeado → `UpgradeModal`
- [x] Bug corrigido: `reports.service.ts` usava `a.owner_id` → corrigido para `a.user_id` (erro 42703)
- [x] Delimiter `;` (pt-BR) e headers sem acentos

**Arquivos**: `activities.routes.ts`, `activities.service.ts`, `activities.controller.ts`, `ReportsPage.tsx`, `reports.service.ts`

---

### T3 — Kanban: lazy load por coluna ✅

**Objetivo**: `GET /deals/kanban` traz todos os deals de todas as colunas. Com 50+ deals por stage o kanban fica pesado.

- [x] Backend: `GET /deals/kanban` retorna apenas metadados dos stages (`dealCount`, `totalValue` via agregação SQL)
- [x] Backend: novo `GET /deals/kanban-stage/:stageId?page=` retorna deals paginados (20/pág) com `hasMore`, `total`, `page`
- [x] Frontend: `useInfiniteStageDeals(stageId)` hook com `useInfiniteQuery` por stage
- [x] Frontend: `KanbanColumn` busca seus próprios deals e exibe botão "Carregar mais" no rodapé
- [x] Frontend: `PipelinePage` usa `optimisticDealsMap` para drag & drop fluido sem depender de `localStages.deals`

**Arquivos**: `deals.routes.ts`, `deals.service.ts`, `deals.controller.ts`, `KanbanColumn.tsx`, `usePipeline.ts`, `PipelinePage.tsx`, `pipeline.service.ts`, `PipelineSettingsModal.tsx`

---

### T4 — Calendário: redesign completo com EventManager customizado ✅

**Objetivo**: Substituir FullCalendar (biblioteca pesada, CSS externo difícil de customizar) por solução 100% própria integrada ao design TitanFlow.

- [x] `EventManagerCalendar` (`src/components/calendar/EventManagerCalendar.tsx`) — componente principal sem dependências externas de calendário
- [x] 4 views: **Mês** (grid 7×6 com chips de evento), **Semana** (grid hora×dia), **Dia** (lista por hora), **Lista** (agrupada por data)
- [x] Toolbar integrado: navegação prev/next/hoje, switcher de view, busca em tempo real (título, descrição, contato, negócio), botão "Novo evento"
- [x] Painel lateral deslizante (320px) abre ao clicar em evento ou célula — criar/editar/excluir sem sair da página
- [x] Campo "Fim" removido do formulário; substituído por select de **Duração** (15min → 8h); `endAt` calculado automaticamente
- [x] `DateTimePicker` (`src/components/ui/DateTimePicker.tsx`) — picker customizado via `react-day-picker` + `createPortal`
  - Modal centralizado na viewport (fora de qualquer `overflow: hidden`), overlay com backdrop-blur
  - Calendário à esquerda + lista de horas (00:00–23:00, intervalo de 1h) à direita
  - Footer com preview em linguagem natural ("segunda, 20 de junho às 09:00") + botão Confirmar
  - Fecha com Escape ou clique fora; hora selecionada faz scroll automático ao abrir
- [x] `react-day-picker@^10` instalado; `FullCalendar` + plugins removidos do uso (pacotes podem ser desinstalados futuramente)
- [x] Design 100% TitanFlow: dark mode, `accent-green`, `bg-surface`, `bg-border` — zero shadcn/ui

**Arquivos**: `CalendarPage.tsx`, `EventManagerCalendar.tsx` (novo), `DateTimePicker.tsx` (novo), `package.json`

---

## M16 — Redesign da Landing Page (Conversão + GSAP)

> Refatoração completa da `LandingPage.tsx` com foco em conversão, design cinemático inspirado em Framer.com, animações GSAP ScrollTrigger e layout assimétrico. Contexto estratégico em `PRODUCT.md` (raiz do repo).

### Contexto de design (ver PRODUCT.md para detalhes completos)

- **Registro**: brand (a página de marketing É o produto neste contexto)
- **Público**: donos de PMEs, gerentes e vendedores no Brasil — chegam desconfiantes, saem de WhatsApp/planilha
- **Referência**: Framer.com — hero dramático, gradientes escuros, mockup animado, movimento expressivo
- **Anti-referências**: Pipedrive/HubSpot (azul corporativo estático), SaaS-genérico brasileiro (fundo branco + ícones Flaticon)
- **Personalidade da marca**: confiante, direto, moderno
- **Motion**: GSAP cinematic completo — ScrollTrigger por seção, timeline de entrada no hero, counters animados, stagger diagonal nas features
- **Cor**: estratégia "Committed" — fundo `oklch(0.10 0.01 160)`, acento `#72d296` (verde existente), bloom verde no hero
- **Tipografia**: Sora (display) + Geist (body) — importar via Google Fonts

### Diagnóstico da landing atual (o que está ruim)

- Hero centralizado com bullets genéricos, sem mockup do produto visível
- 6 cards de features idênticos (ícone + título + texto) — template puro
- Zero animação — página estática
- Depoimentos placeholders visíveis sem foto real
- Pricing sem ancoragem visual (PRO não se destaca)
- Nenhuma prova visual do produto (sem screenshot ou demo)

### Estrutura de seções (nova)

| # | Seção | Objetivo de conversão | Motion GSAP |
|---|---|---|---|
| 1 | **Hero** | Capturar + CTA primário | Timeline: logo → headline → sub → CTA → mockup (stagger) |
| 2 | **Social proof bar** | Credibilidade imediata | Counters animados (gsap.to com snap inteiro) |
| 3 | **Dor / Solução** | Identificação do problema | Pin + scroll horizontal "Antes → Depois" (ScrollTrigger scrub) |
| 4 | **Mockup em destaque** | Mostrar o produto | Parallax no screenshot do Kanban (ScrollTrigger) |
| 5 | **Features assimétricas** | Provar as capacidades | Stagger diagonal — 1 feature grande + 2 pequenas, alternando |
| 6 | **Pricing** | Decisão de compra | Border glow animado no card PRO ao entrar na viewport |
| 7 | **FAQ** | Eliminar objeções | Accordion com animação de altura suave (GSAP height tween) |
| 8 | **CTA final** | Conversão de saída | Full-bleed com gradiente animado + botão pulsante sutil |
| 9 | **Footer** | Links legais | Estático |

### Decisões visuais

```
Cores (OKLCH):
  fundo principal:  oklch(0.10 0.01 160)   — quase preto com tint verde
  superfícies:      oklch(0.14 0.008 160)  — cards e modais
  acento:           #72d296                — verde existente do design system
  bloom hero:       radial-gradient verde no canto superior direito

Tipografia:
  display: Sora 700/800 — clamp(48px, 6vw, 80px)
  body:    Geist 400/500 — 16px/1.6
  importar: @import via Google Fonts no index.css

Motion (GSAP):
  Hero timeline (gsap.timeline):
    t=0.0  logo       fadeUp  0.4s ease-out-quart
    t=0.2  headline   slideUp 0.6s ease-out-quart
    t=0.5  subheadline fade   0.4s
    t=0.7  CTA button scaleFrom(0.95) + fade 0.3s
    t=0.9  mockup     slideUp(40px) + fade 0.8s

  ScrollTrigger por seção:
    features:  stagger 0.15s, translateY(30px)→0
    dor/sol:   pin com scrub horizontal
    pricing:   border glow no card PRO
    counters:  gsap.to com snap inteiro
```

### Tasks de implementação

- [x] **T1** — Setup: `gsap@3.15` instalado + fontes Sora/Geist (index.html + Tailwind `font-display`/`font-body`) + hook `useGsapContext()` (scope + revert + reduced-motion)
- [x] **T2** — Hero cinemático: headline left-aligned (Sora), bloom verde, mockup do Kanban fiel ao app, timeline GSAP completa (set+to para evitar opacity:0 preso) + parallax
- [x] **T3** — Social proof bar: 4 counters animados (`StatCounter` com ScrollTrigger once + fallback se já visível)
- [x] **T4** — Seção Dor/Solução: 3 linhas antes→depois com reveal stagger; mobile empilha (✕ acima, ✓ abaixo)
- [x] **T5** — Features assimétricas: bento 1-grande (2col×2row, com mockup embutido) + 5 pequenas; stagger diagonal
- [x] **T6** — Pricing: card PRO com glow conic animado (`lp-pro-card`), badge "MAIS POPULAR", `-mt-4` ancoragem
- [x] **T7** — `prefers-reduced-motion`: `useGsapContext` seta tudo visível + counters resolvem instantâneo (verificado via Playwright: zero elementos presos em opacity 0)
- [x] **T8** — Mobile: headline `clamp(2.1rem…)`, `min-w-0` em colunas/cards (corrige overflow), mockup vira "peek" clipado, features em coluna única
- [x] **T9** — Audit fix visual (skills `redesign-existing-projects` + `design-taste-frontend`, dials `DESIGN_VARIANCE=5 MOTION_INTENSITY=3 VISUAL_DENSITY=6`): corrige fingerprint AI-slop identificado no audit — cards idênticos repetidos (pain/features/pricing), 6 eyebrows (1 por seção), stats fracos, PRO card sem diferenciação real, `py-24` mecânico. Ver `Key implementation notes` no CLAUDE.md para detalhe de cada fix.

### Arquivos-chave

- `packages/frontend/src/pages/landing/LandingPage.tsx` — arquivo principal (refatorar)
- `packages/frontend/src/index.css` — adicionar fontes + tokens de cor do hero
- `packages/frontend/package.json` — adicionar `gsap`
- `PRODUCT.md` — contexto estratégico de design (lido pela skill impeccable)

### Branches

- `feat/m16-landing-page-redesign` — redesign inicial (T1-T8)
- `fix/m16-landing-visual-audit` — audit fix (T9)
