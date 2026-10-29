# TitanFlow — CLAUDE.md

This file documents everything an AI assistant needs to know to contribute effectively to this project.

---

## Workflow obrigatório (seguir sempre, sem precisar ser lembrado)

### Ao iniciar qualquer sessão
1. Ler este `CLAUDE.md` e o `plan.md` para se contextualizar

### Ao iniciar qualquer feature ou modificação
1. Trabalhar direto na `main` (decisão do usuário em 2026-10-26 — não criar branch `feat/...` a menos que ele peça)
2. Implementar o que foi pedido
3. Rodar build do frontend (`npm run build --workspace=packages/frontend`) para confirmar zero erros TS antes de commitar

### Quando o usuário disser "pode commitar"
Executar **tudo isso automaticamente, sem precisar ser pedido**:
1. `git add` nos arquivos alterados
2. `git commit` com mensagem descritiva no padrão `feat(MXX-TX): descrição`
3. Atualizar `CLAUDE.md` (marcar milestone como `✅ Done` e atualizar **Key implementation notes**) e `plan.md`
4. Commit das atualizações de documentação: `docs: atualiza CLAUDE.md pós MXX-TX`
5. `git push` da `main` (sem PR — trabalho direto na main)

### Banco de dados — sem Docker
Produção = Postgres do Railway. Local (dev e testes) = PostgreSQL 18 nativo do Windows, serviço `postgresql-x64-18` (início manual: `Start-Service postgresql-x64-18` como administrador). **Nunca** apontar backend local, script ou teste para o banco do Railway sem autorização explícita.

### Migrations — nunca aplicar em produção sem commitar (incidente de 29/10/2026)
O `.env` local do backend **aponta para o banco de produção**: `npm run dev`/`dev:backend` roda `migrate:latest` lá. Uma migration aplicada assim e **não commitada** derruba a produção: o Knex vê no banco `20240042_...` sem o arquivo no código, falha com "The migration directory is corrupt, the following files are missing" e o container do Railway entra em loop (502).
- **Regra:** antes de rodar o backend local, confirme que `DATABASE_URL` é o banco local (`titancrm`, `localhost`). Se precisar testar uma migration nova, use `titancrm`/`titancrm_test`, nunca o `.env` de produção.
- **Se a migration já foi aplicada em produção:** commite o arquivo na hora, no mesmo push do código que a usa. Nunca apague um arquivo de migration que já rodou em produção, nem renomeie.
- **Sintoma/diagnóstico:** log do Railway com "migration directory is corrupt ... missing: <arquivo>". Correção: restaurar o arquivo com o mesmo nome (se o original se perdeu, um marcador sem alterações, como `20240042_add_lead_result_to_lead_assignments.ts`, que o original substitui depois).
- Antes de criar uma migration, rode `git fetch` e confira o maior número em `origin/main` para não colidir com outra sessão.
- **Trava no código:** `src/config/assertLocalDatabase.ts` (chamada por `env.ts` e `knexfile.ts`) **recusa subir/migrar** quando `NODE_ENV` não é `production`/`test` e o `DATABASE_URL` não é `localhost`/`127.0.0.1`/`::1`. Se o backend local parar com "DATABASE_URL aponta para um banco remoto", troque o `.env` para o banco local — não contorne. `ALLOW_REMOTE_DB=1` libera só para uma operação deliberada (ex.: importar o histórico do Radar em produção com `--confirm`), passado no comando, nunca no `.env`.

---

## Project Overview

**TitanFlow** (formerly Titan Labs CRM) is a multi-tenant SaaS CRM for managing leads, contacts, deals, and sales pipelines. Companies sign up and get an isolated workspace. The product replaces scattered tools (WhatsApp, spreadsheets) with a centralized Kanban-first platform.

**Key personas**: Seller (manages leads/deals), Manager (analytics + team config), Admin (billing + workspace ownership).

---

## Monorepo Structure

```
CRM/
├── packages/
│   ├── backend/        # Express + TypeScript + Knex + PostgreSQL (Dockerfile = build do Railway)
│   └── frontend/       # React + Vite + TypeScript + Tailwind CSS (Vercel)
├── docs/superpowers/   # specs e planos de implementação
├── CLAUDE.md
├── plan.md
├── railway.json        # deploy do backend
└── package.json        # npm workspaces root
```

Run commands from the **repo root** unless noted otherwise.

---

## Commands

```bash
# Start local DB (PowerShell como administrador)
Start-Service postgresql-x64-18

# Install all deps (run from root)
npm install

# Backend
npm run dev --workspace=packages/backend        # dev server on :3001
npm run build --workspace=packages/backend      # tsc compile
npm run migrate:latest --workspace=packages/backend   # run pending migrations
npm run migrate:rollback --workspace=packages/backend # rollback last batch
npm run seed --workspace=packages/backend       # run dev seeds

# Frontend
npm run dev --workspace=packages/frontend       # Vite dev server on :5173
npm run build --workspace=packages/frontend     # production build
npm run preview --workspace=packages/frontend   # preview production build

# From inside a package directory
cd packages/backend && npm run dev
cd packages/frontend && npm run dev
```

---

## Tech Stack

| Layer | Library |
|---|---|
| Backend runtime | Node.js 20+ |
| Backend framework | Express 4 + TypeScript |
| Database | PostgreSQL 16 |
| Query builder / migrations | Knex.js |
| Auth | jose (JWT) + bcryptjs |
| Validation | Zod |
| Payments | Stripe Node SDK |
| Frontend build | Vite |
| Frontend framework | React 18 + TypeScript |
| Server state | TanStack Query v5 |
| Global client state | Zustand |
| Forms | React Hook Form + Zod |
| Styling | Tailwind CSS v3 + CVA (class-variance-authority) |
| UI primitives | Radix UI |
| Charts | Recharts |
| Drag and drop | @dnd-kit/core + @dnd-kit/sortable |
| Calendar | react-day-picker (DateTimePicker) — FullCalendar removido |
| Icons | Lucide React |
| HTTP client | Axios (with interceptors) |
| Toasts | Sonner |
| Date handling | date-fns |

---

## Design System

Brand palette — applied via Tailwind config:

| Token | Hex | Usage |
|---|---|---|
| `bg-primary` | `#0a0d15` | Main background (Aurora Slate) |
| `bg-darker` | `#07090f` | Deeper bg (sidebar) |
| `bg-surface` | `#131926` | Modals, solid surfaces (cards usam vidro `.card`) |
| `bg-border` | `#1f2636` | Borders, dividers |
| `accent-green` | `#72d296` | Primary CTA, active states, accent |
| `accent-green-dim` | `#4a9b6f` | Hover states on green |
| `text-primary` | `#ffffff` | Main text |
| `text-secondary` | `#9ca3af` | Muted labels |
| `text-muted` | `#4b5563` | Placeholder, disabled |
| `status-won` | `#72d296` | Won deal state |
| `status-lost` | `#ef4444` | Lost deal state |
| `status-open` | `#6b8cff` | Open deal state |

Design language reference: **Linear** (clean, productivity-focused) + **Pipedrive** (pipeline UX).

---

## Multi-Tenancy Rules (CRITICAL)

Every user belongs to exactly one tenant (workspace). Tenant isolation is enforced at the **service layer**:

1. `requireAuth` extracts `tenantId` from the decoded JWT and sets `req.user.tenantId` / `req.tenantId` (there is no separate `tenantScope` middleware).
2. Every service function receives `tenantId` as its **first argument**.
3. Every Knex query on a tenant-scoped table **must** include `.where({ tenant_id: tenantId })`.
4. Never query a tenant-scoped table without scoping — this is a data leak.

Tables NOT scoped by tenant: `tenants`, `refresh_tokens`, `api_keys` (keyed by hash directly).

```typescript
// CORRECT
async function getDeals(tenantId: string, filters: DealFilters) {
  return db('deals').where({ tenant_id: tenantId, ...filters });
}

// WRONG — never do this
async function getDeals(filters: DealFilters) {
  return db('deals').where(filters); // missing tenant_id scope!
}
```

---

## Auth Architecture

- **Access token**: JWT, 15-minute TTL, signed with `JWT_SECRET`, contains `{ sub: userId, tenantId, role }`
- **Refresh token**: 7-day TTL, stored **hashed** (SHA-256) in `refresh_tokens` table, enables server-side revocation
- Token rotation: every refresh call issues a new refresh token and revokes the old one
- Frontend: Axios interceptor catches 401 → silently calls `/auth/refresh` → retries original request
- `requireAuth` middleware: verifies JWT, attaches `req.user = { id, tenantId, role }`

---

## Role System

| Role | Permissions |
|---|---|
| `admin` | Full access — billing, user management, workspace config |
| `manager` | All seller permissions + team management + reports |
| `seller` | CRUD own contacts/deals, view pipeline, log activities |

Use `requireRole('admin')` or `requireRole('manager', 'admin')` middleware on routes.

---

## Feature Gating / Plan Tiers

Tier hierarchy: `free < starter < pro < enterprise`

```typescript
// Usage on routes
router.get('/contacts/export', requireAuth, requireTier('pro'), handler);
```

`requireTier` reads `tenant.plan` from the **database** (not JWT) to avoid stale plan data.
Gated routes return HTTP **402** with body `{ error: 'upgrade_required', requiredPlan: 'pro' }`.
Frontend reads this response and triggers the `UpgradeModal` component.

| Feature | Min tier |
|---|---|
| CSV import | pro |
| CSV export (contacts) | pro |
| Integrations / Webhooks | starter |
| API keys | starter |
| Extra users (>3) | starter |
| Custom fields | pro |

---

## API Conventions

- All routes prefixed: `/api/v1/`
- Auth: `Authorization: Bearer <accessToken>` header
- Public API: `X-API-Key: tlk_...` header
- Success: `{ data: ... }` or `{ data: [...], meta: { total, page, limit } }`
- Error: `{ error: 'message', code?: 'ERROR_CODE', details?: [...] }`
- Pagination: query params `?page=1&limit=20` (offset-based)
- HTTP 422 for validation errors (Zod), 401 for auth, 403 for role, 402 for tier, 404 for not found

