# Titan Labs CRM

> CRM SaaS multi-tenant para gestão de leads, contatos, negócios e pipelines de vendas.

Titan Labs CRM substitui ferramentas dispersas (WhatsApp, planilhas) por uma plataforma centralizada com foco em Kanban. Cada empresa que se cadastra recebe um workspace isolado com controle total de equipe, pipeline, relatórios e billing.

---

## Índice

- [Visão Geral](#visão-geral)
- [Stack Tecnológico](#stack-tecnológico)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Funcionalidades](#funcionalidades)
- [Pré-requisitos](#pré-requisitos)
- [Instalação e Desenvolvimento Local](#instalação-e-desenvolvimento-local)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Banco de Dados](#banco-de-dados)
- [API Reference](#api-reference)
- [Sistema de Planos e Permissões](#sistema-de-planos-e-permissões)
- [Deploy (Railway + Vercel)](#deploy-railway--vercel)
- [CI/CD](#cicd)
- [Design System](#design-system)
- [Arquitetura Multi-tenant](#arquitetura-multi-tenant)
- [Autenticação](#autenticação)

---

## Visão Geral

**Personas principais:**
- **Seller** — gerencia leads e negócios
- **Manager** — analytics + configuração da equipe
- **Admin** — billing + ownership do workspace

**Planos disponíveis:** `free → starter → pro → enterprise`

---

## Stack Tecnológico

### Backend

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Node.js 20+ |
| Framework | Express 4 + TypeScript |
| Banco de dados | PostgreSQL 16 |
| Query builder / Migrations | Knex.js |
| Autenticação | jose (JWT) + bcryptjs |
| Validação | Zod |
| Pagamentos | Stripe Node SDK |
| Email | Resend API |
| OAuth | passport-google-oauth20 |
| Upload de arquivos | Multer |
| CSV | csv-parse + csv-stringify |
| Rate limiting | express-rate-limit |

### Frontend

| Camada | Tecnologia |
|--------|-----------|
| Build | Vite |
| Framework | React 18 + TypeScript |
| Estado servidor | TanStack Query v5 |
| Estado global | Zustand |
| Formulários | React Hook Form + Zod |
| Estilização | Tailwind CSS v3 + CVA |
| UI primitivos | Radix UI |
| Gráficos | Recharts |
| Drag and Drop | @dnd-kit/core + @dnd-kit/sortable |
| Calendário | FullCalendar (React adapter) |
| Ícones | Lucide React |
| HTTP client | Axios (com interceptors) |
| Toasts | Sonner |
| Datas | date-fns |
| Roteamento | react-router-dom v6 |

---

## Estrutura do Projeto

```
CRMTitanLabs/
├── packages/
│   ├── backend/                        # Express + TypeScript + Knex + PostgreSQL
│   │   ├── src/
│   │   │   ├── server.ts               # Entry point, middleware, rotas
│   │   │   ├── config/
│   │   │   │   └── env.ts              # Validação de variáveis de ambiente (Zod)
│   │   │   ├── db/
│   │   │   │   ├── migrations/         # 15 migrations Knex
│   │   │   │   └── seeds/              # Seeds de desenvolvimento
│   │   │   ├── modules/                # 16 módulos de feature
│   │   │   │   ├── auth/
│   │   │   │   ├── billing/
│   │   │   │   ├── contacts/
│   │   │   │   ├── deals/
│   │   │   │   ├── pipelines/
│   │   │   │   ├── activities/
│   │   │   │   ├── calendar/
│   │   │   │   ├── reports/
│   │   │   │   ├── users/
│   │   │   │   ├── tenants/
│   │   │   │   ├── api-keys/
│   │   │   │   ├── integrations/
│   │   │   │   ├── notifications/
│   │   │   │   ├── search/
│   │   │   │   └── public/
│   │   │   └── shared/                 # Middleware, tipos, utilitários
│   │   ├── knexfile.ts
│   │   ├── Dockerfile              # usado pelo Railway (railway.json)
│   │   └── .env
│   └── frontend/                       # React + Vite + TypeScript + Tailwind CSS
│       ├── src/
│       │   ├── main.tsx                # Entry point React
│       │   ├── app/
│       │   │   ├── App.tsx             # Root component + providers
│       │   │   └── router.tsx          # Configuração de rotas
│       │   ├── components/             # Componentes organizados por feature
│       │   │   ├── ui/                 # Componentes puros (Button, Input, Dialog...)
│       │   │   ├── layout/             # AppShell, Sidebar, Topbar
│       │   │   ├── kanban/             # KanbanBoard, KanbanColumn, KanbanCard
│       │   │   ├── contacts/
│       │   │   ├── dashboard/
│       │   │   ├── auth/
│       │   │   └── ...
│       │   ├── pages/                  # Páginas com lógica de negócio
│       │   │   ├── auth/               # LoginPage, RegisterPage, AuthCallbackPage
│       │   │   ├── dashboard/
│       │   │   ├── contacts/
│       │   │   ├── deals/
│       │   │   ├── calendar/
│       │   │   ├── reports/
│       │   │   ├── settings/
│       │   │   └── landing/            # LandingPage pública
│       │   ├── hooks/                  # TanStack Query hooks
│       │   ├── store/                  # Zustand stores
│       │   └── services/
│       │       └── api.ts              # Instância Axios centralizada
│       └── .env
├── .github/
│   └── workflows/
│       └── ci.yml                      # Type-check em PRs e na main
├── CLAUDE.md                           # Instruções para o assistente de IA
├── plan.md                             # Roadmap de milestones
└── package.json                        # npm workspaces root
```

---

## Funcionalidades

### Core CRM
- **Contatos** — CRUD completo com campos customizados, campo "Responsável" (assign a membro da equipe), importação/exportação CSV (plano pro)
- **Pipeline Kanban** — arrastar e soltar negócios entre etapas, renomear etapas inline, múltiplos pipelines
- **Negócios** — gestão completa com histórico de mudanças, marcar como ganho/perdido, exportação CSV
- **Atividades** — notas, chamadas, emails, reuniões, tarefas com timeline
- **Calendário** — agendamento com suporte a attendees

### Analytics e Relatórios
- **Dashboard** — KPIs, gráfico de receita, funil de conversão, feed de atividades
- **Relatórios** — KPIs, funil, receita por período, atividades por tipo, leaderboard de vendedores (starter+)
- **Indicador de uso** — barra de progresso de contatos no dashboard (plano free)

### Colaboração
- **Notificações** — disparo automático em deal.won, deal.lost, deal.stage_changed (exceto o ator)
- **Gestão de equipe** — convite por email, controle de roles, campo de responsável em contatos

### Plataforma e Integrações
- **Webhooks** — assinados com HMAC (X-Titan-Signature), disparo em eventos de contato e negócio
- **API pública** — autenticação por API key (X-API-Key: tlk_...), endpoints de leitura e criação
- **API keys** — prefix `tlk_`, hash SHA-256, controle de escopo (read/write), admin only
- **OAuth Google** — login e cadastro via Google, criação automática de tenant para novos usuários
- **Onboarding** — 2 passos: criar pipeline padrão + convidar equipe

### Billing
- **Stripe** — checkout session, portal de billing, webhook para sincronização de plano
- **Feature gating** — middleware `requireTier()` retorna 402 com prompt de upgrade
- **Rate limiting** — 100/1.000/10.000 req/dia por plano (free/starter/pro)

### UX
- **Busca global** — Cmd+K abre SearchModal, ILIKE em contatos, negócios e atividades
- **Mobile** — hamburger menu, sidebar overlay em telas `< md`
- **Skeletons** — TableSkeleton, KanbanSkeleton, CardSkeleton durante carregamento
- **Empty states** — EmptyState component em listagens
- **Error boundary** — captura crashes em páginas, exibe fallback
- **WhatsApp** — botão flutuante na LandingPage e no AppShell

---

## Pré-requisitos

- **Node.js** 20+
- **npm** 9+ (workspaces)
- **PostgreSQL** local só para desenvolvimento e testes (no Windows: PostgreSQL 18 nativo, serviço `postgresql-x64-18`). Produção usa o Postgres do Railway.

---

## Instalação e Desenvolvimento Local

### 1. Clonar o repositório

```bash
git clone <url-do-repositório>
cd CRMTitanLabs
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Banco de dados local

Sem Docker. Iniciar o PostgreSQL nativo e criar o banco (PowerShell como administrador para o `Start-Service`):

```powershell
Start-Service postgresql-x64-18
& 'C:\Program Files\PostgreSQL\18\bin\createdb.exe' -U postgres titancrm
```

### 4. Configurar variáveis de ambiente

Crie o arquivo `packages/backend/.env`:


```env
DATABASE_URL=postgresql://postgres:<senha-local>@localhost:5432/titancrm
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

Crie o arquivo `packages/frontend/.env`:

```env
VITE_API_URL=http://localhost:3001/api/v1
```

### 5. Executar migrations

```bash
npm run migrate:latest --workspace=packages/backend
```

### 6. Executar seeds (opcional)

```bash
npm run seed --workspace=packages/backend
```

### 7. Iniciar os servidores de desenvolvimento

Em terminais separados:

```bash
# Backend — porta 3001
npm run dev:backend

# Frontend — porta 5173
npm run dev:frontend
```

Ou diretamente dentro de cada pacote:

```bash
cd packages/backend && npm run dev
cd packages/frontend && npm run dev
```

---

## Variáveis de Ambiente

### Backend (`packages/backend/.env`)

| Variável | Obrigatória | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `DATABASE_URL` | Sim | — | String de conexão PostgreSQL |
| `JWT_SECRET` | Sim | — | Segredo para assinar access tokens (mín. 32 chars) |
| `JWT_REFRESH_SECRET` | Sim | — | Segredo para assinar refresh tokens (mín. 32 chars) |
| `PORT` | Não | `3001` | Porta do servidor backend |
| `NODE_ENV` | Não | `development` | `development` \| `production` \| `test` |
| `FRONTEND_URL` | Não | `http://localhost:5173` | Origem CORS do frontend |
| `STRIPE_SECRET_KEY` | Não | — | Chave secreta do Stripe |
| `STRIPE_WEBHOOK_SECRET` | Não | — | Segredo para validar webhooks do Stripe |
| `STRIPE_PRICE_STARTER` | Não | — | Price ID do plano Starter no Stripe |
| `STRIPE_PRICE_PRO` | Não | — | Price ID do plano Pro no Stripe |
| `RESEND_API_KEY` | Não | — | Chave de API do Resend (email) |
| `GOOGLE_CLIENT_ID` | Não | — | Client ID do Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Não | — | Client Secret do Google OAuth |

> **Nota:** As rotas de OAuth Google (`/auth/google`, `/auth/google/callback`) só são montadas se `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` estiverem definidos.

### Frontend (`packages/frontend/.env`)

| Variável | Obrigatória | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `VITE_API_URL` | Não | `http://localhost:3001/api/v1` | URL base da API backend |

---

## Banco de Dados

### Migrations

Todas as migrations ficam em `packages/backend/src/db/migrations/`. Toda migration tem funções `up` e `down`.

**Nunca modifique migrations existentes — crie sempre uma nova.**

| Migration | Tabela(s) | Descrição |
|-----------|-----------|-----------|
| 20240001 | `tenants` | Workspaces com plano (free/starter/pro/enterprise) |
| 20240002 | `users` | Membros com roles (admin/manager/seller) |
| 20240003 | `refresh_tokens` | Rotação de tokens (TTL 7 dias, hash SHA-256) |
| 20240004 | `contacts` | Leads/contatos com campos customizados |
| 20240005 | `pipelines`, `pipeline_stages` | Pipelines de venda + etapas com posição |
| 20240006 | `deals`, `audit_logs` | Negócios (won/lost/open) + trilha de auditoria |
| 20240007 | `activities` | Notas, chamadas, emails, reuniões, tarefas |
| 20240008 | `calendar_events`, `calendar_event_attendees` | Agendamentos com participantes |
| 20240009 | `audit_logs` | Recriação idempotente dos audit logs |
| 20240011 | `subscriptions` | Tracking de assinaturas Stripe |
| 20240012 | `api_keys` | API keys de desenvolvedor (prefix + hash) |
| 20240013 | `integrations` | Webhooks com assinatura HMAC |
| 20240014 | `notifications` | Notificações em tempo real (lida/não lida) |
| 20240015 | `users` | `password_hash` nullable (suporte a OAuth) |

### Comandos de migrations

```bash
# Rodar migrations pendentes
npm run migrate:latest --workspace=packages/backend

# Reverter último batch
npm run migrate:rollback --workspace=packages/backend

# Criar nova migration
npm run migrate:make --workspace=packages/backend -- nome_da_migration

# Seeds de desenvolvimento
npm run seed --workspace=packages/backend
```

### Convenções do banco

- **Primary keys:** UUID usando `gen_random_uuid()` (PostgreSQL)
- **Timestamps:** `timestamptz` (timezone-aware)
- **Soft delete:** apenas `is_active` em users; hard delete no restante
- **Multi-tenancy:** toda tabela com escopo de tenant tem coluna `tenant_id`

---

## API Reference

Todas as rotas são prefixadas com `/api/v1/`.

**Autenticação:** `Authorization: Bearer <accessToken>`
**API pública:** `X-API-Key: tlk_...`

### Convenções de resposta

```json
// Sucesso
{ "data": { ... } }
{ "data": [...], "meta": { "total": 100, "page": 1, "limit": 20 } }

// Erro
{ "error": "mensagem", "code": "ERROR_CODE", "details": [...] }
```

**Códigos HTTP:**
- `422` — erros de validação Zod
- `401` — não autenticado
- `403` — sem permissão (role)
- `402` — plano insuficiente (upgrade required)
- `404` — recurso não encontrado

### Endpoints

#### Autenticação (`/auth`)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/auth/register` | Cadastro de novo workspace |
| POST | `/auth/login` | Login com email/senha |
| POST | `/auth/refresh` | Renovar access token |
| POST | `/auth/logout` | Revogar refresh token |
| GET | `/auth/me` | Dados do usuário logado |
| PATCH | `/auth/me` | Atualizar perfil / trocar senha |
| GET | `/auth/google` | Redirecionar para Google OAuth |
| GET | `/auth/google/callback` | Callback do Google OAuth |

#### Workspace (`/tenant`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/tenant` | Dados do workspace atual |
| PATCH | `/tenant` | Atualizar configurações do workspace |

#### Equipe (`/users`)

| Método | Rota | Permissão |
|--------|------|-----------|
| GET | `/users` | Listar membros da equipe |
| POST | `/users/invite` | Convidar membro (manager/admin) |
| PATCH | `/users/:id` | Editar membro (admin) |

#### Contatos (`/contacts`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/contacts` | Listar com filtros e paginação |
| POST | `/contacts` | Criar contato |
| GET | `/contacts/:id` | Detalhe do contato |
| PATCH | `/contacts/:id` | Editar contato |
| DELETE | `/contacts/:id` | Excluir contato |
| POST | `/contacts/import` | Importar CSV (plano pro) |
| GET | `/contacts/export` | Exportar CSV (plano pro) |

#### Pipeline (`/pipelines`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/pipelines` | Listar pipelines |
| POST | `/pipelines` | Criar pipeline |
| PATCH | `/pipelines/:id` | Editar pipeline / renomear etapas |
| POST | `/pipelines/stages/reorder` | Reordenar etapas |

#### Negócios (`/deals`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/deals` | Listar negócios |
| GET | `/deals/kanban` | Dados agrupados por etapa para Kanban |
| POST | `/deals` | Criar negócio |
| GET | `/deals/:id` | Detalhe do negócio |
| PATCH | `/deals/:id` | Editar negócio |
| DELETE | `/deals/:id` | Excluir negócio |
| POST | `/deals/reorder` | Reordenar dentro da mesma etapa |
| PATCH | `/deals/:id/stage` | Mover para outra etapa |
| PATCH | `/deals/:id/won` | Marcar como ganho |
| PATCH | `/deals/:id/lost` | Marcar como perdido |
| GET | `/deals/export` | Exportar CSV (plano pro) |

#### Atividades (`/activities`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/activities` | Listar atividades |
| POST | `/activities` | Criar atividade |
| GET | `/activities/:id` | Detalhe |
| PATCH | `/activities/:id` | Editar |
| PATCH | `/activities/:id/done` | Marcar como concluída |

#### Calendário (`/calendar/events`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/calendar/events` | Listar eventos |
| POST | `/calendar/events` | Criar evento |
| PATCH | `/calendar/events/:id` | Editar evento |
| DELETE | `/calendar/events/:id` | Excluir evento |

#### Relatórios (`/reports`) — starter+

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/reports/kpis` | KPIs gerais |
| GET | `/reports/funnel` | Funil de conversão |
| GET | `/reports/revenue` | Receita por período |
| GET | `/reports/activities` | Atividades por tipo (starter+) |
| GET | `/reports/leaderboard` | Ranking de vendedores (starter+) |

#### Billing (`/billing`)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/billing/webhook` | Webhook Stripe (raw body) |
| GET | `/billing/subscription` | Status da assinatura atual |
| POST | `/billing/checkout` | Criar sessão de checkout |
| POST | `/billing/portal` | Abrir portal de billing Stripe |

#### API Keys (`/api-keys`) — starter+, admin only

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api-keys` | Listar API keys |
| POST | `/api-keys` | Criar nova API key |
| DELETE | `/api-keys/:id` | Revogar API key |

#### Integrações/Webhooks (`/integrations`) — starter+

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/integrations` | Listar webhooks |
| POST | `/integrations` | Criar webhook |
| PATCH | `/integrations/:id` | Editar webhook |
| DELETE | `/integrations/:id` | Excluir webhook |
| POST | `/integrations/:id/test` | Disparar evento de teste |

#### Busca (`/search`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/search?q=<query>` | Busca ILIKE em contatos, negócios e atividades (mín. 2 chars) |

#### Notificações (`/notifications`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/notifications` | Listar notificações |
| GET | `/notifications/unread-count` | Contagem de não lidas |
| PATCH | `/notifications/:id/read` | Marcar como lida |
| POST | `/notifications/read-all` | Marcar todas como lidas |

#### API Pública (`/public`) — autenticação por API key

| Método | Rota | Escopo |
|--------|------|--------|
| GET | `/public/contacts` | read |
| POST | `/public/contacts` | write |
| GET | `/public/deals` | read |

#### Health check

| Método | Rota | Resposta |
|--------|------|----------|
| GET | `/health` | `{ "status": "ok", "timestamp": "..." }` |

---

## Sistema de Planos e Permissões

### Planos

Hierarquia: `free < starter < pro < enterprise`

| Feature | Free | Starter | Pro | Enterprise |
|---------|------|---------|-----|------------|
| Contatos | Até 300 | Ilimitado | Ilimitado | Ilimitado |
| Usuários | Até 3 | Ilimitado | Ilimitado | Ilimitado |
| Pipelines/Kanban | Sim | Sim | Sim | Sim |
| Relatórios básicos | Sim | Sim | Sim | Sim |
| Relatórios avançados | Não | Sim | Sim | Sim |
| Importação CSV | Não | Não | Sim | Sim |
| Exportação CSV | Não | Não | Sim | Sim |
| Campos customizados | Não | Não | Sim | Sim |
| API keys | Não | Sim | Sim | Sim |
| Webhooks | Não | Sim | Sim | Sim |
| Rate limit | 100/dia | 1.000/dia | 10.000/dia | 10.000/dia |

Rotas gated retornam HTTP **402** com:

```json
{ "error": "upgrade_required", "code": "upgrade_required", "requiredPlan": "pro" }
```

### Roles

| Role | Permissões |
|------|-----------|
| `admin` | Acesso total — billing, gestão de usuários, config do workspace |
| `manager` | Todas as permissões do seller + gestão de equipe + relatórios |
| `seller` | CRUD de contatos/negócios próprios, pipeline, atividades |

---

## Deploy (Railway + Vercel)

- **Backend:** Railway, a partir do `railway.json` (builder `DOCKERFILE` → `packages/backend/Dockerfile`). Postgres do próprio Railway (`DATABASE_URL=${{Postgres.DATABASE_URL}}`). As migrations rodam sozinhas no boot (`db.migrate.latest()` em `server.ts`). Health check em `/health`.
- **Frontend:** Vercel, Root Directory `packages/frontend`, variável `VITE_API_URL`; `vercel.json` faz o rewrite de SPA.
- Push na `main` publica os dois. Variáveis de produção ficam nos painéis do Railway e da Vercel, nunca no repositório.
- Banco de produção: nunca apontar um backend local, script ou teste para ele sem autorização explícita.

---

## CI/CD

### CI — `.github/workflows/ci.yml`

Dispara em: push para `main`, pull requests para `main`

- **Backend:** `npx tsc --noEmit` (type-check TypeScript)
- **Frontend:** `npm run lint` (tsc --noEmit)
- Node 20 com cache de npm

---

## Design System

### Paleta de cores (Tailwind)

| Token | Hex | Uso |
|-------|-----|-----|
| `bg-primary` | `#0c0f15` | Background principal |
| `bg-darker` | `#04080f` | Background profundo (sidebar) |
| `bg-surface` | `#111827` | Cards, modais, inputs |
| `bg-border` | `#1f2937` | Bordas, divisores |
| `accent-green` | `#72d296` | CTA principal, estados ativos |
| `accent-green-dim` | `#4a9b6f` | Hover em elementos verdes |
| `text-primary` | `#ffffff` | Texto principal |
| `text-secondary` | `#9ca3af` | Labels secundários |
| `text-muted` | `#4b5563` | Placeholder, desabilitado |
| `status-won` | `#72d296` | Negócio ganho |
| `status-lost` | `#ef4444` | Negócio perdido |
| `status-open` | `#3b82f6` | Negócio em aberto |

Referência de design: **Linear** (clean, foco em produtividade) + **Pipedrive** (UX de pipeline).

### Convenções de componentes

- `cn()` (clsx + tailwind-merge) para merging condicional de classes
- `CVA` (class-variance-authority) para variantes de componentes
- Componentes `ui/` são puros (sem lógica de negócio)
- Páginas em `pages/` podem usar hooks e lógica de negócio

---

## Arquitetura Multi-tenant

Cada usuário pertence a exatamente um tenant (workspace). O isolamento é aplicado na **camada de serviço**:

1. Middleware `tenantScope` extrai `tenant_id` do JWT e define `req.tenantId`
2. Toda função de serviço recebe `tenantId` como **primeiro argumento**
3. Toda query Knex em tabela com escopo de tenant **deve** incluir `.where({ tenant_id: tenantId })`

```typescript
// CORRETO
async function getDeals(tenantId: string, filters: DealFilters) {
  return db('deals').where({ tenant_id: tenantId, ...filters });
}

// ERRADO — nunca faça isso (vazamento de dados entre tenants)
async function getDeals(filters: DealFilters) {
  return db('deals').where(filters);
}
```

**Tabelas sem escopo de tenant:** `tenants`, `refresh_tokens`, `api_keys`

---

## Autenticação

### Fluxo JWT

- **Access token:** JWT, TTL 15 minutos, assinado com `JWT_SECRET`, payload `{ sub: userId, tenantId, role }`
- **Refresh token:** TTL 7 dias, armazenado **com hash SHA-256** em `refresh_tokens` (revogável no servidor)
- **Rotação:** cada chamada a `/auth/refresh` emite novo refresh token e revoga o anterior

### Silent refresh (frontend)

O interceptor em `src/services/api.ts` captura respostas `401` → chama `/auth/refresh` silenciosamente → reprocessa a requisição original automaticamente.

### OAuth Google

- Rotas: `GET /auth/google` (redirect) → `/auth/google/callback` (token)
- Novos usuários têm tenant criado automaticamente
- `password_hash` é nullable — usuários OAuth não têm senha local
- Frontend: `AuthCallbackPage` em `/auth/callback` lê `accessToken`, `refreshToken` e `isNew` da query string; redireciona para `/onboarding` se novo usuário

### Middleware de proteção

```typescript
requireAuth               // Verifica JWT, define req.user = { id, tenantId, role }
requireRole('admin')      // Verifica role mínima
requireTier('pro')        // Verifica plano do tenant (lê do DB, não do JWT)
```

---

## Tarefas Pendentes de Infraestrutura

| Tarefa | Descrição |
|--------|-----------|
| Google OAuth em produção | Configurar `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` com o domínio real nas credenciais do Google Cloud Console |
| Stripe webhook em produção | Registrar `https://seudominio.com.br/api/v1/billing/webhook` no painel Stripe após configurar o domínio |
