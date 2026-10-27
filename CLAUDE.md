# TitanFlow — CLAUDE.md

This file documents everything an AI assistant needs to know to contribute effectively to this project.

---

## Workflow obrigatório (seguir sempre, sem precisar ser lembrado)

### Ao iniciar qualquer sessão
1. Ler este `CLAUDE.md` e o `plan.md` para se contextualizar
2. Ler `memory/project-state.md` e `memory/feedback-dev-workflow.md`

### Ao iniciar qualquer feature ou modificação
1. Trabalhar direto na `main` (decisão do usuário em 2026-10-26 — não criar branch `feat/...` a menos que ele peça)
2. Implementar o que foi pedido
3. Rodar build do frontend (`npm run build --workspace=packages/frontend`) para confirmar zero erros TS antes de commitar

### Quando o usuário disser "pode commitar"
Executar **tudo isso automaticamente, sem precisar ser pedido**:
1. `git add` nos arquivos alterados
2. `git commit` com mensagem descritiva no padrão `feat(MXX-TX): descrição`
3. Atualizar `CLAUDE.md` — marcar milestone como `✅ Done` e atualizar seção **Key implementation notes**
4. Atualizar `memory/project-state.md` — refletir o estado atual do projeto
5. Commit das atualizações de documentação: `docs: atualiza CLAUDE.md e memória pós MXX-TX`
6. `git push` da `main` (sem PR — trabalho direto na main)

### Quando o usuário disser "atualize a memória"
1. Atualizar `memory/project-state.md` com estado atual, últimas decisões e próximas tarefas
2. Atualizar `MEMORY.md` se necessário
3. Commitar: `docs: atualiza memória do projeto`

### Docker — nome do serviço correto
O serviço do banco neste projeto se chama `postgres` (não `db`):
```bash
docker compose exec postgres psql -U postgres -d titancrm
```
Sempre rodar comandos Docker da **raiz do repositório**.

---

## Project Overview

**TitanFlow** (formerly Titan Labs CRM) is a multi-tenant SaaS CRM for managing leads, contacts, deals, and sales pipelines. Companies sign up and get an isolated workspace. The product replaces scattered tools (WhatsApp, spreadsheets) with a centralized Kanban-first platform.

**Key personas**: Seller (manages leads/deals), Manager (analytics + team config), Admin (billing + workspace ownership).

---

## Monorepo Structure

```
CRMTitanLabs/
├── packages/
│   ├── backend/        # Express + TypeScript + Knex + PostgreSQL
│   └── frontend/       # React + Vite + TypeScript + Tailwind CSS
├── CLAUDE.md
├── plan.md
├── package.json        # npm workspaces root
└── docker-compose.yml  # Postgres 16 + pgAdmin
```

Run commands from the **repo root** unless noted otherwise.

---

## Commands

```bash
# Start local DB
docker compose up -d

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

1. `tenantScope` middleware extracts `tenant_id` from the decoded JWT and sets `req.tenantId`.
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

## Next: M23 T2 — pedidos de leads feitos no CRM e atendidos pelo LeadHunter (desenho em `LeadHunter/docs/PLANO_INTEGRACAO.md` seção 6); demais itens no backlog de [plan.md](./plan.md) (Z-API, webhook Stripe prod, Google OAuth prod)

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
| M23 T1 | Envio de leads do LeadHunter pela API pública (leads/bulk, public/users), migration 20240032 | ✅ Done |
| M23 T2 | Pedidos de leads do CRM atendidos pelo LeadHunter | 🔲 Pendente |

## Key implementation notes (context for future sessions)

- **Produção (desde 2026-10-26)**: site **https://crm-estus.vercel.app** (Vercel, Root Directory `packages/frontend`, env `VITE_API_URL`); backend **https://crm-production-6316.up.railway.app** (Railway, projeto "refreshing-miracle", build pelo `railway.json` → `packages/backend/Dockerfile`; health em `/health`) + Postgres do Railway (`DATABASE_URL=${{Postgres.DATABASE_URL}}`). `FRONTEND_URL` no Railway tem que ser exatamente `https://crm-estus.vercel.app` (URL inválida derruba o servidor na validação do `env.ts`; não usar o link temporário `-xxxx-estus1.vercel.app`). Push na `main` redeploya os dois. Migrations rodam sozinhas no start. Banco de produção começou vazio.