---

## Database Conventions

- All primary keys: `uuid` using `gen_random_uuid()` (Postgres)
- All timestamps: `timestamptz` (timezone-aware)
- Soft delete: not used — use `is_active` for users, hard delete elsewhere
- Migrations: Knex timestamped migrations in `packages/backend/src/db/migrations/`
- Never modify existing migrations — always create a new one
- Every migration has both `up` and `down` functions

---

## Frontend Conventions

- All API calls go through `src/services/api.ts` (Axios instance)
- All server state via TanStack Query hooks in `src/hooks/`
- All client-only global state via Zustand stores in `src/store/`
- All forms use React Hook Form with Zod resolver
- Components in `src/components/ui/` are pure, reusable, no business logic
- Page components in `src/pages/` may use hooks and business logic
- Use `cn()` (clsx + tailwind-merge) for conditional class merging

---

## Environment Variables

### Backend (`packages/backend/.env`)
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/titancrm
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
PORT=3001
NODE_ENV=development
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:5173
```

### Frontend (`packages/frontend/.env`)
```
VITE_API_URL=http://localhost:3001/api/v1
```

---

## Standing instruction — end of every milestone

When a milestone is fully implemented, immediately update this file:
1. Mark the milestone `✅ Done` in the table below
2. Update the **Next** section to point to the next milestone
3. Replace the **Key implementation notes** bullet points with fresh notes reflecting the current state — remove stale notes, add anything a new session needs to know to continue without re-reading the code

---

## Milestone Status

See [plan.md](./plan.md) for current progress.

| Milestone | Status |
|---|---|
| M1 — Scaffolding & Auth | ✅ Done |
| M2 — Contacts Module | ✅ Done |
| M3 — Pipeline & Kanban | ✅ Done |
| M4 — Dashboard, Activities, Calendar | ✅ Done |
| M5 — Reports, Export, Team | ✅ Done |
| M6 — Integrations API & Webhooks | ✅ Done |
| M7 — Billing & Premium Tiers | ✅ Done |
| M8 — Polish, Search, Deployment | ✅ Done |

## Next: **M25 T15 — corte do LeadHunter** (T1–T14 publicadas em 29/10/2026 e no ar; passos 1–4 abaixo **já feitos**: variáveis `DATAFORSEO_*` no Railway, Radar Python fechado, deploy, flag ligada só em `estus-corporation` por SQL; `TYPESAFE_API_KEY` não configurada — classificação por regras locais). Passos do corte, cada um com autorização do usuário: (1) `DATAFORSEO_LOGIN/PASSWORD` (e opcional `TYPESAFE_API_KEY`) no Railway; (2) fechar o Radar Local Python (senão ele perde o pedido em execução, as rotas `/public/lead-requests` foram removidas); (3) "Deploy Latest Commit" no Railway; (4) ligar `tenants.leadhunter_enabled` do workspace por SQL; (5) importar o histórico (`packages/backend/scripts/import-leadhunter.ts --tenant <uuid> --file <json> --confirm`, exige `ALLOW_REMOTE_DB=1` em produção); (6) remover `POST /public/leads/bulk`. **Handoff completo (o que falta, pendências e cuidados): [docs/superpowers/prompts/2026-10-29-continuar-m25-corte.md](./docs/superpowers/prompts/2026-10-29-continuar-m25-corte.md).** Referências: checkpoint [docs/superpowers/progress/2026-10-27-m25-andamento.md](./docs/superpowers/progress/2026-10-27-m25-andamento.md). O plano é [docs/superpowers/plans/2026-10-27-leadhunter-no-crm.md](./docs/superpowers/plans/2026-10-27-leadhunter-no-crm.md) (desenho: [docs/superpowers/specs/2026-10-27-leadhunter-no-crm-design.md](./docs/superpowers/specs/2026-10-27-leadhunter-no-crm-design.md)) com `superpowers:subagent-driven-development` em ondas paralelas, a partir da T1 — prompt pronto e instruções de onde rodar em [docs/superpowers/prompts/2026-10-27-executar-m25.md](./docs/superpowers/prompts/2026-10-27-executar-m25.md) (sessão aberta no CRM com `--add-dir ../LeadHunter`). A validação do M24 T2 em produção foi **cancelada** (o executor externo sai na F3 do M25). Demais itens no backlog de [plan.md](./plan.md) (Z-API, webhook Stripe prod, Google OAuth prod)

| Task | Descrição | Status |
|---|---|---|
| M9 T1 | Stripe: `payment_method_types: ['card']` corrigido | ✅ Done |
| M9 T2 | Acesso ao banco PostgreSQL em produção (Docker) | ✅ Done (documentado) |
| M9 T3 | Landing page de apresentação e venda | ✅ Done |
| M9 T4 | Navbar: exibir nome da empresa do tenant | ✅ Done |
| M9 T5 | Pipeline: editar nome das etapas (inline edit) | ✅ Done |
| M9 T6 | Contatos: campo "Responsável" com select de membros | ✅ Done |
| M10 T1 | Limite Free 300 contatos + gate Relatórios + indicador Dashboard | ✅ Done |
| M10 T2 | RegisterPage simplificada (slug auto-gerado, 4 campos) | ✅ Done |
| M10 T3 | Botão WhatsApp flutuante (LandingPage + AppShell) | ✅ Done — trocar número em produção |
| M10 T2 | OAuth Google no cadastro | ✅ Done (código pronto) |
| M10 T2 | Onboarding pós-cadastro (2 passos) | ✅ Done |
| M11 T1 | Rebrand para TitanFlow + redesign Kanban | ✅ Done |
| M11 T2 | Pipeline: fix drag & drop entre colunas | ✅ Done |
| M11 T3 | Pipeline: scroll horizontal via roda do mouse | ✅ Done |
| M11 T4 | Deals: transições de status (open↔won↔lost) + toast undo | ✅ Done |
| M11 T5 | Deals: exclusão com limpeza completa no banco | ✅ Done |
| M13 T1 | Multi-workspace: `user_tenants` pivot + workspace switcher no Topbar | ✅ Done |
| M13 T2 | FunnelChart tooltip: cor verde (`#72d296`) | ✅ Done |
| M13 T3 | DealDetailPage: responsável editável inline | ✅ Done |
| M13 T4 | Atividades: campo assignee + notificação ao responsável | ✅ Done |
| M14 T1 | Deals lista: busca por texto (q) + paginação real | ✅ Done |
| M14 T2 | Export de atividades CSV | ✅ Done |
| M14 T3 | Kanban: lazy load por coluna | ✅ Done |
| M14 T4 | Calendário: redesign completo com EventManager customizado | ✅ Done |
| M10 T3 | Integração Z-API / Evolution API | 🔲 Pendente |
| M9 T1 | Webhook Stripe em produção | 🔲 Pendente (aguarda domínio) |
| M10 T2 | Credenciais Google OAuth em produção | 🔲 Pendente — ver plan.md T2 |
| M15 T1 | Resend: configurar RESEND_API_KEY + atualizar e-mail convite para TitanFlow | ✅ Done |
| M16 | Redesign Landing Page — GSAP cinematic, Framer-style, conversão | ✅ Done |
| M17 | Audit + fix Dashboard/Contatos/Negócios/Relatórios (hierarquia, densidade, espaçamento) | ✅ Done |
| M18 T1 | Config prod: `BACKEND_URL` (callback Google), `EMAIL_FROM`, páginas `/privacidade` + `/termos`, `vercel.json` SPA, fix CI tsc | ✅ Done |
| M19 T1 | Redesign: menu lateral animado, busca inline no topo, paleta Aurora Slate, cards em vidro líquido | ✅ Done |
| M20 T1 | Temas claro/escuro, paleta Ink·Esmeralda·Âmbar, shader Silk, layout em pasta, listas animadas (Contatos/Negócios/Relatórios/Calendário/Equipe), nicho em contatos, modais pop | ✅ Done |
| M20 T2+ | Redesign do Pipeline (kanban) e Dashboard no padrão novo | 🔲 Próximo |
| M21 T1 | Captação de leads (captador), perfil da empresa + integrantes, painel de equipe, redesign mobile | ✅ Done |
| M21 T2 | Transparência fixa, tema por usuário, agenda de reunião redesenhada, blocos mobile em Pipeline/Contatos/Captação | ✅ Done |
| M21 T3 | Card de lead recolhível + possíveis dores, atalhos da empresa (telefone/Instagram/site/endereço), Configurações em blocos no celular | ✅ Done |
| M21 T4 | Serviços e preços em arquivo PDF/DOCX com prévia, dev backend em polling, CD corrigido | ✅ Done |
| M22 T1 | Convites de workspace com aceite/recusa + cadastro "Criar conta" sem empresa | ✅ Done |
| M23 T1 | Pipeline: arrastar preciso + cards/colunas redesenhados; topo com menu da conta e notas | ✅ Done |
| M23 T2 | Página do lead do captador + agenda dos admins (reunião vira evento), calendário redesenhado, header/menu novos | ✅ Done |
| M24 T1 | Envio de leads do LeadHunter pela API pública (leads/bulk, public/users), migration 20240035 | ✅ Done |
| M24 T2 | Pedidos de leads do CRM atendidos pelo LeadHunter (lead_requests, cotas, tela Solicitações de leads), migration 20240036 | ✅ Done |
| M25 T1 | Base do LeadHunter: `vitest` no backend, flag `tenants.leadhunter_enabled`, tabelas `lh_*` (migration 20240037), `requireLeadHunter` | ✅ Done |
| M25 T2 | Domínio do LeadHunter (`modules/leadhunter/domain.ts`, port de `radar/domain.py`; hashes conferidos contra o Python) | ✅ Done |
| M25 T3–T14 | LeadHunter dentro do CRM (motor, API, telas de campanhas/ficha/locais/integrações, pedidos executados no CRM, importação do histórico) — plano em `docs/superpowers/plans/2026-10-27-leadhunter-no-crm.md` | ✅ Done (publicado em 29/10/2026; **flag `leadhunter_enabled` ligada só na Estus**, `estus-corporation`) |
| M25 T15 | Corte: flag ligada, Radar Python fechado, DataForSEO no Railway ✅; falta importar o histórico e remover `/public/leads/bulk` | 🚧 Parcial (autorização do usuário a cada passo) |
| M26 T1 | Dashboard (KPIs com tendência, receita 6 meses, funil em colunas), Pipeline (cabeçalho com ícone, total no rodapé, cards de vidro), traço nos títulos, login sem travar | ✅ Done |
| M26 T2 | Captação: captador cadastra leads, lead removido não volta sozinho, Formulário (Ligação/Mensagem WhatsApp/Agenda), notificação agrupada; Painel do captador/Meus leads/Relatórios no padrão do Dashboard; Sobre a empresa com ficha; Solicitações só admin; migration 20240039 | ✅ Done |
| M26 T3 | Relatórios analíticos (Vendas/Captação), página do lead pro admin com edição, Adicionar lead manual/automático (Solicitações saiu do menu), cota conta remoções do dia, menu reorganizado, listas/tabelas em vidro com ícones | ✅ Done |
| M27 T1 | Dados do LeadHunter na ficha do contato (Maps, Instagram, nota, score, visibilidade) + Instagram candidato enviado ao CRM marcado como não confirmado | ✅ Done |
| M26 T4 | Contatos do lead no Formulário (pessoas conseguidas na ligação, migration 20240040), nome capitalizado, cargo com opções e e-mail minúsculo | ✅ Done |
| M26 T5 | "Em aguardo" ao lado de Concluir lead (migration 20240041, `lead_assignments.on_hold_at`) | ✅ Done |
| M26 T6 | Admins veem "Em aguardo" no Acompanhamento + notificação `leads.on_hold` | ✅ Done |
| M26 T7 | Coluna Status no Acompanhamento; resultado "Em aguardo" da ligação removido (fica só o botão) | ✅ Done |
| M26 T8 | Ligação: Não atendeu/Atendeu (`answered`); Mensagem só Respondeu/Não respondeu e bloqueada até a ligação ter resultado | ✅ Done |
| M26 T9 | Página do lead completa (Ganhou/Perdeu/Em aguardo + Salvar, retorno com lembrete, histórico de tentativas, motivo da perda, número errado, roteiro), Acompanhamento em cards, presença online (migrations 20240042–20240044) | ✅ Done |
| M26 T10 | Página do lead em abas (Formulário / Sobre o lead / Anotações), tudo salva sozinho, Mensagem só após "Não atendeu" (Sem resposta/Sem WhatsApp, migration 20240045), LeadHunter como abas da Captação, "Online agora" no menu | ✅ Done |
| M26 T11 | Filtros de Meus leads e Captação (aba, período, status, busca, nicho, página, captador) não resetam ao trocar de tela | ✅ Done |

## Key implementation notes (context for future sessions)

- **M26 T11 ✅ (29/10/2026)**: `hooks/useStickyState.ts` = `useState` guardado por chave em `sessionStorage` (`titanflow-filters`, store zustand). Usado em Meus leads (`myLeads.scope/status`), Distribuir (`captacao.distribute.*`), Acompanhamento (`captacao.tracking.*`) e na aba da Captação (`captacao.tab`; `?tab=` na URL tem prioridade e atualiza a última aba). Setter não aceita função (`setPage(page + 1)`).
- **M27 T1 ✅ (28/10/2026)**: contato mostra dados do LeadHunter. `GET /contacts/:id` agora devolve `maps_url/instagram/website/address/google_rating (number)/google_reviews/lead_score/lead_context/external_id`; `GET /contacts/:id/leadhunter` (`requireAuth` apenas, não exige flag nem admin) lê `lh_companies` por `(tenant_id, identity = contacts.external_id)` via `leadhunter/contactView.ts` + `store.companyByIdentity` (análise da campanha mais recente que tem análise) e devolve só campos permitidos (nunca notas/etapa/`crm`/procedência/custos). Painel `components/contacts/LeadHunterInfo.tsx`; `lead_context` só aparece quando não há ficha (pode conter observações internas do operador). **Instagram**: `toContactInput` envia o melhor candidato quando o status é `candidate` (antes só `confirmed`, e em pedido entregue automático ninguém confirma) e põe "Instagram não confirmado: conferir o perfil" no `lead_context`. Testes `contactView.int.test.ts` escritos, **não executados** (exigem `TEST_DATABASE_URL`).