- **Fluxo de trabalho atual: direto na `main`** (pedido do usuário em 2026-10-26, após o M21 todas as outras branches foram apagadas). Não criar `feat/...` a menos que o usuário peça.
- **M23 T1 ✅ — envio de leads do LeadHunter**: migration **20240032** (`contacts.lead_score` 0–100 com CHECK, `contacts.external_id`, índice único parcial `(tenant_id, source, external_id)`; roda sozinha no Railway no boot, **rodar `npm run migrate:latest` no banco de dev**). Rotas `GET /public/users` (read) e `POST /public/leads/bulk` (write; até 500; `ownerEmail` = membro ativo; `source` forçado a `leadhunter`; resposta `{data:{imported,skipped,errors,items[{externalId,contactId,status,error?}]}}`); a chave precisa dos escopos **read e write** (write não implica read). `POST /public/contacts` agora valida com Zod; `createContact`/`updateContact` exigem `ownerId` membro ativo (422 `invalid_owner`). `importContactsBulk(tenantId, contacts, {ownerId, source})` devolve `items` (contrato antigo `imported/skipped/errors` preservado). `npm run build` do backend não faz typecheck → usar `npx tsc --noEmit -p packages/backend`. Verificado por curl em Postgres descartável (CRM sem testes automatizados; roteiro no plan.md).
- **M21 T1 — captação + empresa + mobile ✅**: papel `captador` (vínculo em `user_tenants`) vê só Painel (`/meu-painel`), Sobre a empresa, Meus leads, Reuniões e Minhas comissões — **Histórico foi removido** (o filtro "Todos" de Meus leads cobre). Leads em `lead_assignments` (módulo `captacao`); o status da ligação fica **só no estado local do `LeadCard`** e é enviado de uma vez em "Concluir lead" (antes cada clique ia ao servidor e era lento); "Reunião marcada" exige `meeting_at` + `meeting_mode` (`online`/`presencial`) + `meeting_location` opcional (validado no backend, `meeting_required`). `useUpdateMyLead` aplica a resposta direto no cache (`setQueriesData`). Contexto da empresa do lead: `contacts.lead_context` (cadastro manual, coluna "Contexto" da planilha ou texto único na importação). **Tenant**: `email` + `key_people` jsonb `[{name,title,email?}]`; `GET /tenant` devolve também `members` (membros ativos) e cai pro e-mail do admin mais antigo se `email` for null. Quem cria o workspace entra como "Fundador" (em `createWorkspace`); migration `20240028` preenche os antigos. Cargo personalizado é editado no `TeamPanel` (Configurações, coluna da direita — substituiu a tabela "Equipe"); `TeamRoster`/`TitleGroup` agrupam **pelo papel do sistema** (Admin, Captador…) e o cargo vira selo. Migrations novas **20240021–20240028 — rodar em produção**. **Backend dev**: o `tsx watch` às vezes não detecta mudanças no drive A: — se a API parecer desatualizada, reiniciar o `npm run dev:backend`.
- **M22 T1 ✅ — convites**: `POST /users/invite` **não cria mais o vínculo**: grava em `workspace_invites` (migration **20240031**; chave = e-mail em minúsculas, 1 pendente por tenant/e-mail via índice parcial; status `pending/accepted/declined/canceled`). Vale para quem ainda não tem conta (aparece ao se cadastrar). Módulo `modules/invites`: `GET /invites` (convites da pessoa logada, em qualquer workspace), `POST /invites/:id/accept` (cria/reativa `user_tenants` com o papel do convite + notifica quem convidou) e `/decline`. Do lado do workspace: `GET /users/invites` e `DELETE /users/invites/:inviteId`. E-mail via Resend se `RESEND_API_KEY` (falha não bloqueia). Frontend: `hooks/useInvites.ts`, convites no topo do `NotificationPanel` (Aceitar/Recusar; o badge de `useNotifications` soma os convites), "Convites pendentes" no `TeamPanel`, `AddMemberModal` vira "Convidar". **Cadastro**: `RegisterPage` = "Criar conta" (nome, e-mail, senha); `workspaceName`/`slug` opcionais no backend → espaço "Espaço de <primeiro nome>", renomeável em Configurações; ainda redireciona para `/onboarding`.
- **M21 T4 ✅**: "Serviços e preços" agora é **arquivo** (PDF/DOCX, até 10 MB) — colunas `tenants.offer_file_data/mime/name/size` (migration **20240030**), rotas `GET/POST/DELETE /tenant/offer-file` (multer, POST/DELETE só admin); `GET /tenant` devolve só nome/tipo/tamanho. O texto antigo `tenants.offer` continua exibido na `CompanyPage` enquanto não houver arquivo, mas saiu do formulário. Frontend: `components/company/OfferFile.tsx` (`OfferFileField` no formulário, `OfferFileCard` com prop `bare` na página) + `DocumentPreview.tsx` (1ª página: `pdfjs-dist@4` com worker via `?url`, `docx-preview` reduzido com `transform`; ambos import dinâmico). `useOfferFileBlob`/`openOfferFile` em `hooks/useTenant.ts` (upload com `Content-Type: multipart/form-data` explícito — a instância axios é JSON). **Backend dev**: `npm run dev` agora roda `scripts/dev.cjs` (tsx watch com `CHOKIDAR_USEPOLLING`) — o drive A: não emitia eventos e a API ficava desatualizada. **Deploy Railway**: o serviço CRM parou de publicar sozinho após o commit `chore: railway.json` (não havia nem deploy "skipped"); publicar com Ctrl+K → "Deploy Latest Commit" até revisar Settings → Source. CD (GHCR) corrigido p/ contexto na raiz.
- **M21 T3 ✅**: `LeadCard` fica recolhido (setinha; no celular só o ícone no canto superior direito) e abre "Sobre o lead" (`lead_context` ou frase montada com o nicho) + **Possíveis dores** (`leadPains()`/`LEAD_PAIN_LABEL` em `lib/captacao.ts`, deduzidas de site/Instagram/Google) + resultado (dropdown no celular). Atalhos só com ícone via `components/ui/QuickLink.tsx`; ícones de marca em `BrandIcons.tsx` (`GmailIcon`, `InstagramIcon` com gradiente — `useId` sem `:`). **`SelectDropdown` renderiza o painel em portal (`position: fixed`)**, abre pra cima se faltar espaço e fecha ao rolar — aceita `placeholder`. **Empresa**: colunas `tenants.phone/instagram/website/address` (migration **20240029**), campos no `CompanyProfileForm` (agora dividido em 2 grupos; prop `className` p/ `mobile-split`) e atalhos na `CompanyPage` (e-mail saiu do texto, ficou só no ícone). Máscara de telefone: `formatPhone`/`withPhoneMask(register('phone'))` em `lib/utils.ts`. Configurações com `.mobile-sections` (card do perfil se desfaz em blocos no celular). Menu lateral mobile: X à esquerda, sem caixa de entrada, notas à direita.
- **M21 T2 ✅**: botão de transparência (`FolderGlassToggle`/`uiStore.folderGlass`/`html.folder-glass`) **removido** — `.folder-surface` é sempre translúcida (0.8 + blur) e `.folder-surface .card` sólido. **Tema por usuário**: `themeStore.themes[userId]`, ler sempre com `useTheme()` (default `'dark'`); `ThemeToggle` grava via `setTheme(userId, t)`. `DateTimePicker` aceita `renderTrigger({ open, date })` (usado no bloco "Agendar reunião" do `LeadCard`: folha de calendário + cartões Online/Presencial). `.mobile-sections` agora também em Pipeline, Contatos e Captação; abas da Captação no celular viram `SelectDropdown`; raízes de `CaptadoresTab`/`DistributeTab`/`TrackingTab` são `.mobile-split` (lista embrulhada num `<div>`). CORS: fora de produção aceita qualquer porta de `localhost`/`127.0.0.1` (Vite pode subir na 5174).
- **Mobile (M21)**: `MobileTabBar` (4 atalhos por papel + logo do espaço → `/empresa`; menu completo no hambúrguer). Topbar no celular: lupa (abre `TopbarSearch autoFocus` por cima), caixa de entrada e foto (menu com Minha conta/Tema/Sair). **`.mobile-sections`** (globals.css) no root da página: corpo da pasta transparente e cada filho direto vira bloco translúcido — card solto deve vir embrulhado num `<div>`; **`.mobile-split`** num agrupador faz cada filho virar bloco separado. Usado em Dashboard, Painel do captador, Meus leads, Comissões e Sobre a empresa. Pipeline no celular: grade de etapas + uma etapa por vez (`useIsMobile` em `hooks/useMediaQuery.ts`). Nada de rolagem lateral no celular (o usuário não gosta) — usar grades de 2 colunas ou dropdowns (`components/ui/SelectDropdown.tsx`). Scrollbar oculta no celular. Troca de tela animada (`pageMotion` + `useOutlet` no `AppShell`) e menus com `dropdownMotion` (`lib/motion.ts`; `transitionEnd` remove o `filter` pra não quebrar `backdrop-filter`/`position: fixed`). React Query Devtools removido. `kpi-highlight` (brilho do KPI) removido.