- **M26 T10 ✅ (29/10/2026)**: **Página do lead** (`LeadCard` detail) em abas (`LEAD_VIEWS`/`view`: `form` | `about` | `notes`, `SegmentedControl` abaixo do cabeçalho). **Formulário**: faixa "CONTATO COM O LEAD | …" (rótulo grudado embaixo do título, `bg-black/[0.18]`) + `PlanBlock` Ligação e Mensagem (cards de vidro, conteúdo aberto `bg-black/[0.2]`); ao lado o card **Agendamentos** ("OCASIONAL | …": Agenda + Retorno, `StepRow stacked`, opções em grade), mesma altura (`lg:self-stretch` + `h-full`). **Não há mais botão Salvar**: resultado da ligação grava no clique (`chooseStatus` → `update.mutate` com `logCall`), reunião grava quando tem data+formato (`persistMeeting`), local no blur; Ganhou/Perdeu/Em aguardo continuam em `save(override)`. **Mensagem** trancada (`messageLock`) a não ser com `no_answer` (ou mensagem já registrada); opções `replied` / `no_reply` ("Sem resposta") / `no_whatsapp` ("Sem WhatsApp", migration **20240045** troca o CHECK). `callback` antigo vira `pending` na tela (`callStatusOnScreen`). Roteiro (`CallScript`) e jornada do lead removidos. **Sobre o lead**: Ficha, Possíveis dores (com `LEAD_PAIN_SCRIPT`), Contatos (`LeadPeopleCard`) e `LeadRecord` (reunião, retorno, anotação, histórico). **Anotações**: aba própria (salva no blur ou "Salvar anotação"). Estilo dos cards em `components/captacao/cardStyles.ts` (`SPLIT_CARD` + `SPLIT_CARD_HEAD` sólido + `SPLIT_CARD_BODY` `bg-bg-surface/45`); cabeçalho do lead em vidro `bg-fg/[0.035]`. Nome do lead sem repetir a empresa (empresa só se ≠ nome) e segmento ao lado do nome (também em Distribuir). **LeadHunter**: Campanhas/Locais pesquisados/Integrações viraram abas da Captação (`?tab=campaigns|searches|integrations`, só admin + flag; páginas com prop `embedded`); `/leadhunter*` redireciona; seção saiu do menu. **Presença**: "Online agora" no fim do menu lateral (`SidebarOnline`; saiu do topo e do Dashboard). **Nomes**: `personName` (nome todo em maiúsculas vira iniciais maiúsculas) e `shortName` (primeiro + último) em todo lugar de captador.
- **M26 T9 ✅ (29/10/2026)**: migrations **20240042** (`lead_assignments.lead_result` won/lost — o arquivo original substituiu o marcador do incidente), **20240043** (`next_contact_at`/`next_contact_notified_at`/`lost_reason` + tabela `lead_contact_attempts` channel call|whatsapp) e **20240044** (`users.last_seen_at`). **Página do lead** (`LeadCard` detail): Formulário = lista única de `PlanBlock` (linha com situação à direita; `StepRow` + `ChoicePill` dentro): Ligação ("O lead atendeu?": `CALL_RESULT_OPTIONS` = no_answer/answered/**wrong_number**), Mensagem (Respondeu/Não respondeu; abrir o bloco = enviada + em aguardo), Agenda (abrir = situação Ganhou; "Excluir reunião" na `AdminAgenda` via `onRemove`), **Retorno** (`nextContactAt`, salva na hora, atalhos), Contatos, **Histórico** (`AttemptsTimeline`, exportado). Ganhou/Perdeu/Em aguardo = `situationButtons()` no cabeçalho (e acima do Salvar no celular); **Perdeu abre modal do motivo** (`LOST_REASON_LABEL`); "Salvar" (`save(override?, lostReason?)`) manda `logCall` quando o captador escolheu um resultado na visita. Backend: `updateMyLead` grava tentativa (`logAttempt`) em `logCall` e em mudança de `whatsappStatus`; `recordWhatsapp` também; `getMyLead`/`updateMyLead`/`getLeadForManager` devolvem `attempts`; `MY_LEAD_COLUMNS` com `attempts_count`/`last_attempt_at`; scope `followup` ("Retornar hoje") e ordenação com retorno vencido na frente; `notifyDueFollowups` (chamado em `GET /notifications` e `/unread-count` do captador) cria `leads.followup` uma vez por retorno. Coluna direita: Sobre o lead, Possíveis dores com `LEAD_PAIN_SCRIPT`, `CallScript` (abertura + objeções, textos genéricos). **Acompanhamento** (`TrackingTab`): cards de vidro (`bg-fg/[0.035]`, sem blur), Status (`StatusChip` com motivo da perda) + linha discreta ligação/mensagem/tentativas/retorno, Fechou/Não fechou num bloco de ícones, **botão direito = Excluir lead** (`contactsService.delete`); Meus leads no mesmo vidro e com o retorno no card. **Presença**: `requireAuth` → `touchPresence` (1x/min por usuário, sem await); `GET /tenant/online` (visto < 2 min); `hooks/usePresence.ts` (`useOnlineMembers` 30s, `useOnlineIds`); `Avatar` prop `online` (bolinha; wrapper `relative flex` — `inline-flex` deixava um arco do anel aparecendo); `OnlineMembers` no `Topbar` (some quando só você, oculto no celular); bolinha em `TeamRoster`/`TeamPanel`/`CaptadoresTab`. `shortName` foi pra `lib/utils.ts`. **Pendente**: número errado ainda conta na cota/relatórios como ligado.
- **M26 T5 ✅ (28/10/2026)**: migration **20240041** (`lead_assignments.on_hold_at`). `updateMyLeadSchema.onHold` (true = marca agora, false = limpa; ignorado quando `concluded: true`, que também limpa). `LeadCard` (detail): botão "Em aguardo"/"Tirar do aguardo" (`holdMutation` próprio) ao lado de "Concluir lead" — envia resultado + anotação (+ agenda só se completa) sem concluir; selo âmbar "Em aguardo" na lista/página enquanto não concluído. Não muda contagens do painel (lead em aguardo continua "a fazer"). **T6**: `listAssignments` devolve `on_hold_at`/`concluded_at` → selo âmbar no `TrackingTab` (some ao concluir/fechar); `notifyOnHold` cria `leads.on_hold` pra cada admin ativo só na transição (lead ainda sem `on_hold_at`), ícone `Hourglass` no `NotificationPanel`. **T7**: `TrackingTab` tem coluna Status (`StatusChip`) no lugar do selo embaixo do nome; `CALL_STATUS_ORDER` não tem mais `callback` (o "Em aguardo" é só o botão; `callback` continua válido no schema/tipos pra dados antigos); `toggleHold` avisa "servidor desatualizado" se a resposta vier sem `on_hold_at`. **T8**: opções do Resultado em `CALL_RESULT_OPTIONS` (`no_answer`, `answered`); `answered` novo em `CALL_STATUSES`/`CallStatus`/`byStatus` (sem migration); com `meeting` (vindo da Agenda) o "Atendeu" fica aceso e clicar nele não apaga a reunião; `lost`/`callback` seguem válidos só pra dados antigos. `WHATSAPP_STATUS_ORDER` = `replied`/`no_reply` (`waiting` = "Mensagem enviada", setado ao abrir o WhatsApp); `PlanBlock` ganhou `tag` e `lockedHint` (Mensagem trancada enquanto `status === 'pending'`).
- **M26 T4 ✅ (28/10/2026)**: migration **20240040** (`contacts.lead_people` jsonb, padrão `[]`). `updateMyLeadSchema.leadPeople` (até 20, e-mail opcional) grava na empresa do lead do captador (`updateMyLead` busca `contact_id`); `MY_LEAD_COLUMNS` e `getLeadForManager` devolvem `c.lead_people`. Frontend: `components/captacao/LeadPeopleCard.tsx` (prop `bare` = sem card, dentro do `PlanBlock` "Contatos do lead" do Formulário; sem `onSave` = leitura). `lib/utils.ts`: `capitalizeName` (de/da/do/dos/das/e minúsculos no meio), `JOB_TITLE_OPTIONS`, `withTransform`, `lowerEmail` — usados também no `AddLeadModal` (cargo vira select + "Outro"). **Atenção**: zod descarta campos desconhecidos, então com o backend dev desatualizado o "Salvar contato" parece funcionar e não grava — reiniciar o `npm run dev:backend` (que também roda as migrations no banco do `.env`, hoje o de produção).
- **M26 T3 ✅ (28/10/2026)**: **Relatórios** não repete mais o Dashboard: abas Vendas (`components/reports/SalesReport.tsx`, recebe `period`; `SALES_PERIODS` usado no seletor da linha das abas), Vendedores (ranking), Captação (`CaptacaoReport.tsx`, usa `useCaptadores`, só admin/gerente), Atividades, Exportar. **Distribuir leads**: cards no padrão de Meus leads; o quadrado do ícone seleciona, o card abre `/captacao/lead/:id` (`pages/captacao/ManagerLeadPage.tsx`, `GET /captacao/leads/:id` = `getLeadForManager`, inclui `lead_context` e captador atual) com "Atribuir lead" e **Editar** (`AddLeadModal editing={lead}` → `PATCH /contacts/:id`; campo vazio apaga). `listAvailableContacts` devolve `google_rating/google_reviews`. **Adicionar lead** abre `AddLeadChooser` (Manual → `AddLeadModal`; Automático → `AutoLeadsModal` com `LeadRequestsPage embedded`, só admin); não existe mais aba nem item de menu de Solicitações (`/solicitacoes` redireciona). `topUpDailyLeads` soma as remoções do dia (`lead_assignment_removals.removed_at` em America/Sao_Paulo) na cota. **Menu**: Visão geral (Dashboard, Relatórios, Calendário) / Vendas / Empresa (Captação, Sobre a empresa); vendedor sem "Empresa"; captador: Visão geral (Painel, Minhas comissões) / Captação (Meus leads, Reuniões, Sobre a empresa). **Listas**: todo `DataList` tem `.data-list-glass` (corpo `rgb(var(--bg-surface)/0.45)`, sem `backdrop-filter` — aninhado na `.folder-surface` ele escurece) e cards com `.data-table` também; rótulos de coluna com `HeadLabel` (`components/ui/HeadLabel.tsx`). Cabeçalho do calendário translúcido (só o corpo é sólido). **Lembrete**: o tsx watch do backend dev às vezes não recarrega no drive A: — se uma rota nova der 404/"não encontrado", reiniciar `npm run dev:backend`.
- **M26 T2 ✅ (28/10/2026)**: migration **20240039** (`lead_assignments.whatsapp_at/whatsapp_count/whatsapp_status` + tabela `lead_assignment_removals`; 20240038 reservada pro M25). `topUpDailyLeads` ignora leads removidos daquele captador e não conta na cota os que ele mesmo cadastrou (`assigned_by = captador`). `unassign(tenantId, adminId, id)` grava a remoção. `notifyAssigned` soma na notificação `leads.assigned` não lida das últimas 6h (lê o número do título). `/solicitacoes` + `/api/v1/lead-requests` = **só admin** (captador saiu do `CAPTADOR_ALLOWED`; o M25 T12/T13 previa outros papéis pedindo — seguir a regra nova). Página do lead (`LeadCard` detail): `PlanBlock` (cabeçalho em vidro + conteúdo no mesmo bloco, todos começam fechados), seções "Protocolo de contato" (Ligação, Mensagem) / "Reunião" (Agenda) / "Anotações"; situação da mensagem salva na hora, resultado da ligação só no "Concluir lead"; clicar no resultado/situação marcado desmarca; `lead_context` não é mais exibido. No celular: atalhos em bloco próprio abaixo do cabeçalho, status como selo pequeno, "Concluir lead" fora do card. `KpiCard` ganhou `change`/`changeLabel` (variação já calculada) e `sparkline={false}`; `FunnelChart` aceita `unit`/`showValue`. `SegmentedControl` sem `overflow-hidden` (pílula `-inset-[3px]`) e `w-fit`. `useCaptadores`/`useContactNiches` aceitam `{ enabled }`. `AddLeadModal` com prop `self` (captador). O `.env` local do backend aponta pro banco de produção — cuidado com migrations e scripts.
- **M26 T1 ✅**: `api.ts` com `timeout: 20_000`; o interceptor **não** tenta `/auth/refresh` em 401 de `/auth/(login|register|refresh)` (antes senha errada com sessão velha virava "Invalid or expired refresh token"); `LoginPage` mostra mensagens em pt-BR por caso. `.page-title::after` = linha reta 3px verde desenhada via `clip-path` (animação `pencilDraw`). **Dashboard**: `components/dashboard/CardHeader.tsx` (ícone + título + `CardAction`), `Sparkline.tsx` (SVG próprio, `pathLength` animado), `KpiCard` aceita `trend` (6 meses) e `lowerIsBetter` (ciclo médio) → etiqueta de variação vs mês anterior; `GET /reports/kpis` devolve `trends.{wonMtd,openDeals,conversionRate,avgCycleDays}` (SQL com `generate_series` de 6 meses). `RevenueChart` sempre mostra os últimos 6 meses no modo mensal (meses vazios = 0), área com brilho (filtro SVG) e ticks redondos (`niceTicks`). `FunnelChart` = colunas (líder em verde) dentro de painel interno que estica até a base do card. Seletor Hoje/7 dias/30 dias/Personalizado no Dashboard é **só visual** (não filtra). `useChartColors.brand` no escuro = `#2FA676` (validado pela skill dataviz; o `#4FD69C` da marca fica claro demais pra marcas de gráfico). **Pipeline**: `StageHeader` com ícone por nome da etapa (`stageIcon`: Users/ClipboardCheck/FileText/Handshake/Trophy/Flag), passa 6px pra fora da coluna (`-mx-4`), colunas com `gap-7`; total "em jogo" num rodapé `sticky bottom-0` da coluna; `KanbanCard` em vidro (`bg-fg/[0.035] backdrop-blur-xl`).
- **Banco local de simulação**: conta `luccaperiotto@gmail.com` (workspace `lucca-periotto`, plano **pro só no banco local**) com dados de exemplo e negócios com datas espalhadas em 6 meses. Depois de `git pull`, rodar `npm install` (o `main` passou a usar `xlsx` e `pdfjs-dist`; sem instalar, o Vite dá 500 e o app não abre).

- **Produção (desde 2026-10-26)**: site **https://crm-estus.vercel.app** (Vercel, Root Directory `packages/frontend`, env `VITE_API_URL`); backend **https://crm-production-6316.up.railway.app** (Railway, projeto "refreshing-miracle", build pelo `railway.json` → `packages/backend/Dockerfile`; health em `/health`) + Postgres do Railway (`DATABASE_URL=${{Postgres.DATABASE_URL}}`). `FRONTEND_URL` no Railway tem que ser exatamente `https://crm-estus.vercel.app` (URL inválida derruba o servidor na validação do `env.ts`; não usar o link temporário `-xxxx-estus1.vercel.app`). Push na `main` redeploya os dois. Migrations rodam sozinhas no start. Banco de produção começou vazio.

- **M25 🚧 — LeadHunter dentro do CRM (planejado 27/10/2026; T1 ✅ T2 ✅)**:
  - **T1 pronta:** `npm run test --workspace=packages/backend` (vitest; banco só via `TEST_DATABASE_URL`, que o guarda `assertTestDatabaseUrl` só aceita em host local e banco `*_test`, sem query além de `sslmode`; migrar sempre com `migrateTestDb()`); migration `20240037` (flag + `lh_*`, roda sozinha no boot do Railway, flag desligada); chaves de provedor vazias chegam como `''` → testar por veracidade. **T2 pronta:** `modules/leadhunter/domain.ts` puro; `fieldSources` é `Record<string,{source,url,observedAt}>`; `LINE_BREAKS` usa `new RegExp` de propósito. Rulings, desvios do Python e menores adiados em `docs/superpowers/progress/2026-10-27-m25-andamento.md`.
  - **O que vem do Radar Local:** todas as funções (campanhas DataForSEO/Jev, pontuação, cache de buscas, importar/exportar CSV, ficha, locais pesquisados, empresas já encontradas, consumo), **menos prévias de site**. Vão para o módulo novo `modules/leadhunter` + seção "LeadHunter" no frontend.
  - **Acesso:**
    - `/api/v1/leadhunter/*` = `requireAuth` → `requireLeadHunter` (404 se `tenants.leadhunter_enabled` é falso) → `requireRole('admin')`;
    - a flag liga **só por SQL** e nunca entra no `updateTenantSchema` (as chaves DataForSEO são da Estus);
    - o limite diário de chamadas é **global**.
  - **Pedidos (`/solicitacoes`):** mesmos campos do formulário do LeadHunter. Admin executa direto; os demais papéis pedem (`queued`) e o admin executa ou recusa. Entrega automática ao fim da campanha (`delivery.ts`).
  - **Peças novas:** worker dentro do processo (`FOR UPDATE SKIP LOCKED`, `recover()` no boot, supõe 1 instância no Railway); `vitest` só no backend (integração com `TEST_DATABASE_URL`, nunca o banco de dev/prod); migrações `20240037`/`20240038`.
  - **Corte (T15):** parar o Radar, importar o SQLite exportado, ligar a flag; rollback = desligar a flag.
  - **Remoções:** rotas do executor `/public/lead-requests` saem na T12; `/public/leads/bulk` sai na T15.
- **Fluxo de trabalho atual: direto na `main`** (pedido do usuário em 2026-10-26, após o M21 todas as outras branches foram apagadas). Não criar `feat/...` a menos que o usuário peça.
- **M24 T2 ✅ — pedidos de leads**: migration **20240036** (`lead_requests` com CHECK de status/quantidade, `contacts.lead_request_id`, `tenants.lead_request_max_quantity` 1–50 padrão 20 e `lead_request_daily_per_user` 0–50 padrão 3; **rodar `npm run migrate:latest` no banco de dev**, no Railway roda no boot). Módulo `modules/lead-requests`: JWT `/lead-requests` (criar/listar/ver/cancelar só `queued`; seller e captador só os próprios, admin/manager todos com `?userId=`; cota diária = pedidos não cancelados do dia em America/Sao_Paulo com advisory lock; captador liberado no `CAPTADOR_ALLOWED`) e executor `/public/lead-requests` (fila = `read`; `claim`/`progress`/`result` = `write`, **write não implica read**; claim por `UPDATE ... WHERE status='queued' RETURNING`, reserva de 30 min renovada por `progress`, vencida volta à fila na próxima leitura). `result` é **uma transação só** (portão de status, `importContactsBulk(..., { trx, leadRequestId })`, update final, `lead_assignments` se quem pediu é captador); notificação `lead_request.finished` depois do commit; dono = quem pediu se ainda ativo; só contatos novos ganham `lead_request_id`; mais leads que a quantidade → 422 `too_many_leads`. Cotas em `GET`/`PATCH /tenant` (admin). Frontend: `/solicitacoes` (`pages/lead-requests`, `hooks/useLeadRequests.ts`) e `LeadRequestQuotaForm` em Configurações. `errorHandler` devolve "Internal server error" em 5xx (antes vazava SQL). Verificado por curl (15 itens) e ponta a ponta com o worker do Radar Local em Postgres descartável; roteiro no plan.md. **Pendências**: validar em produção (autorização); sem token de reserva por executor; `topUpDailyLeads` não filtra por dono (leads de pedido de seller podem ir a captador); polimento da tela (erro de cotas, estado de erro da lista, a11y da linha expansível).
- **M24 T1 ✅ — envio de leads do LeadHunter**: migration **20240035** (`contacts.lead_score` 0–100 com CHECK, `contacts.external_id`, índice único parcial `(tenant_id, source, external_id)`; roda sozinha no Railway no boot, **rodar `npm run migrate:latest` no banco de dev**). Rotas `GET /public/users` (read) e `POST /public/leads/bulk` (write; até 500; `ownerEmail` = membro ativo; `source` forçado a `leadhunter`; resposta `{data:{imported,skipped,errors,items[{externalId,contactId,status,error?}]}}`); a chave precisa dos escopos **read e write** (write não implica read). `POST /public/contacts` agora valida com Zod; `createContact`/`updateContact` exigem `ownerId` membro ativo (422 `invalid_owner`). `importContactsBulk(tenantId, contacts, {ownerId, source})` devolve `items` (contrato antigo `imported/skipped/errors` preservado). `npm run build` do backend não faz typecheck → usar `npx tsc --noEmit -p packages/backend`. Verificado por curl em Postgres descartável (CRM sem testes automatizados; roteiro no plan.md).
- **M21 T1 — captação + empresa + mobile ✅**: papel `captador` (vínculo em `user_tenants`) vê só Painel (`/meu-painel`), Sobre a empresa, Meus leads, Reuniões e Minhas comissões — **Histórico foi removido** (o filtro "Todos" de Meus leads cobre). Leads em `lead_assignments` (módulo `captacao`); o status da ligação fica **só no estado local do `LeadCard`** e é enviado de uma vez em "Concluir lead" (antes cada clique ia ao servidor e era lento); "Reunião marcada" exige `meeting_at` + `meeting_mode` (`online`/`presencial`) + `meeting_location` opcional (validado no backend, `meeting_required`). `useUpdateMyLead` aplica a resposta direto no cache (`setQueriesData`). Contexto da empresa do lead: `contacts.lead_context` (cadastro manual, coluna "Contexto" da planilha ou texto único na importação). **Tenant**: `email` + `key_people` jsonb `[{name,title,email?}]`; `GET /tenant` devolve também `members` (membros ativos) e cai pro e-mail do admin mais antigo se `email` for null. Quem cria o workspace entra como "Fundador" (em `createWorkspace`); migration `20240028` preenche os antigos. Cargo personalizado é editado no `TeamPanel` (Configurações, coluna da direita — substituiu a tabela "Equipe"); `TeamRoster`/`TitleGroup` agrupam **pelo papel do sistema** (Admin, Captador…) e o cargo vira selo. Migrations novas **20240021–20240028 — rodar em produção**. **Backend dev**: o `tsx watch` às vezes não detecta mudanças no drive A: — se a API parecer desatualizada, reiniciar o `npm run dev:backend`.
- **M23 T2 ✅ — captação + calendário + layout**: **Meus leads**: `LeadCard` na lista é só resumo clicável (status à direita; no celular embaixo do nome) → `/meus-leads/lead/:id` (`MyLeadDetailPage`, `GET /captacao/me/leads/:id`, `useMyLead` com `initialData` da lista; `AppShell` libera o prefixo pro captador). Página: cabeçalho com atalhos + status; card "Ligação" = botão **Agenda** (abre Data e Hora/Online/Presencial) → resultado → anotações → concluir; escolher data/formato marca "Reunião marcada" e outro resultado limpa a reunião; "Sobre o lead" = ficha (empresa, cargo, segmento, endereço, recebido em) + possíveis dores. **Agenda dos admins** (`components/captacao/AdminAgenda.tsx`): `GET /captacao/me/admin-busy?from&to` devolve só horários ocupados (eventos com admin criador/participante + reuniões de captação sem evento) sem títulos; usa o mesmo `MonthView` do calendário (props `renderDay`, `dayClassName`, `selectedDate`, `allowPastClick`) + painel da reunião (hora em lista 7–20h com ocupados desativados, `DurationField`, admins, pessoas do cliente). Concluir com reunião cria/atualiza/remove um **evento no calendário** (`syncMeetingEvent`; colunas `lead_assignments.meeting_event_id/meeting_duration/meeting_attendee_ids/meeting_guests`, migrations **20240033–20240034**; só admins participam). **Calendário**: header "‹ Mês ›" sem "Hoje"; mês com `DayTag` (etiqueta) e painel do dia com `DayEventCard`; Semana/Dia = `TimeGrid` (blocos posicionados, linha do agora, abre nas 7h); Lista agrupada por dia; dias/horas passados escuros e sem criar evento; formulário com participantes (admins) e `external_attendees` (migration **20240032**); `DateField`/`TimeField`/`DurationField` em `components/calendar/DateTimeFields.tsx` (popover dentro de janela Radix é desenhado nela — senão a janela trava clique/rolagem). **Modal**: elementos `data-floating` não fecham a janela; prop `hideHeader`. **Layout**: `Topbar` virou header de ponta a ponta (sem busca — `TopbarSearch` ficou sem uso), com "espaço › tela", notas, caixa de entrada, foto + primeiro/último nome (menu da conta); menu lateral com fundo próprio leve e espaço no topo (logo recolhe/expande, nome troca de espaço); `md:py-3` no `AppShell`. Títulos em `.page-title`/`.page-title-sm` (Sora). `KpiCard` com ícone grande à esquerda.
- **M23 T1 ✅ — pipeline + topo**: `DragOverlay` do kanban renderiza em **portal no `body`** — o `.folder-surface` tem `backdrop-filter`, que vira referência de `position: fixed` e deixava a cópia longe do mouse (vale pra qualquer overlay/fixed dentro da pasta). Colisão própria `kanbanCollision` (`pointerWithin` priorizando card, `rectIntersection` de reserva; arrastando etapa só colunas com `closestCenter`). Ao soltar, o movimento é **otimista no cache** (`writeStageDeals` + ajuste de `dealCount/totalValue` no `kanban`) e o `move`/`reorder` roda em segundo plano, invalidando no fim. `KanbanCard` = wrapper `useSortable` + `DealCardView` (visão pura, usada também no overlay — não chamar `useSortable` na cópia); encaixe tracejado no lugar do card arrastado. `KanbanColumn`: bloco transparente `rounded-[24px]` com `StageHeader` sólido; destaque na cor da etapa via `isDropTarget`. **Topo**: foto abre o menu da conta (Minha conta/Tema/Sair) também no computador (sem botões de tema/sair soltos); notas foram do menu lateral para o lado da foto no computador (`md:fixed md:right-8` — não andam quando a pasta encolhe com as notas abertas); no celular sem lupa/busca e ícones maiores.
- **M22 T1 ✅ — convites**: `POST /users/invite` **não cria mais o vínculo**: grava em `workspace_invites` (migration **20240031**; chave = e-mail em minúsculas, 1 pendente por tenant/e-mail via índice parcial; status `pending/accepted/declined/canceled`). Vale para quem ainda não tem conta (aparece ao se cadastrar). Módulo `modules/invites`: `GET /invites` (convites da pessoa logada, em qualquer workspace), `POST /invites/:id/accept` (cria/reativa `user_tenants` com o papel do convite + notifica quem convidou) e `/decline`. Do lado do workspace: `GET /users/invites` e `DELETE /users/invites/:inviteId`. E-mail via Resend se `RESEND_API_KEY` (falha não bloqueia). Frontend: `hooks/useInvites.ts`, convites no topo do `NotificationPanel` (Aceitar/Recusar; o badge de `useNotifications` soma os convites), "Convites pendentes" no `TeamPanel`, `AddMemberModal` vira "Convidar". **Cadastro**: `RegisterPage` = "Criar conta" (nome, e-mail, senha); `workspaceName`/`slug` opcionais no backend → espaço "Espaço de <primeiro nome>", renomeável em Configurações; ainda redireciona para `/onboarding`.
- **M21 T4 ✅**: "Serviços e preços" agora é **arquivo** (PDF/DOCX, até 10 MB) — colunas `tenants.offer_file_data/mime/name/size` (migration **20240030**), rotas `GET/POST/DELETE /tenant/offer-file` (multer, POST/DELETE só admin); `GET /tenant` devolve só nome/tipo/tamanho. O texto antigo `tenants.offer` continua exibido na `CompanyPage` enquanto não houver arquivo, mas saiu do formulário. Frontend: `components/company/OfferFile.tsx` (`OfferFileField` no formulário, `OfferFileCard` com prop `bare` na página) + `DocumentPreview.tsx` (1ª página: `pdfjs-dist@4` com worker via `?url`, `docx-preview` reduzido com `transform`; ambos import dinâmico). `useOfferFileBlob`/`openOfferFile` em `hooks/useTenant.ts` (upload com `Content-Type: multipart/form-data` explícito — a instância axios é JSON). **Backend dev**: `npm run dev` agora roda `scripts/dev.cjs` (tsx watch com `CHOKIDAR_USEPOLLING`) — o drive A: não emitia eventos e a API ficava desatualizada. **Deploy Railway**: o serviço CRM parou de publicar sozinho após o commit `chore: railway.json` (não havia nem deploy "skipped"); publicar com Ctrl+K → "Deploy Latest Commit" até revisar Settings → Source. CD (GHCR) corrigido p/ contexto na raiz.
- **M21 T3 ✅**: `LeadCard` fica recolhido (setinha; no celular só o ícone no canto superior direito) e abre "Sobre o lead" (`lead_context` ou frase montada com o nicho) + **Possíveis dores** (`leadPains()`/`LEAD_PAIN_LABEL` em `lib/captacao.ts`, deduzidas de site/Instagram/Google) + resultado (dropdown no celular). Atalhos só com ícone via `components/ui/QuickLink.tsx`; ícones de marca em `BrandIcons.tsx` (`GmailIcon`, `InstagramIcon` com gradiente — `useId` sem `:`). **`SelectDropdown` renderiza o painel em portal (`position: fixed`)**, abre pra cima se faltar espaço e fecha ao rolar — aceita `placeholder`. **Empresa**: colunas `tenants.phone/instagram/website/address` (migration **20240029**), campos no `CompanyProfileForm` (agora dividido em 2 grupos; prop `className` p/ `mobile-split`) e atalhos na `CompanyPage` (e-mail saiu do texto, ficou só no ícone). Máscara de telefone: `formatPhone`/`withPhoneMask(register('phone'))` em `lib/utils.ts`. Configurações com `.mobile-sections` (card do perfil se desfaz em blocos no celular). Menu lateral mobile: X à esquerda, sem caixa de entrada, notas à direita.
- **M21 T2 ✅**: botão de transparência (`FolderGlassToggle`/`uiStore.folderGlass`/`html.folder-glass`) **removido** — `.folder-surface` é sempre translúcida (0.8 + blur) e `.folder-surface .card` sólido. **Tema por usuário**: `themeStore.themes[userId]`, ler sempre com `useTheme()` (default `'dark'`); `ThemeToggle` grava via `setTheme(userId, t)`. `DateTimePicker` aceita `renderTrigger({ open, date })` (usado no bloco "Agendar reunião" do `LeadCard`: folha de calendário + cartões Online/Presencial). `.mobile-sections` agora também em Pipeline, Contatos e Captação; abas da Captação no celular viram `SelectDropdown`; raízes de `CaptadoresTab`/`DistributeTab`/`TrackingTab` são `.mobile-split` (lista embrulhada num `<div>`). CORS: fora de produção aceita qualquer porta de `localhost`/`127.0.0.1` (Vite pode subir na 5174).
- **Mobile (M21)**: `MobileTabBar` (4 atalhos por papel + logo do espaço → `/empresa`; menu completo no hambúrguer). Topbar no celular: lupa (abre `TopbarSearch autoFocus` por cima), caixa de entrada e foto (menu com Minha conta/Tema/Sair). **`.mobile-sections`** (globals.css) no root da página: corpo da pasta transparente e cada filho direto vira bloco translúcido — card solto deve vir embrulhado num `<div>`; **`.mobile-split`** num agrupador faz cada filho virar bloco separado. Usado em Dashboard, Painel do captador, Meus leads, Comissões e Sobre a empresa. Pipeline no celular: grade de etapas + uma etapa por vez (`useIsMobile` em `hooks/useMediaQuery.ts`). Nada de rolagem lateral no celular (o usuário não gosta) — usar grades de 2 colunas ou dropdowns (`components/ui/SelectDropdown.tsx`). Scrollbar oculta no celular. Troca de tela animada (`pageMotion` + `useOutlet` no `AppShell`) e menus com `dropdownMotion` (`lib/motion.ts`; `transitionEnd` remove o `filter` pra não quebrar `backdrop-filter`/`position: fixed`). React Query Devtools removido. `kpi-highlight` (brilho do KPI) removido.

- **M20 T1 — temas + redesign ✅** (substitui a paleta Aurora Slate do M19): cores do Tailwind leem **variáveis CSS** (`rgb(var(--x) / <alpha-value>)`) definidas em `globals.css` para `:root` (escuro) e `:root[data-theme='light']`. Paleta de 3 cores: neutro Ink, **esmeralda** (`--accent-green`, marca) e **âmbar** (`--accent-amber`, destaque/"em aberto"); vermelho só funcional. Tokens novos: `fg` (tinta de sobreposição — use `bg-fg/[x]` em vez de `bg-white/[x]`), `field` (fundo de campos), `accent-amber`, `--on-accent` (texto sobre botão verde). **Mudou `tailwind.config.ts`? O Vite dev NÃO recarrega sozinho — reiniciar o `npm run dev:frontend`** (sintoma: classe "does not exist" ou cores antigas). Tema em `store/themeStore.ts` + `ThemeToggle` (topbar); aplicado só no `AppShell` (landing/login sempre escuros). Gráficos Recharts usam `hooks/useChartColors.ts` (SVG não resolve `var()`). **Fundo do app**: shader WebGL "Silk" (`components/ui/SilkShader.tsx`, `resolution` 0.5 no fundo) no `AppShell`, menu lateral transparente sobre ele (`.force-dark .sidebar-ink`). **Layout em pasta**: aba (`Topbar`, workspace + busca) + corpo arredondado, ambos `.folder-surface`; curva côncava da aba por **máscara**. `FolderGlassToggle` liga `html.folder-glass` (`--folder-alpha: 0.8` + blur; cards internos ficam sólidos), estado em `uiStore.folderGlass`. **Listas**: `components/ui/DataList.tsx` (card único, cabeçalho verde com faixa de 6px `accent-green-dim`, contorno verde 2,5px `.data-list-card`, linhas 1,5px, cascata + `AnimatePresence popLayout` + `layout`) — usado em Contatos e Negócios; tabelas `<table>` usam `.data-table` (Relatórios, Equipe); dias do calendário usam `.data-head`. Filtros: `components/ui/SegmentedControl.tsx` (pílula `layoutId`, preenche altura toda). Hooks de lista com `placeholderData: keepPreviousData` (a animação depende disso). **Nicho**: coluna `contacts.niche` (migration `20240020_add_niche_to_contacts` — **rodar em produção**), `GET /contacts/niches` (antes de `/:id`), `?niche=` na listagem, `NicheFilter` + campo com datalist no `ContactForm`. **Modais**: padrão único em `lib/motion.ts` (`dialogMotion` pop ~0,2s, `overlayMotion`, `centerTransform` p/ diálogos centrados com translate) aplicado em `Modal`, `UpgradeModal`, `ImportContactsModal`, `DateTimePicker` — Radix com `forceMount` + `AnimatePresence`. `WaveBackdrop` e `SearchModal` removidos.

- **M19 T1 — redesign visual ✅** (base pro redesign das outras telas): **paleta "Aurora Slate"** em `tailwind.config.ts` — `bg.primary #0a0d15`, `darker #07090f`, `surface #131926`, `border #1f2636`, textos azulados, verde `#72d296` segue como acento da marca + tokens `aurora.{green,teal,blue,violet}` (usar como luz/gradiente, nunca preenchimento grande); `status.open` = `#6b8cff`. Fonte do app: **Geist** (Inter vira fallback). **Vidro líquido**: `.card` em `globals.css` é translúcido (`backdrop-filter`) com reflexo de borda via `::before` mascarado — por isso `.card` tem `position: relative`; `.card-interactive` (hover com elevação), `.glass-panel` (dropdowns/painéis flutuantes, quase opaco), `.kpi-highlight` (halo verde só no KPI principal), `.app-backdrop` (fundo ambiente fixo com gradientes + grão, montado no `AppShell`). **Regra de brilho**: só o botão `primary` e o KPI principal brilham — não espalhar. **Menu lateral**: `src/components/ui/AnimatedSidebar.tsx` (framer-motion) + `layout/Sidebar.tsx`; recolhe por botão ou **Ctrl+B**, estado em `uiStore` persistido (`titanflow-ui`); só a largura externa anima, filhos em wrapper de largura fixa (não animar `width` de conteúdo — trava). `MotionConfig reducedMotion="never"` de propósito: a máquina do usuário tem efeitos de animação do Windows desligados e o framer cortava tudo. **Busca**: `components/search/TopbarSearch.tsx` inline no topo (Ctrl+K foca); `SearchModal` removido. Topbar e cabeçalho do menu têm `h-14` (bordas alinhadas). `LogoIcon` aceita `variant="aurora"`.
- **Preview visual local**: conta `preview@titanflow.local` / `Preview@1234` (workspace "Aurora Vendas", com contatos/negócios de exemplo) no banco local, usada pra screenshots com puppeteer-core + Chrome headless.
- **Dev local sem Docker**: PostgreSQL 18 nativo do Windows (serviço `postgresql-x64-18`, início manual), usuário `postgres`, banco `titancrm` (testes do M25: `titancrm_test`). A senha antiga anotada aqui não autentica mais (26/10/2026): pedir ao usuário. O backend não tem `.env` local hoje.

- **M18 T1 — config de produção ✅**: callback do Google OAuth usa `BACKEND_URL` (novo env, default `http://localhost:3001`) — antes derivava de `FRONTEND_URL.replace(':5173', ':3001')` e quebrava em prod. Remetente dos convites vem de `EMAIL_FROM` (default `TitanFlow <onboarding@resend.dev>`). Páginas públicas `/privacidade` e `/termos` em `src/pages/legal/LegalPages.tsx` (exigidas pelo Google para publicar o OAuth consent screen). `packages/frontend/vercel.json` com rewrite SPA (sem ele deep links como `/auth/callback` davam 404 no Vercel — se o Root Directory do Vercel for a raiz do repo, mover o arquivo). CI backend estava vermelho no main com 2 erros tsc (`deal.reopened` fora de `SUPPORTED_EVENTS`; `ipKeyGenerator(req)` → `ipKeyGenerator(req.ip ?? '')`) — corrigidos. Número WhatsApp já é real (`5516992386188`).
- **Pendências para usuários reais (auditoria 2026-09-28)**: (1) rate limiter nunca atua — `tierRateLimiter` roda antes do `requireAuth` e faz `skip` quando `!req.user`; falta limite no `/auth/login` e `app.set('trust proxy', 1)`; (2) webhook Stripe `customer.subscription.updated` lê plano de `price.metadata.plan` e cai p/ `'free'` se ausente — rebaixa pagantes na renovação; `past_due`/`invoice.payment_failed` não tratados; (3) login por senha de usuário só-Google dá 500 (`bcrypt.compare` com hash null); (4) sem 'esqueci minha senha'; (5) convite manda senha temporária (`Math.random`) no e-mail; (6) tokens do Google no query string do `/auth/callback`; (7) zero testes automatizados. Sem domínio próprio o Resend só entrega pro dono da conta — em prod sem domínio, remover `RESEND_API_KEY` faz a UI mostrar a senha temporária.
- **Dev local**: se existir PostgreSQL nativo do Windows (serviço `postgresql-x64-18`) ele ocupa a porta 5432 e o backend conecta nele em vez do container → `28P01 password authentication failed` (mensagem em pt-BR denuncia). Parar o serviço ou mapear o container em outra porta.
- **Produto renomeado para TitanFlow** — browser tab, auth pages, onboarding, landing page e sidebar atualizados; sidebar top-left exibe fixo "TitanFlow" (não mais o nome do tenant)
- All 8 milestones complete + M9/M10/M11/M12/M13/M14(T1+T2+T3+T4) done. Latest migrations: `20240018_create_user_tenants`, `20240019_add_assignee_to_activities`
- **Kanban lazy load (M14 T3)**: `GET /deals/kanban` retorna apenas metadados dos stages (`dealCount`, `totalValue` via agregação SQL, sem deals). Novo `GET /deals/kanban-stage/:stageId?page=N` retorna deals paginados (20/pág) com `hasMore`. Frontend: `useInfiniteStageDeals(stageId)` com `useInfiniteQuery`; `KanbanColumn` busca seus próprios deals e exibe botão "Carregar mais". `PipelinePage` usa `optimisticDealsMap` (snapshot dos caches por stage) durante drag para manter estado visual fluido sem depender do `localStages.deals`. `StageMeta` (sem deals) substituiu `StageWithDeals` nas props do `KanbanColumn` e `PipelineSettingsModal` — este último usa `dealCount` em vez de `deals.length`.
- **Export atividades (M14 T2)**: `GET /activities/export` com joins em contact, deal, creator (`user_id`) e assignee; delimiter `;` (pt-BR); headers sem acentos; `requireTier('starter')`. Frontend: card na aba Export da `ReportsPage`, Free vê cadeado → `UpgradeModal`. Bug corrigido em `reports.service.ts`: `a.owner_id` → `a.user_id` (causava erro 42703 na aba Atividades dos Relatórios).
- **Deals lista (M14 T1)**: `DealsListPage` tem busca textual (`q`) por título e nome do contato (ILIKE), paginação real (20/página, Anterior/Próxima, indicador de página). Backend `listDeals` aceita `q`; COUNT corrigido com join em contacts. `useDeals` tipado sem index signature.
- **Calendário redesign (M14 T4)**: FullCalendar removido e substituído por `EventManagerCalendar` customizado (`src/components/calendar/EventManagerCalendar.tsx`). 4 views (Mês/Semana/Dia/Lista), toolbar com navegação e switcher, painel lateral deslizante para criar/editar/excluir. Campo "fim" substituído por select de Duração. `DateTimePicker` (`src/components/ui/DateTimePicker.tsx`) usa `react-day-picker` + `createPortal` — abre modal centralizado na tela com calendário à esquerda e lista de horas (00:00–23:00, 1h em 1h) à direita. Zero dependência de shadcn/ui; design 100% TitanFlow dark.
- **Multi-workspace**: tabela `user_tenants` (pivot user↔tenant com role). `GET /auth/workspaces` + `POST /auth/switch-workspace` emitem novos tokens para o tenant selecionado. `WorkspaceSwitcher` no Topbar lista workspaces e troca com `qc.clear()`. `register` e `inviteUser` inserem automaticamente em `user_tenants`.
- **Atividades com responsável**: coluna `assignee_id` em `activities` (FK → users, SET NULL). `ActivityForm` tem select "Responsável" — ao salvar, notificação é disparada para o assignee se diferente do criador. `ActivityTimeline` exibe "resp: Nome" em verde.
- **Deal responsável editável**: `DealDetailPage` tem inline edit do owner (hover → lápis → select → check/cancel) via `useUpdateDeal({ ownerId })`.
- `must_change_password` field on `users` — set `true` on invite, cleared on `PATCH /auth/me`
- `ChangePasswordModal` + `UpgradeModal` mounted in `AppShell` (global)
- `ErrorBoundary` wraps `<Outlet />` in AppShell — catches all page-level crashes
- `GET /search?q=` — ILIKE search across contacts, deals, activities (min 2 chars); bug corrigido: `activities` usa coluna `body` (não `notes`) — causava erro 42703 na busca global
- **Resend (convite de usuários)**: integração ativa em `users.service.ts`. `RESEND_API_KEY` já configurado no `.env`. E-mail de convite usa remetente `TitanFlow <onboarding@resend.dev>`, subject dinâmico com nome do workspace (`tenants.name`) e template com branding TitanFlow. Sem domínio verificado no Resend: só entrega para o próprio e-mail da conta Resend (limitação do plano Free) — para enviar para qualquer destinatário, verificar domínio próprio nos DNS do Resend.
- **M16 — Landing Page redesign ✅**: `LandingPage.tsx` reescrita por completo (registro brand `/impeccable`, contexto em `PRODUCT.md`). Stack: `gsap@3.15` + ScrollTrigger, fontes Sora (display) + Geist (body) carregadas em `index.html` e mapeadas no Tailwind (`font-display`/`font-body`). Hook `useGsapContext` (`src/hooks/useGsapContext.ts`) escopa as animações a um ref, faz `ctx.revert()` no unmount e recebe flag `reduced` p/ `prefers-reduced-motion`. CSS da landing escopado em `.landing` no `globals.css` (tokens OKLCH `--lp-*`, `.lp-bloom`, `.lp-grid`, `.lp-pro-card` glow conic, `.lp-feature-hero`, `.lp-cta-wash`). **9 seções**: hero (headline Sora left-aligned + Kanban recriado em HTML/CSS fiel ao app + timeline GSAP set+to + parallax) → barra de counters hero-metric (`StatCounter`, sem eyebrow) → dor/solução (`divide-y`, sem card-boxing) → features bento assimétrico (big card com `lp-feature-hero` tint+glow, pequenas sem border) → citação honesta (sem depoimentos fictícios) → pricing (PRO com glow+scale+fill real, Free/Starter em outline quieto) → FAQ accordion (`grid-template-rows` tween, sem eyebrow) → CTA final → footer. **Aprendizados críticos**: (1) usar `gsap.set()+.to()` no hero, não `.from()` (que deixava CTA preso em opacity:0 quando `ScrollTrigger.refresh()` reavaliava); (2) `min-w-0` nas colunas do grid e nos feature cards/stat items — o mockup de 4 colunas e stats com escala grande forçavam largura > viewport e cortavam texto no mobile; (3) `overflow-x-hidden` no root. Validado via Playwright em 1440px/390px/reduced-motion. Métricas do hero/counters são placeholders (12.000+, <5min, etc.) — trocar por reais quando disponíveis.
- **M16 audit fix (redesign-existing-projects + design-taste-frontend)**: primeira versão da landing tinha fingerprint AI-slop — cards idênticos em pain/features/pricing (mesmo border+bg-surface+rounded-2xl repetido), eyebrow verde em toda seção (6 no total), stats do mesmo peso visual que h2 de seção, PRO card sem diferenciação real do Free/Starter, ritmo vertical mecânico (`py-24` em tudo). Corrigido com dials `DESIGN_VARIANCE=5 MOTION_INTENSITY=3 VISUAL_DENSITY=6`: eyebrows reduzidos a 3 (hero+features+pricing, dentro do limite `ceil(seções/3)`), pain section virou lista `divide-y` sem card-box, big feature card ganhou classe `.lp-feature-hero` (tint verde + glow permanente) enquanto small features perderam border, PRO ganhou `scale-[1.04]` + glow conic mais denso + fill enquanto Free/Starter viraram outline puro (`background: transparent`), stats escalaram pra `text-4xl→6xl` com `min-w-0 truncate` e grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (1 coluna no mobile evita overflow do número grande).
- **M17 — Audit + fix dashboard/telas internas ✅**: skill `redesign-existing-projects` apontou drift em `DashboardPage`, `ContactsPage`, `DealsListPage`, `ReportsPage` — cada página tinha seu próprio `space-y-`/`p-` copiado à mão (`space-y-6` vs `space-y-5`, `card p-5` vs `p-4`), bloco `h1`+subtítulo duplicado com `mt-1` vs `mt-0.5` divergentes, e o valor do `KpiCard` (`text-2xl`) do mesmo tamanho que o `h1` da página — números mais importantes do dashboard não dominavam a hierarquia. Corrigido mantendo o dark theme da marca (skill `minimalist-ui` pede paleta off-white/bone — usada só pros princípios de espaçamento/densidade, **não** pra cor, confirmado com o usuário). Fix: componente novo `src/components/ui/PageHeader.tsx` (title/subtitle/actions) substitui o bloco duplicado nas 3 páginas; `KpiCard` value `text-2xl→text-3xl` + `tabular-nums`; todas as 4 páginas em `space-y-5` e `card p-4`/`gap-3` consistentes; saudação do Dashboard rebaixada de `h1` pra texto secundário (não competia mais com os KPIs); `ActivityFeed` no Dashboard ganhou link "Ver todas" (antes só mostrava 8 itens sem saída).
- **Skills globais instaladas** (`~/.claude/skills/` → symlink pra `~/.agents/skills/`): `design-taste-frontend` (+v1), `high-end-visual-design`, `redesign-existing-projects`, `minimalist-ui`, `industrial-brutalist-ui`, `gpt-taste`, `stitch-design-taste`, `full-output-enforcement`, `brandkit`, `image-to-code`, `imagegen-frontend-web`, `imagegen-frontend-mobile`. **Cuidado**: `npx skills add` sem `cd ~` primeiro instala no cwd atual — já vazou `.agents/`, `.claude/skills/`, `skills-lock.json` neste repo por engano uma vez (removido, não commitado). Sempre `cd ~` antes de instalar skill global e conferir `git status` depois.
- **Equipe (SettingsPage)**: menu `...` por membro com **Reenviar convite** (`POST /users/:id/resend-invite` — regera senha + reenvia e-mail) e **Excluir usuário** (`DELETE /users/:id` — confirmação inline, protegido contra auto-exclusão). Dropdown usa `position: fixed` + `getBoundingClientRect` para escapar do `overflow: hidden`. Fix: `import bcrypt from 'bcryptjs'` estático (corrige `TypeError: bcrypt.hash is not a function` no import dinâmico).
- **Usuário local de teste**: `teste2@gmail.com` / senha `Admin@1234`, tenant `teste` no plano `pro` — concedido manualmente via UPDATE no banco local
- `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`, `GET /notifications/unread-count`
- Notifications auto-fired on `deal.won`, `deal.lost`, `deal.stage_changed` — notifies all tenant users except the actor
- Cmd+K triggers `SearchModal` (global keyboard listener in Topbar)
- Notification bell in Topbar with unread badge; `NotificationPanel` dropdown (polls every 30s)
- Skeletons: `TableSkeleton`, `KanbanSkeleton`, `CardSkeleton` in `src/components/ui/Skeleton.tsx`
- `EmptyState` component in `src/components/ui/EmptyState.tsx` — used in Contacts and Deals list pages
- Mobile: hamburger button in AppShell opens sidebar overlay on `< md` screens
- Production deploy: Railway (backend via `railway.json` → `packages/backend/Dockerfile`, Postgres do Railway) + Vercel (frontend)
- CI: `.github/workflows/ci.yml` — tsc type-check on backend + frontend on PR and push to main (o CD para GHCR foi removido em 27/10/2026: falhava em todo push e não era usado)
- Stripe: `payment_method_types: ['card']` set in `billing.service.ts` — fixes checkout for BRL accounts
- Stripe webhook uses raw body — registered before `express.json()` in `server.ts`
- `upgradeStore` (Zustand) holds `{ open, requiredPlan, showUpgrade, closeUpgrade }`
- Rate limiting: `tierRateLimiter` on all `/api/v1/*` (100/1000/10000 req/day by plan)
- API keys: prefix `tlk_`, SHA-256 hash stored, admin only, `starter` tier gated
- Public API via `X-API-Key`: `GET /api/v1/public/contacts`, `/public/deals`, `POST /public/contacts`
- Webhooks HMAC-signed with `X-Titan-Signature: sha256=<hmac>`
- `LandingPage` at `src/pages/landing/LandingPage.tsx` — public route `/`, redirects auth'd users to `/dashboard`; WhatsApp floating button (expand-on-hover)
- `AppShell` has WhatsApp floating button (icon-only, bottom-right)
- `useTenant()` hook (`src/hooks/useTenant.ts`) — calls `GET /tenant`, used in Dashboard + ReportsPage
- `PipelineSettingsModal` supports inline stage rename: click pencil → edit in place → Enter/✓ confirms, Escape cancels
- `ContactForm` has `ownerId` field (select from active users via `useUsers()`), mapped to `owner_id` on backend
- Free plan contact limit: 300 contacts — `contacts.service.ts` checks COUNT before insert, throws 402 with `{ code: 'upgrade_required', requiredPlan: 'starter' }`
- `errorHandler.ts` now forwards `status`, `code`, `requiredPlan` from thrown errors (for 4xx non-Zod errors)
- `ReportsPage` — Activities + Leaderboard tabs gated to Starter+; Free sees lock icon + `UpgradeModal` on click
- `DashboardPage` — shows contact usage progress bar (green/amber/red) for Free plan; "Fazer upgrade" CTA at 80%+
- `RegisterPage` — simplified to 4 fields (workspace name, full name, email, password); slug auto-generated via `generateSlug()`; redirects to `/onboarding` after register
- **OAuth Google**: `GET /api/v1/auth/google` + `/auth/google/callback` (passport-google-oauth20); only mounted if `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` are set in `.env`; new users auto-create tenant; `password_hash` is nullable (migration 20240015)
- `GoogleButton` component at `src/components/auth/GoogleButton.tsx`; shown in LoginPage and RegisterPage
- `AuthCallbackPage` at `/auth/callback` — reads `accessToken`/`refreshToken`/`isNew` from query string; redirects to `/onboarding` if new user, `/dashboard` if existing
- `OnboardingPage` at `/onboarding` (ProtectedRoute) — Step 1: create pipeline + 4 default stages; Step 2: optional team invite
- **Pending infra tasks**: (1) Google OAuth: preencher Branding (home/privacy/terms URLs), publicar app, criar Web client e setar `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`BACKEND_URL` no Railway; (2) configure Stripe webhook URL (funciona com `*.up.railway.app`, domínio próprio não é obrigatório)
- Backend Dockerfile (build do Railway) usa contexto na raiz do repo (lockfile dos workspaces npm); CMD `node_modules/.bin/tsx packages/backend/src/server.ts`. Migrations em produção rodam sozinhas no boot.
- `rateLimiter.ts` uses `ipKeyGenerator` from `express-rate-limit` to handle IPv6 addresses correctly

## Kanban / Pipeline — notas críticas (M11)

- **Drag & drop fix**: `dragOriginStageId` (useRef) captura o stage original no `handleDragStart`; `handleDragEnd` usa esse ref em vez de buscar em `localStages` (que já foi modificado pelo `handleDragOver`) — evita que o card reverta para a coluna original
- **Scroll horizontal**: `onWheel` no container do kanban converte `deltaY` em `scrollLeft` — permite navegar entre colunas com a roda do mouse
- **KanbanColumn header**: card com `borderLeft` na cor da etapa, nome em uppercase + tracking-widest na cor da etapa, valor total abaixo, badge de contagem
- **KanbanCard**: título branco bold, valor em verde grande, nome do contato abaixo, linha separadora + owner + data (vermelha se vencida), botões Ganho/Perdido aparecem no hover
- **`onWon` / `onLost`** assinam `(id: string, title: string) => void` — o title é usado no toast com botão "Desfazer"
- **Toast com Desfazer**: após marcar Ganho/Perdido no kanban, toast chama `markOpen.mutate(id)` no clique de Desfazer

## Deals — status transitions (M11)

- `PATCH /deals/:id/open` — endpoint de reabertura (sets `status='open'`, limpa `closed_at` e `lost_reason`)
- `useMarkOpen()` hook em `usePipeline.ts`
- `useDeleteDeal()` invalida tanto `pipelineKeys.all` (`['pipelines']`) quanto `['deals']` para atualizar `DealsListPage`
- `DealDetailPage`: botões contextuais por status — open→(Ganho, Perdido), won→(Reabrir, Marcar perdido), lost→(Reabrir, Marcar ganho); botão Excluir sempre visível
- Botão "Perdido" usa variante `warning` (laranja) do Button; "Excluir" usa `danger` (vermelho)
- `deleteDeal` no backend roda em transação: deleta deal + limpa `audit_logs` (resource_type='deal') + `notifications` (resource_id=id); `activities` cascateia automaticamente pelo FK
- `navigate(-1)` na seta de voltar do `DealDetailPage`; exclusão redireciona para `/deals`