- **M20 T1 — temas + redesign ✅** (substitui a paleta Aurora Slate do M19): cores do Tailwind leem **variáveis CSS** (`rgb(var(--x) / <alpha-value>)`) definidas em `globals.css` para `:root` (escuro) e `:root[data-theme='light']`. Paleta de 3 cores: neutro Ink, **esmeralda** (`--accent-green`, marca) e **âmbar** (`--accent-amber`, destaque/"em aberto"); vermelho só funcional. Tokens novos: `fg` (tinta de sobreposição — use `bg-fg/[x]` em vez de `bg-white/[x]`), `field` (fundo de campos), `accent-amber`, `--on-accent` (texto sobre botão verde). **Mudou `tailwind.config.ts`? O Vite dev NÃO recarrega sozinho — reiniciar o `npm run dev:frontend`** (sintoma: classe "does not exist" ou cores antigas). Tema em `store/themeStore.ts` + `ThemeToggle` (topbar); aplicado só no `AppShell` (landing/login sempre escuros). Gráficos Recharts usam `hooks/useChartColors.ts` (SVG não resolve `var()`). **Fundo do app**: shader WebGL "Silk" (`components/ui/SilkShader.tsx`, `resolution` 0.5 no fundo) no `AppShell`, menu lateral transparente sobre ele (`.force-dark .sidebar-ink`). **Layout em pasta**: aba (`Topbar`, workspace + busca) + corpo arredondado, ambos `.folder-surface`; curva côncava da aba por **máscara**. `FolderGlassToggle` liga `html.folder-glass` (`--folder-alpha: 0.8` + blur; cards internos ficam sólidos), estado em `uiStore.folderGlass`. **Listas**: `components/ui/DataList.tsx` (card único, cabeçalho verde com faixa de 6px `accent-green-dim`, contorno verde 2,5px `.data-list-card`, linhas 1,5px, cascata + `AnimatePresence popLayout` + `layout`) — usado em Contatos e Negócios; tabelas `<table>` usam `.data-table` (Relatórios, Equipe); dias do calendário usam `.data-head`. Filtros: `components/ui/SegmentedControl.tsx` (pílula `layoutId`, preenche altura toda). Hooks de lista com `placeholderData: keepPreviousData` (a animação depende disso). **Nicho**: coluna `contacts.niche` (migration `20240020_add_niche_to_contacts` — **rodar em produção**), `GET /contacts/niches` (antes de `/:id`), `?niche=` na listagem, `NicheFilter` + campo com datalist no `ContactForm`. **Modais**: padrão único em `lib/motion.ts` (`dialogMotion` pop ~0,2s, `overlayMotion`, `centerTransform` p/ diálogos centrados com translate) aplicado em `Modal`, `UpgradeModal`, `ImportContactsModal`, `DateTimePicker` — Radix com `forceMount` + `AnimatePresence`. `WaveBackdrop` e `SearchModal` removidos.

- **M19 T1 — redesign visual ✅** (base pro redesign das outras telas): **paleta "Aurora Slate"** em `tailwind.config.ts` — `bg.primary #0a0d15`, `darker #07090f`, `surface #131926`, `border #1f2636`, textos azulados, verde `#72d296` segue como acento da marca + tokens `aurora.{green,teal,blue,violet}` (usar como luz/gradiente, nunca preenchimento grande); `status.open` = `#6b8cff`. Fonte do app: **Geist** (Inter vira fallback). **Vidro líquido**: `.card` em `globals.css` é translúcido (`backdrop-filter`) com reflexo de borda via `::before` mascarado — por isso `.card` tem `position: relative`; `.card-interactive` (hover com elevação), `.glass-panel` (dropdowns/painéis flutuantes, quase opaco), `.kpi-highlight` (halo verde só no KPI principal), `.app-backdrop` (fundo ambiente fixo com gradientes + grão, montado no `AppShell`). **Regra de brilho**: só o botão `primary` e o KPI principal brilham — não espalhar. **Menu lateral**: `src/components/ui/AnimatedSidebar.tsx` (framer-motion) + `layout/Sidebar.tsx`; recolhe por botão ou **Ctrl+B**, estado em `uiStore` persistido (`titanflow-ui`); só a largura externa anima, filhos em wrapper de largura fixa (não animar `width` de conteúdo — trava). `MotionConfig reducedMotion="never"` de propósito: a máquina do usuário tem efeitos de animação do Windows desligados e o framer cortava tudo. **Busca**: `components/search/TopbarSearch.tsx` inline no topo (Ctrl+K foca); `SearchModal` removido. Topbar e cabeçalho do menu têm `h-14` (bordas alinhadas). `LogoIcon` aceita `variant="aurora"`.
- **Preview visual local**: conta `preview@titanflow.local` / `Preview@1234` (workspace "Aurora Vendas", com contatos/negócios de exemplo) no banco local, usada pra screenshots com puppeteer-core + Chrome headless.
- **Dev local sem Docker**: PostgreSQL 18 nativo do Windows (serviço `postgresql-x64-18`), usuário `postgres` / senha `maracujatitan`, banco `titancrm`.

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
- Production deploy: `docker-compose.prod.yml` (Postgres + backend tsx + nginx frontend)
- CI: `.github/workflows/ci.yml` — tsc type-check on backend + frontend on PR
- CD: `.github/workflows/cd.yml` — builds Docker images and pushes to GHCR on merge to main
- Stripe: `payment_method_types: ['card']` set in `billing.service.ts` — fixes checkout for BRL accounts
- Stripe webhook uses raw body — registered before `express.json()` in `server.ts`
- `upgradeStore` (Zustand) holds `{ open, requiredPlan, showUpgrade, closeUpgrade }`
- Rate limiting: `tierRateLimiter` on all `/api/v1/*` (100/1000/10000 req/day by plan)
- API keys: prefix `tlk_`, SHA-256 hash stored, admin only, `starter` tier gated
- Public API via `X-API-Key`: `GET /api/v1/public/contacts`, `/public/deals`, `POST /public/contacts`
- Webhooks HMAC-signed with `X-Titan-Signature: sha256=<hmac>`
- `LandingPage` at `src/pages/landing/LandingPage.tsx` — public route `/`, redirects auth'd users to `/dashboard`; WhatsApp floating button (expand-on-hover)
- `AppShell` has WhatsApp floating button (icon-only, bottom-right) — replace `5511999999999` with real number in prod
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
- **Pending infra tasks**: (1) Google OAuth: preencher Branding (home/privacy/terms URLs), publicar app, criar Web client e setar `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`BACKEND_URL` no Render; (2) configure Stripe webhook URL (funciona com `*.onrender.com`, domínio próprio não é obrigatório)
- Docker prod build: both Dockerfiles use `context: .` (repo root) — required for npm workspaces lockfile
- Backend Dockerfile CMD: `node_modules/.bin/tsx packages/backend/src/server.ts` (run from repo root `/app`)
- `docker-compose.prod.yml` uses `DATABASE_URL` from `.env` with `?sslmode=disable` for local Postgres
- Migrations in prod: `docker compose -f docker-compose.prod.yml exec backend node_modules/.bin/tsx node_modules/.bin/knex --knexfile packages/backend/knexfile.ts migrate:latest`
- Dev workflow: use `docker compose up -d` (docker-compose.yml, password: `postgres`) for local DB, then `npm run dev:backend`
- `packages/backend/.env` DATABASE_URL must use `localhost` (not `db`) when running backend outside Docker
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
