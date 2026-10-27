# LeadHunter dentro do CRM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portar todas as funções do LeadHunter (Radar Local, Python) para dentro do CRM TitanFlow, menos as prévias de site. Só admin executa busca paga; os demais papéis pedem em `/solicitacoes`; tudo atrás de um liga/desliga por workspace.

**Architecture:**
- Backend: um módulo novo `modules/leadhunter/`, com a lógica pura separada (domínio, CSV, provedores) do acesso a banco (store) e do worker. O worker roda dentro do processo Express e executa uma campanha por vez a partir da tabela de campanhas.
- Frontend: uma seção “LeadHunter”, só para admin, mais a reescrita do fluxo de `/solicitacoes`.
- A fonte de comportamento é o código Python em `../LeadHunter/radar/*.py`, `../LeadHunter/app.py` e `../LeadHunter/web/app.js`: onde este plano não diz nada, vale o Python, inclusive as mensagens em pt-BR.

**Tech Stack:** Express 4 + TypeScript + Knex + PostgreSQL 16 (backend, roda com `tsx`); React 18 + Vite + Tailwind + TanStack Query 5 + RHF/Zod (frontend); `vitest` (novo, só dev do backend).

**Spec:** `docs/superpowers/specs/2026-10-27-leadhunter-no-crm-design.md` — leia antes de qualquer tarefa.

## Global Constraints

**Repositório e commits**
- Trabalhar direto na `main` do CRM (regra do `CLAUDE.md` do CRM).
- Implementers **não commitam**. O controller commita por tarefa, em ordem de onda, com mensagem `feat(M25-TN): <descrição>` (ou `fix`/`test`).
- O `CLAUDE.md` do CRM só permite commit quando o usuário diz “pode commitar”: pedir essa autorização em bloco no início da sessão de execução.

**Banco**
- Todo serviço recebe `tenantId` como **primeiro argumento**, e toda consulta em tabela do LeadHunter tem `.where({ tenant_id })`. Exceção: o worker, que lê a fila de todos os workspaces habilitados.
- Migrações novas a partir de `20240037_*.ts`, cada uma com `up` e `down`. Nunca editar migrações existentes.
- PK `uuid` com `gen_random_uuid()` e timestamps `timestamptz`.

**Respostas da API**
- Sucesso `{ data }`. Erro `{ error, code? }` lançado como `Object.assign(new Error(msg), { status, code })`. Zod nos controllers (422 via `errorHandler`).
- JSON das rotas novas em **camelCase**.
- Colunas `jsonb` guardam objetos camelCase. O script de migração (T14) converte as chaves snake_case do SQLite.

**Acesso**
- Rotas `/api/v1/leadhunter/*`: `requireAuth` → `requireLeadHunter` (404 `{ error: 'Not found' }` se `tenants.leadhunter_enabled` é falso) → `requireRole('admin')`.
- `tenants.leadhunter_enabled` **nunca** entra em `updateTenantSchema`.

**Limites e valores fixos**
- Env, todos opcionais:
  - `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`;
  - `TYPESAFE_API_KEY`, `TYPESAFE_MODEL` (padrão `jev-1.13.0`);
  - `LEADHUNTER_MAX_CALLS_PER_CAMPAIGN` (padrão 80), `LEADHUNTER_MAX_CALLS_PER_DAY` (padrão 200, dia UTC, **global** entre workspaces), `LEADHUNTER_SEARCH_CACHE_DAYS` (padrão 30, limitado a 0–3650).
- Limites do formulário: `limit` 1–50; até 3 termos (≤180); até 3 pontos `lat,lon,zoom` (zoom 3–21); `niche`/`city` ≤100; notas da empresa ≤5000; importação 1–100 linhas; exportação até 5000 ids; “Empresas já encontradas” mostra até 2000.
- HTTP para provedores: `fetch` nativo, `AbortSignal.timeout(35000)`, resposta até 8 000 000 bytes, **nenhuma repetição automática**.

**Textos e visual**
- Tudo em pt-BR, com as mesmas mensagens do Python.
- Visual com o design system do CRM (`components/ui`, tokens, dark/light), sem rolagem horizontal no mobile.

**Portões de verificação**
- `npx tsc --noEmit -p packages/backend`
- `npm run test --workspace=packages/backend` (testes de integração exigem `TEST_DATABASE_URL`)
- `npm run lint --workspace=packages/frontend`
- `npm run build --workspace=packages/frontend`

**Banco de teste:** sem Docker. O app roda só no Railway (produção) e o backend não tem `.env` local. Os testes usam o **PostgreSQL 18 nativo do Windows**:
- serviço `postgresql-x64-18`, início manual, normalmente parado: `Start-Service postgresql-x64-18`, em terminal de administrador;
- banco descartável `titancrm_test`, criado com `& 'C:\Program Files\PostgreSQL\18\bin\createdb.exe' -U postgres titancrm_test`;
- `TEST_DATABASE_URL=postgresql://postgres:<senha>@localhost:5432/titancrm_test`, passado só como variável do processo.
- A senha do `postgres` local é do usuário: a que o `CLAUDE.md` cita não autenticou em 26/10, então perguntar no início da T1.

**Nunca** apontar `TEST_DATABASE_URL` nem `DATABASE_URL` local para o Postgres do Railway (produção).

## Review Focus

1. **Flag desligada com campanha na fila**: workspace desligado depois de criar uma campanha `queued`. Esperado: o worker não a executa (fica `queued`), nenhuma chamada paga sai. Teste em T6.
2. **Reinício no meio da campanha**: processo morre com campanha `running` e chamada `pending`. Esperado: no boot, campanha `interrupted`, chamada `unknown`, nenhuma chamada repetida. Teste em T6.
3. **Duas reservas simultâneas no limite diário**: dois admins (ou dois workspaces) com uma única chamada restante no dia. Esperado: só uma reserva passa. Teste em T5.
4. **Cidade em texto livre que o DataForSEO recusa** (`40501`), comum em pedidos de captador (“Ribeirão Preto”). Esperado: campanha `failed` com “Provedor: 40501 - …”, sem nova tentativa; o pedido vira `failed` com a mesma mensagem. Testes em T4 e T12.
5. **Nome de empresa com emoji ou campo longo ao virar contato.** Esperado: o texto é cortado por unidades UTF-16 dentro dos limites do CRM, a URL longa é omitida e o lote não cai com 422. Teste em T7.

---

## Mapa de arquivos

**Backend** (`packages/backend/`)

| Arquivo | Responsabilidade |
|---|---|
| `vitest.config.ts`, `src/test/setup.ts`, `src/test/db.ts` | Harness de testes; env de teste; helpers de tenant/usuário/limpeza |
| `src/db/migrations/20240037_create_leadhunter.ts` | Flag em `tenants` + tabelas `lh_*` |
| `src/db/migrations/20240038_lead_requests_leadhunter.ts` | Campos do formulário e `campaign_id` em `lead_requests` |
| `src/config/env.ts` | Variáveis novas |
| `src/shared/middleware/requireLeadHunter.ts` | 404 quando a flag está desligada |
| `src/modules/leadhunter/domain.ts` | Port de `radar/domain.py` (puro) |
| `src/modules/leadhunter/csv.ts` | Importação/exportação CSV (puro; port de `app.py`) |
| `src/modules/leadhunter/providers.ts` | Settings, DataForSEO, Jev (port de `radar/providers.py`) |
| `src/modules/leadhunter/store.ts` | Acesso a banco (port de `radar/storage.py`) |
| `src/modules/leadhunter/engine.ts` | Execução, estimativa, recálculo, worker, recover (port de `radar/engine.py`) |
| `src/modules/leadhunter/contacts.ts` | Empresa → contato do CRM (port de `lead_payload` em `radar/crm.py`) e envio |
| `src/modules/leadhunter/delivery.ts` | Entrega automática de pedido ao fim da campanha |
| `src/modules/leadhunter/leadhunter.{schema,service,controller,routes}.ts` | HTTP |
| `scripts/import-leadhunter.ts` | Importa o JSON exportado do SQLite |

**LeadHunter:** `scripts/export_for_crm.py` (exporta o SQLite para JSON; só biblioteca padrão).

**Frontend** (`packages/frontend/src/`)

| Arquivo | Responsabilidade |
|---|---|
| `services/leadhunter.service.ts`, `hooks/useLeadHunter.ts` | API + TanStack Query |
| `components/leadhunter/*` | Formulário de campanha, ficha, tabela, diálogos |
| `pages/leadhunter/{CampaignsPage,SearchesPage,IntegrationsPage}.tsx` | Telas |
| Modificados | `app/router.tsx`, `components/layout/{Sidebar,AppShell,MobileTabBar}.tsx`, `hooks/useTenant.ts`, `pages/lead-requests/LeadRequestsPage.tsx`, `components/lead-requests/LeadRequestForm.tsx`, `services/leadRequests.service.ts`, `hooks/useLeadRequests.ts` |

## Ondas

| Onda | Tarefas (paralelas dentro da onda) |
|---|---|
| 1 | T1 |
| 2 | T2 |
| 3 | T3, T4, T5 |
| 4 | T6 |
| 5 | T7 |
| 6 | T8, T12 |
| 7 | T10, T11 |
| 8 | T9 |
| 9 | T13, T14 |
| 10 | T15 |

---

### Task 1: Base — testes, env, flag, tabelas

**Files:**
- Modify: `packages/backend/package.json` (devDependency `vitest`; scripts `"test": "vitest run"`, `"test:watch": "vitest"`), `packages/backend/src/config/env.ts`, `packages/backend/.env.example`, `packages/backend/src/modules/tenants/tenants.service.ts` (`PUBLIC_COLUMNS`), `packages/frontend/src/hooks/useTenant.ts` (tipo `Tenant`)
- Create: `packages/backend/vitest.config.ts`, `packages/backend/src/test/setup.ts`, `packages/backend/src/test/db.ts`, `packages/backend/src/db/migrations/20240037_create_leadhunter.ts`, `packages/backend/src/shared/middleware/requireLeadHunter.ts`
- Test: `packages/backend/src/test/foundation.int.test.ts`

**Depends-on:** —

**Interfaces:**
- Produz `env.DATAFORSEO_LOGIN?`, `env.DATAFORSEO_PASSWORD?`, `env.TYPESAFE_API_KEY?`, `env.TYPESAFE_MODEL` (default `'jev-1.13.0'`), `env.LEADHUNTER_MAX_CALLS_PER_CAMPAIGN` (coerce, default 80), `env.LEADHUNTER_MAX_CALLS_PER_DAY` (coerce, default 200), `env.LEADHUNTER_SEARCH_CACHE_DAYS` (coerce, default 30; o clamp 0–3650 fica em T4).
- Produz `requireLeadHunter(req, res, next)`: lê `tenants.leadhunter_enabled` de `req.user.tenantId` no banco a cada chamada (como `requireTier`); falso → `404 { error: 'Not found' }`.
- Produz `GET /tenant` com `leadhunter_enabled: boolean`; FE `Tenant.leadhunter_enabled: boolean`.
- Produz em `src/test/db.ts`:
  - `hasTestDb: boolean` (= `!!process.env.TEST_DATABASE_URL`);
  - `migrateTestDb(): Promise<void>`;
  - `makeTenant(opts?: { leadhunterEnabled?: boolean; plan?: string }): Promise<string>`;
  - `makeUser(tenantId: string, role: 'admin'|'manager'|'seller'|'captador', opts?: { active?: boolean }): Promise<string>`;
  - `resetLeadHunter(): Promise<void>` (trunca `lh_*`, `lead_requests`, `contacts`, `notifications`, `lead_assignments`).
- **Tabelas** (migração `20240037`): todas com `id uuid pk`, `tenant_id uuid not null → tenants ON DELETE CASCADE`, índice começando por `tenant_id`.

| Tabela | Colunas |
|---|---|
| `tenants` | + `leadhunter_enabled boolean not null default false` |
| `lh_campaigns` | `config jsonb not null`, `state varchar(20) not null` (CHECK `importing,queued,running,completed,partial,failed,cancelled,interrupted`), `message text not null default ''`, `progress int not null default 0`, `cancel_requested boolean not null default false`, `warnings jsonb not null default '[]'`, `created_by uuid → users SET NULL`, timestamps |
| `lh_companies` | `identity varchar(32) not null`, `source varchar(10) not null` (`demo/live/import`), `data jsonb not null`, `stage varchar(20) not null default 'new'` (CHECK das 6 etapas), `notes text not null default ''`, `crm jsonb` (resultado do envio: `{contactId,status,sentAt,ownerId,error?}`), timestamps; **unique (`tenant_id`,`identity`)** |
| `lh_campaign_companies` | `campaign_id → lh_campaigns CASCADE`, `company_id → lh_companies CASCADE`, `analysis jsonb not null default '{}'`, `position serial`; pk (`campaign_id`,`company_id`) |
| `lh_observations` | `campaign_id CASCADE`, `company_id CASCADE`, `query text`, `location text`, `rank int null`, `depth int`, `observed_at timestamptz`, `source_url text null`; unique (`campaign_id`,`company_id`,`query`,`location`) |
| `lh_api_calls` | `campaign_id → lh_campaigns SET NULL`, `provider varchar(20)`, `operation varchar(20)`, `state varchar(10) default 'pending'` (CHECK `pending,success,error,unknown`), `cost numeric(12,6) null`, `tokens int null`, `model text null`, `created_at timestamptz`; índice em `created_at` (o limite diário é global) |
| `lh_searches` | `provider`, `operation`, `cache_key varchar(32)`, `keyword text`, `location text`, `depth int`, `campaign_id SET NULL`, `executed_at timestamptz`, `result_count int default 0`, `cost numeric(12,6) null`, `results jsonb default '[]'`, `reuse_count int default 0`, `last_reused_at timestamptz null`; índice (`tenant_id`,`cache_key`,`executed_at`) |
| `lh_search_coverage` | `campaign_id CASCADE`, `query`, `location`, `depth`, `observed_at`; unique (`campaign_id`,`query`,`location`) |

- [ ] **Step 1:** instalar `vitest` como devDependency do backend e criar a configuração:
  - `vitest.config.ts`: `environment: 'node'`, `setupFiles: ['src/test/setup.ts']`, `fileParallelism: false`, `include: ['src/**/*.test.ts']`;
  - `setup.ts`: antes de qualquer import do app, define `DATABASE_URL = TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused'`, `JWT_SECRET` e `JWT_REFRESH_SECRET` com 32+ caracteres, `NODE_ENV = 'test'`.
- [ ] **Step 2: Escrever o teste que falha** em `foundation.int.test.ts`, com `describe.skipIf(!hasTestDb)`:
  - `'migração cria a flag desligada por padrão'`: `makeTenant()` → `select leadhunter_enabled` é `false`;
  - `'requireLeadHunter responde 404 com a flag desligada e chama next com ela ligada'`: request/response falsos; checar `res.status(404)` e `next` chamado;
  - `'GET /tenant expõe leadhunter_enabled'`: `getTenant(id)` contém a chave;
  - `'updateTenantSchema ignora leadhunter_enabled'`: `updateTenantSchema.parse({ leadhunterEnabled: true })` não tem a chave (`strip` padrão do Zod).
- [ ] **Step 3:** rodar `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/titancrm_test npm run test --workspace=packages/backend`. Esperado: FAIL (migração ou middleware inexistente).
- [ ] **Step 4:** criar a migração (tabela acima), o middleware, as variáveis de env (+ `.env.example` com as variáveis vazias e comentário pt-BR) e `PUBLIC_COLUMNS` + o tipo FE.
- [ ] **Step 5:** rodar de novo. Esperado: PASS. Rodar também `npx tsc --noEmit -p packages/backend` e `npm run lint --workspace=packages/frontend`. Esperado: sem erros.
- [ ] **Step 6:** controller commita `feat(M25-T1): base do LeadHunter no CRM (flag, tabelas, vitest)`.

---

### Task 2: Domínio (port de `radar/domain.py`)

**Files:**
- Create: `packages/backend/src/modules/leadhunter/domain.ts`
- Test: `packages/backend/src/modules/leadhunter/domain.test.ts`

**Depends-on:** T1

**Interfaces — Produz** (`domain.ts`, sem import de banco):

Tipos:
- `type Source = 'demo'|'live'|'import'`
- `type Service = 'google'|'website'|'marketing'`
- `type Stage = 'new'|'reviewing'|'contacted'|'interested'|'discarded'|'do_not_contact'`
- `type Priority = 'high'|'medium'|'low'|'review'|'excluded'`
- `SERVICES: Record<Service,string>`, `STAGES: readonly Stage[]`, `PRIORITY_LABELS: Record<Priority,string>`
- `interface CampaignConfig { niche: string; city: string; source: Source; service: Service; limit: number; keywords: string[]; coordinates: string[]; enrich: boolean; useJev: boolean; forceRefresh: boolean }`
- `interface Fit { choice: 'match'|'no_match'|'unknown'; method: 'rules'|'jev'|'error'; confidence: number|null; model: string|null; niche?: string; evaluatedAt?: string; regionReview?: boolean }`
- `interface Observation { query: string; location: string; rank: number|null; depth: number; observedAt: string; sourceUrl: string|null }`
- `interface SearchDone { query: string; location: string; depth: number }`
- `interface CompanyData`: chaves do `data` do Python em camelCase:
  - `name`, `category`, `city`, `borough`, `address`, `placeId`, `phone`, `website`, `websiteChecked`;
  - `rating`, `reviews`, `mapsUrl`, `sourceUrl`, `collectedAt`, `updatedAt`, `rank?`, `regionReview?`;
  - `instagram`, `instagramStatus` (`not_searched|candidate|not_found|error|confirmed|rejected`), `instagramSource`, `instagramCandidates: {url,title,description}[]`, `instagramSearchedAt`, `instagramVerifiedAt`;
  - `fieldSources`.
- `interface Analysis { score; priority: Priority; reasons: {points:number;text:string}[]; rankMedian: number|null; rankSamples: number; visibility: 'not_measured'|'top'|'middle'|'low'; completeness: number; coverage: {appeared:number;searched:number;depth:number}|null; fit: Fit; version: 'v1'; peerMedian: number|null }`
- `interface ExportRow { company: CompanyData & { source: Source; stage: Stage; notes: string }; analysis: Analysis|null; observations: Observation[] }` (usado por T3 e T5, que rodam na mesma onda)
- `interface CallRecorder { reserve(op: { provider: 'dataforseo'|'typesafe'; operation: 'maps'|'organic'|'classification' }): Promise<string>; finish(callId: string, r: { state: 'success'|'error'|'unknown'; cost?: number|null; tokens?: number|null; model?: string|null }): Promise<void> }` (implementado pelo store em T5, usado pelos provedores em T4)

Funções:
- `normalized(v: unknown): string`
- `number(v: unknown, min=0, max=10_000_000, integer=false): number|null` (lança `Error` com a mensagem do Python)
- `text(v: unknown, limit=200, required=false): string`
- `safeUrl(v: unknown): string|null`
- `instagramUrl(v: unknown): string|null`
- `formatPhone(v: string|null): string|null`
- `shortDate(iso: string): string` (UTC-3 fixo)
- `isFresh(iso: string|null|undefined, days: number, now?: Date): boolean`
- `mapsSearchKey(keyword: string, city: string, coordinate?: string|null): string` (sha256 via `node:crypto`, `[:32]`)
- `validateCampaign(data: unknown): CampaignConfig` (lança `Error` com a mensagem pt-BR do Python; `enrich`/`useJev` são `true` a menos que venha `false`; `forceRefresh` só com `=== true`; aceita `use_jev`/`force_refresh` também)
- `identity(lead: Pick<CompanyData,'placeId'|'name'|'address'|'city'>, source: Source): string` (`sha256(group:key)[:32]`, **mesmo valor do Python**: é o `external_id` já gravado em contatos pela C1)
- `localFit(lead, niche): Fit`
- `median(values: number[]): number|null`
- `coverage(observations: Observation[], searches: SearchDone[]): Analysis['coverage']`
- `scoreLead(lead: CompanyData, observations: Observation[], fit: Fit, service: Service, peerMedian?: number|null, searches?: SearchDone[]): Analysis`

- [ ] **Step 1: Escrever os testes que falham** portando as asserções, com os mesmos valores, destes testes de `../LeadHunter/tests/test_radar.py`:
  - linhas 54, 60, 64, 69, 77, 80, 87, 93, 97, 121, 127;
  - linhas 281, 286, 290, 301, 436.

  Nome do teste = tradução do nome Python, ex.: `'números ausentes não viram zero nem ranking ruim'`. Acrescentar dois testes:
  - `'identity bate com o valor gravado pelo Python'`: calcular no Python (`python -c "from radar.domain import identity; print(identity({'place_id':'abc'},'live'))"` dentro de `../LeadHunter`) e fixar o valor no teste;
  - o mesmo para `mapsSearchKey('Moda feminina','São Carlos')`.
- [ ] **Step 2:** rodar `npm run test --workspace=packages/backend -- domain`. Esperado: FAIL (módulo inexistente).
- [ ] **Step 3:** implementar `domain.ts` portando `radar/domain.py` função por função. Para `normalized`, usar `NFKD` + remoção de não-ASCII + `/[a-z0-9]+/g`.
- [ ] **Step 4:** rodar de novo. Esperado: PASS. Rodar `tsc` do backend.
- [ ] **Step 5:** controller commita `feat(M25-T2): domínio do LeadHunter (pontuação, validação, chaves)`.

---

### Task 3: CSV — importação e exportação

**Files:**
- Create: `packages/backend/src/modules/leadhunter/csv.ts`
- Test: `packages/backend/src/modules/leadhunter/csv.test.ts`

**Depends-on:** T2

**Interfaces:**
- Consome de `domain.ts`: `text`, `number`, `safeUrl`, `instagramUrl`, `formatPhone`, `validateCampaign`, `CompanyData`, `Analysis`, `Observation`.
- Produz:
  - `parseCsv(content: string): Record<string, string>[]` (port de `parse_csv` em `app.py`);
  - `validateImport(body: unknown): { config: CampaignConfig; leads: Partial<CompanyData>[] }` (port de `validate_import`; aceita `{config?, csv}` ou `{config?, leads}`; 1–100; erros “Linha N: …” / “Empresa N: …”);
  - `exportCsv(rows: ExportRow[]): string` (`ExportRow` vem de `domain.ts`): as 22 colunas na ordem do Python, `;`, BOM `﻿`, proteção contra fórmula (`= + - @ \t \r` → prefixo `'`).

- [ ] **Step 1: Escrever os testes que falham** portando `test_radar.py` linhas 115, 132, 138 e a parte de CSV das linhas 260 e 872. Acrescentar:
  - `'cabeçalho exportado é idêntico ao do LeadHunter'`: comparar a 1ª linha com a lista de 22 cabeçalhos do inventário (`app.py:34-49`).
- [ ] **Step 2:** `npm run test --workspace=packages/backend -- csv`. Esperado: FAIL.
- [ ] **Step 3:** implementar, portando `app.py:34-120`.
- [ ] **Step 4:** rodar de novo. Esperado: PASS.
- [ ] **Step 5:** controller commita `feat(M25-T3): importação e exportação CSV do LeadHunter`.

---

### Task 4: Provedores (DataForSEO, Jev) e settings

**Files:**
- Create: `packages/backend/src/modules/leadhunter/providers.ts`
- Test: `packages/backend/src/modules/leadhunter/providers.test.ts`

**Depends-on:** T2

**Interfaces:**
- Consome de `domain.ts`: `safeUrl`, `instagramUrl`, `number`, `normalized`, `CompanyData`, `Fit`, `CallRecorder`.
- Produz:

```ts
export interface Settings {
  dataforseo: { login: string; password: string } | null;
  jevKey: string | null; jevModel: string;
  runLimit: number; dailyLimit: number; cacheDays: number; // cacheDays já limitado a 0–3650
}
export function loadSettings(): Settings;            // lê `env`
export class ProviderError extends Error {}
export type Transport = (url: string, body: unknown, headers: Record<string, string>) => Promise<unknown>;
export const httpTransport: Transport;               // fetch + timeout 35 s + limite 8 MB + mensagens pt-BR do post_json
export interface Providers {                         // CallRecorder vem de domain.ts

  maps(rec: CallRecorder, keyword: string, city: string, coordinate: string|null, depth: number): Promise<{ leads: Partial<CompanyData>[]; cost: number|null }>;
  instagram(rec: CallRecorder, lead: CompanyData, city: string, coordinate: string|null): Promise<Pick<CompanyData,'instagram'|'instagramStatus'|'instagramCandidates'|'instagramSource'|'instagramSearchedAt'>>;
  classify(rec: CallRecorder, lead: CompanyData, niche: string): Promise<Fit>;
}
export function createProviders(settings: Settings, transport?: Transport): Providers;
export function parseMaps(response: unknown): Partial<CompanyData>[];
```

- Regra do `call()` do Python (`providers.py:85-105`):
  - `reserve` **antes** do transporte;
  - `finish('success'|'error')` conforme os `status_code`;
  - `finish('unknown')` em exceção, e relança.

- [ ] **Step 1: Escrever os testes que falham**, com `Transport` falso e `CallRecorder` em memória, portando `test_radar.py` linhas 103, 110, 200, 210, 215 e 220. Acrescentar:
  - `'reserva acontece antes do transporte e exceção fecha como unknown'`: o transporte lança erro; a ordem de eventos é `['reserve','transport','finish:unknown']`;
  - `'40501 vira ProviderError com o código e a mensagem do provedor'` (Review Focus 4): a resposta tem `tasks[0].status_code = 40501` e `status_message 'Invalid Field: location_name'`; a mensagem contém `'Provedor: 40501 - Invalid Field: location_name'`;
  - `'loadSettings limita cacheDays a 0–3650'`.
- [ ] **Step 2:** `npm run test --workspace=packages/backend -- providers`. Esperado: FAIL.
- [ ] **Step 3:** implementar, portando `radar/providers.py` (payloads, parse, `task_error`, `40102` = não encontrado).
- [ ] **Step 4:** rodar. Esperado: PASS.
- [ ] **Step 5:** controller commita `feat(M25-T4): provedores DataForSEO e Jev`.

---

### Task 5: Store (port de `radar/storage.py`)

**Files:**
- Create: `packages/backend/src/modules/leadhunter/store.ts`
- Test: `packages/backend/src/modules/leadhunter/store.int.test.ts`

**Depends-on:** T1, T2

**Interfaces:**
- Consome: `db` de `src/db`; tipos (`CallRecorder`, `ExportRow` etc.) e `identity` de `domain.ts`. Não importa nada de `csv.ts` nem de `providers.ts`.
- Produz (`tenantId` sempre primeiro; ids são uuid; campanhas e empresas devolvidas em camelCase):

```ts
export interface Campaign { id; createdAt; updatedAt; config: CampaignConfig & { leadRequestId?: string }; state; message; progress; cancelRequested: boolean; warnings: string[]; createdBy: string|null }
export interface Company extends CompanyData { id: string; identity: string; source: Source; stage: Stage; notes: string; crm: CrmResult|null; analysis?: Analysis; observations?: Observation[] }
export interface CrmResult { contactId: string|null; status: 'imported'|'duplicate'|'error'; sentAt: string; ownerId: string|null; error?: string }

createCampaign(tenantId, config, opts?: { state?: 'queued'|'importing'; createdBy?: string|null }): Promise<string>
getCampaign(tenantId, id): Promise<Campaign|null>
listCampaigns(tenantId, limit = 200): Promise<Campaign[]>
updateCampaign(tenantId, id, fields: Partial<Pick<Campaign,'state'|'message'|'progress'|'cancelRequested'|'warnings'>>): Promise<void>
upsertCompany(tenantId, campaignId, lead: Partial<CompanyData>, source: Source, observation?: Observation): Promise<string>   // regras de mescla de upsert_lead
recordSearch(tenantId, campaignId, query, location, depth, observedAt?): Promise<void>
searchCoverage(tenantId, campaignId): Promise<SearchDone[]>
companies(tenantId, campaignId): Promise<Company[]>            // com analysis e observations, ordenadas por score desc
getCompany(tenantId, id): Promise<Company|null>
patchCompanyData(tenantId, id, values: Partial<CompanyData>): Promise<void>
updateCompany(tenantId, id, fields: { stage?: Stage; notes?: string }): Promise<void>
setAnalysis(tenantId, campaignId, companyId, analysis: Analysis): Promise<void>
keepCampaignCompanies(tenantId, campaignId, ids: string[]): Promise<void>
campaignsForCompany(tenantId, companyId): Promise<{ id: string; state: string }[]>
deleteCompany(tenantId, id): Promise<void>
history(tenantId, companyId): Promise<(Observation & { campaignId: string; niche: string })[]>
foundCompanies(tenantId, opts: { includeDemo: boolean; limit?: number }): Promise<{ rows: FoundCompany[]; truncated: boolean }>
exportRows(tenantId, ids?: string[]): Promise<ExportRow[]>
setCrm(tenantId, companyId, crm: CrmResult): Promise<void>
callRecorder(tenantId, campaignId, runLimit, dailyLimit): CallRecorder
usage(tenantId, campaignId): Promise<{ provider: string; calls: number; cost: number; tokens: number; incomplete: number }[]>
callsToday(): Promise<number>                                   // global, dia UTC
saveSearch(tenantId, s: { campaignId; provider; operation; cacheKey; keyword; location; depth; results: Partial<CompanyData>[]; cost: number|null }): Promise<void>
reusableSearch(tenantId, cacheKey, depth, days): Promise<{ id; executedAt; results: Partial<CompanyData>[] }|null>
markSearchReused(tenantId, id): Promise<void>
listSearches(tenantId, limit = 500): Promise<SearchRow[]>       // sem `results`
reusableFit(tenantId, companyId, nicheKey, days): Promise<Fit|null>
```

- Reserva de chamada: uma transação com `pg_advisory_xact_lock(hashtext('leadhunter_api_calls'))`, uma trava **global**. Dentro dela:
  - conta as chamadas da campanha (`run`) e as do dia UTC em todos os workspaces (`day`);
  - se `run >= runLimit` ou `day >= dailyLimit`, lança `Error('Limite de chamadas atingido. Resultados anteriores foram preservados.')`;
  - senão insere `pending`.

- [ ] **Step 1: Escrever os testes que falham** com `describe.skipIf(!hasTestDb)` e `resetLeadHunter()` em `beforeEach`, portando `test_radar.py` linhas 157, 163, 173 (parte de reserva), 347, 353, 362, 370, 853, 861 e 867. Acrescentar:
  - `'duas reservas simultâneas com uma vaga no dia: só uma passa'` (Review Focus 3): `dailyLimit = callsToday()+1`; dois `reserve()` em `Promise.allSettled` de dois tenants diferentes → 1 fulfilled, 1 rejected com a mensagem de limite;
  - `'nenhuma função vê dados de outro tenant'`: empresa criada no tenant A; `getCompany(B, id)` é `null`, `companies(B, campA)` é `[]` e `foundCompanies(B)` é vazio.
- [ ] **Step 2:** `TEST_DATABASE_URL=… npm run test --workspace=packages/backend -- store`. Esperado: FAIL.
- [ ] **Step 3:** implementar, portando `radar/storage.py` (mesmas regras de `upsert_lead`, `keep_campaign_leads`, `found_companies` e `export_leads`). JSON em `jsonb`.
- [ ] **Step 4:** rodar. Esperado: PASS. Rodar `tsc`.
- [ ] **Step 5:** controller commita `feat(M25-T5): armazenamento do LeadHunter em Postgres`.

---

### Task 6: Engine e worker

**Files:**
- Create: `packages/backend/src/modules/leadhunter/engine.ts`
- Test: `packages/backend/src/modules/leadhunter/engine.int.test.ts`

**Depends-on:** T4, T5

**Interfaces:**
- Consome: `store.ts`, `providers.ts` (`Providers`, `Settings`, `ProviderError`, `createProviders`, `loadSettings`), `domain.ts`.
- Produz:

```ts
export function estimateCalls(tenantId: string, config: CampaignConfig, settings: Settings): Promise<{ searches: number; reused: number; calls: number }>;
export function runCampaign(tenantId: string, campaignId: string, providers: Providers, settings: Settings): Promise<void>;
export function recalculate(tenantId: string, campaignId: string, fits?: Map<string, Fit>): Promise<void>;
export function recover(): Promise<void>;   // todos os tenants: running/importing → interrupted ("Execução interrompida pelo reinício. Resultados preservados."), api_calls pending → unknown
export function runNext(providers: Providers, settings: Settings): Promise<string|null>; // reserva a mais antiga `queued` de tenant com leadhunter_enabled (UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED) RETURNING), roda, devolve o id
export function startWorker(opts?: { providers?: Providers; settings?: Settings; idleMs?: number }): { stop(): Promise<void> }; // chama recover() uma vez, depois loop runNext; idleMs padrão 1000
export const onCampaignFinished: { handler: ((tenantId: string, campaignId: string) => Promise<void>) | null }; // T12 preenche; engine chama depois do estado final, com try/catch + console.error
```

- O cancelamento confere `cancel_requested` antes de cada chamada paga, como `check()` em `engine.py:56`.
- *ponytail:* `recover()` no boot supõe uma única instância no Railway; com réplicas, seria preciso um dono por instância (spec 7.2).

- [ ] **Step 1: Escrever os testes que falham**, com `describe.skipIf(!hasTestDb)`, `Providers` falso que conta chamadas e `Settings` fixo. Portar `test_radar.py` linhas:
  - 173 (recover), 186, 194, 230, 239, 246, 253;
  - 342, 378, 389, 399, 405, 411, 418, 431, 439;
  - 753 (estimativa e recusa acima do limite).

  Acrescentar:
  - `'flag desligada: runNext não pega campanha queued'` (Review Focus 1): campanha `queued` num tenant com flag falsa → `runNext` devolve `null`, o estado continua `queued` e o provedor falso registra 0 chamadas;
  - `'reinício no meio: running vira interrupted e pending vira unknown, sem nova chamada'` (Review Focus 2): inserir à mão campanha `running` e chamada `pending`; `recover()`; `runNext()` devolve `null`; o provedor registra 0 chamadas;
  - `'40501 no Maps: campanha failed com a mensagem do provedor e uma única chamada'` (Review Focus 4);
  - `'onCampaignFinished é chamado uma vez com o estado final já gravado'`.
- [ ] **Step 2:** rodar `TEST_DATABASE_URL=… npm run test --workspace=packages/backend -- engine`. Esperado: FAIL.
- [ ] **Step 3:** implementar, portando `radar/engine.py` (demo, live, filtro de cidade, top-N incremental, Jev/regras, Instagram, mediana dos pares, estados, avisos, nota de reaproveitamento).
- [ ] **Step 4:** rodar. Esperado: PASS.
- [ ] **Step 5:** controller commita `feat(M25-T6): execução de campanhas e worker do LeadHunter`.

---

### Task 7: API HTTP + “Criar contatos”

**Files:**
- Create: `packages/backend/src/modules/leadhunter/{leadhunter.schema,leadhunter.service,leadhunter.controller,leadhunter.routes,contacts}.ts`
- Modify: `packages/backend/src/server.ts` (montar `/api/v1/leadhunter`; `startWorker()` dentro do `.then` do `migrate.latest()`, antes do `listen`; não iniciar quando `NODE_ENV === 'test'`)
- Test: `packages/backend/src/modules/leadhunter/leadhunter.int.test.ts`, `packages/backend/src/modules/leadhunter/contacts.test.ts`

**Depends-on:** T3, T6

**Interfaces:**
- Consome: `store.ts`, `engine.ts` (`estimateCalls`), `csv.ts`, `providers.ts` (`loadSettings`), `importContactsBulk`/`BulkContactInput` de `contacts/contacts.service.ts`, `requireLeadHunter`, `requireRole`.
- Produz em `contacts.ts`:
  - `cutUtf16(s: string|null|undefined, n: number): string|null`;
  - `toContactInput(company: Company, analysis: Analysis|null): BulkContactInput` (port de `lead_payload` em `radar/crm.py:110`; mapeamento da spec 7.5; `externalId = company.identity`; Instagram só se `confirmed`);
  - `sendCompaniesToContacts(tenantId: string, companyIds: string[], opts: { ownerId: string|null; leadRequestId?: string|null; trx?: Knex.Transaction }): Promise<{ imported: number; duplicate: number; error: number; excluded: number; items: BulkItemResult[] }>`: exclui demo, `discarded`/`do_not_contact` e empresas com `crm.status` `imported`/`duplicate`; grava `setCrm` por item; até 500.
- Produz em `leadhunter.service.ts`, para T12: `createCampaignChecked(tenantId: string, userId: string, data: unknown, opts?: { leadRequestId?: string }): Promise<{ id: string; estimate: { searches; reused; calls } }>`.
  - `source=live` sem DataForSEO → 400 com a mensagem do Python.
  - Estimativa acima de `runLimit` → 400 com a mensagem do Python.
  - `source=import` → 400.
- Rotas (todas sob o router guardado; respostas `{ data }`):

| Método e caminho | Equivale a (Python `app.py`) |
|---|---|
| `GET /status` | `/api/status` sem token/sites/CRM: `{ dataforseo, jev, jevModel, runLimit, dailyLimit, callsToday, searchCacheDays }` |
| `GET /campaigns` · `POST /campaigns` (201 `{id}`) · `POST /campaigns/estimate` | idem |
| `GET /campaigns/:id?q&priority&stage` | `{ campaign, companies, usage, coverage }` |
| `GET /campaigns/:id/export?q&priority&stage` | CSV `radar-<source>-<id8>.csv` (`text/csv; charset=utf-8`, `Content-Disposition`) |
| `POST /campaigns/:id/cancel` | idem |
| `POST /campaigns/:id/contacts` body `{ companyIds?: uuid[], ownerId: uuid|null }` | novo: `sendCompaniesToContacts`; `ownerId` precisa ser membro ativo (422 `invalid_owner`) |
| `POST /import` | idem (201 `{id}`) |
| `GET /companies/:id/history` · `PATCH /companies/:id` · `DELETE /companies/:id` | `/api/leads/<id>/history`, PATCH e DELETE (409 se campanha `queued`/`running`; **404** se não existe) |
| `GET /searches` | idem (`expired`) |
| `GET /found-companies?demo=1` · `POST /found-companies/export` | idem (até 2000 / até 5000 ids) |

- [ ] **Step 1: Escrever os testes que falham.**
  - `contacts.test.ts` (puro): portar `test_radar.py` linhas 487, 501, 508, 515, 522, 527. Acrescentar `'emoji e campos longos são cortados por UTF-16 e URL longa é omitida'` (Review Focus 5): nome com 300 “😀” → `company` com `≤ 255` unidades UTF-16 e sem surrogate solta; `website` de 3000 caracteres → `undefined`.
  - `leadhunter.int.test.ts` (com banco; chamar o service e o controller com `req`/`res` falsos, sem servidor):
    - portar 690 (jornada demo: criar, ler, filtrar, exportar, editar etapa/notas, excluir), 704, 712, 728, 764, 872, 876 (ids inválidos → 422) e 548 (reenvio não duplica; erro pode reenviar);
    - `'rotas exigem admin: manager recebe 403'`: sem `supertest` (sem dependência nova), chamar `requireLeadHunter` e depois `requireRole('admin')` com `req.user.role='manager'` num tenant habilitado e checar 403;
    - `'DELETE de empresa inexistente responde 404'`.
- [ ] **Step 2:** `TEST_DATABASE_URL=… npm run test --workspace=packages/backend -- leadhunter contacts`. Esperado: FAIL.
- [ ] **Step 3:** implementar o schema, o service, o controller, as rotas, `contacts.ts` e a montagem em `server.ts`.
- [ ] **Step 4:** rodar os testes. Esperado: PASS. Depois, um `curl` contra `npm run dev:backend` com `DATABASE_URL` apontando para o `titancrm_test` local (variável do processo; nunca Railway), com a flag ligada para um tenant de teste por `UPDATE tenants SET leadhunter_enabled = true WHERE id = '<id>'`:
  - admin `POST /leadhunter/campaigns` demo → 201 e, em até ~3 s, `GET` mostra `completed` com 10 empresas;
  - seller → 403;
  - outro tenant com flag falsa → 404.

  Anotar os comandos no corpo do commit.
- [ ] **Step 5:** controller commita `feat(M25-T7): API do LeadHunter e envio de empresas como contatos`.

---

### Task 8: Frontend — serviço, hooks, menu, rotas, guarda

**Files:**
- Create: `packages/frontend/src/services/leadhunter.service.ts`, `packages/frontend/src/hooks/useLeadHunter.ts`, `packages/frontend/src/pages/leadhunter/{CampaignsPage,SearchesPage,IntegrationsPage}.tsx` (placeholders com `PageHeader`, substituídos em T9–T11)
- Modify: `packages/frontend/src/app/router.tsx`, `packages/frontend/src/components/layout/{Sidebar,AppShell,MobileTabBar}.tsx`

**Depends-on:** T7

**Interfaces:**
- Consome: as rotas de T7 e `Tenant.leadhunter_enabled` de T1.
- Produz:
  - `leadhunterService` com um método por rota de T7, devolvendo `r.data.data` (exportações via `responseType: 'blob'`);
  - tipos TS espelhando `Campaign`, `Company`, `Analysis`, `SearchRow`, `FoundCompany` e `Status`;
  - hooks `useLeadHunterStatus()`, `useCampaigns()`, `useCampaign(id, filters)` (com `refetchInterval: 2500` enquanto `state` ∈ `queued|running`), `useEstimate(config)` (debounce com o `useDebounce` existente), `useCreateCampaign()`, `useCancelCampaign()`, `useImportCampaign()`, `useUpdateCompany()`, `useDeleteCompany()`, `useCompanyHistory(id)`, `useSendToContacts()`, `useSearches()`, `useFoundCompanies(demo)`, `useExportFound()`;
  - `useLeadHunterEnabled(): boolean` (`useTenant().data?.leadhunter_enabled === true`).
- Rotas: `/leadhunter` (campanhas, `?c=<id>` seleciona), `/leadhunter/locais`, `/leadhunter/integracoes`.
- Menu: seção “LeadHunter” (ícone `Radar` do lucide) em `adminSections` **só quando** `useLeadHunterEnabled()`. `sectionsFor` passa a receber `(role, leadhunterEnabled)`; `MobileTabBar` acompanha.
- `AppShell.roleRedirect`:
  - `/leadhunter*` com role ≠ admin → `/dashboard`;
  - com flag falsa → `/dashboard`;
  - `/solicitacoes` com flag falsa → `/dashboard` para todos (some o link do menu também).

- [ ] **Step 1:** implementar o serviço, os hooks, as rotas e o menu.
- [ ] **Step 2:** rodar `npm run lint --workspace=packages/frontend` e `npm run build --workspace=packages/frontend`. Esperado: zero erros.
- [ ] **Step 3:** conferir no navegador (`npm run dev:frontend` + backend de T7 com banco descartável):
  - admin com flag vê o menu e as 3 páginas;
  - manager não vê e, ao digitar a URL, cai em `/dashboard`;
  - com a flag falsa, nem o admin vê o menu nem `/solicitacoes`.
- [ ] **Step 4:** controller commita `feat(M25-T8): rotas, menu e dados do LeadHunter no frontend`.

---

### Task 9: Tela de campanhas

**Files:**
- Create: `packages/frontend/src/components/leadhunter/{CampaignFields,CampaignDialog,ImportDialog,SendContactsDialog,CompaniesTable,CampaignSummary}.tsx`
- Modify: `packages/frontend/src/pages/leadhunter/CampaignsPage.tsx`

**Depends-on:** T8, T10

**Interfaces:**
- Consome: hooks de T8 e `CompanyDrawer` de T10.
- Produz, para T13:

```ts
export const campaignFieldsSchema: z.ZodObject<…>; // niche, city, service, limit, keywords (textarea), coordinates (textarea), enrich, useJev, forceRefresh — limites da seção Global Constraints
export type CampaignFieldsValues = z.infer<typeof campaignFieldsSchema>;
export function CampaignFields(props: { form: UseFormReturn<CampaignFieldsValues>; maxLimit?: number }): JSX.Element; // campos + linha de estimativa (useEstimate)
```

- Conteúdo, seguindo `index.html`/`app.js` do LeadHunter:
  - lista de campanhas recentes (lateral no desktop, `select` no mobile);
  - cabeçalho com selo (`DADOS FICTÍCIOS`, `BASE IMPORTADA`, `COLETA REAL`, `Pedido de <nome>`);
  - avisos; barra de progresso + “Cancelar busca”; 4 cartões de totais; linha de consumo;
  - filtros (busca, prioridade, etapa), tabela com seleção, nota “Prioridade comercial ≠ posição no Google”;
  - botões “Nova campanha”, “Importar lista”, “↓ Exportar CSV”, “Criar contatos”;
  - estado vazio com “Explorar demonstração” (mesma campanha demo de `app.js`).
- `CampaignDialog`: rádio Demonstração/Coleta real + `<CampaignFields>`; “Avançado” recolhível com termos, pontos e as 3 caixas.
- `ImportDialog`: arquivo CSV/JSON ≤1 MB, campos nicho, cidade e serviço, links para os exemplos (copiar `example.csv`/`example.json` do LeadHunter para `packages/frontend/public/leadhunter/`).
- `SendContactsDialog`: todas ou marcadas; responsável (`useUsers()`, opção “Sem responsável”); resultado “N criado(s) · N já existia(m) · N com erro · N excluída(s)”.

- [ ] **Step 1:** implementar.
- [ ] **Step 2:** `npm run lint` e `npm run build` do frontend. Esperado: zero erros.
- [ ] **Step 3:** conferir no navegador, a 1366 px e a 390 px (sem rolagem horizontal):
  - demo do início ao fim;
  - importar `example.csv`;
  - filtrar e exportar (o arquivo abre no Excel com acentos);
  - abrir a ficha;
  - criar contatos de 3 empresas e ver em `/contacts` com dono e `lead_score`;
  - reenviar → “Nenhuma empresa nova”.
- [ ] **Step 4:** controller commita `feat(M25-T9): tela de campanhas do LeadHunter`.

---

### Task 10: Ficha da empresa

**Files:**
- Create: `packages/frontend/src/components/leadhunter/CompanyDrawer.tsx` (e subcomponentes no mesmo diretório, se passar de ~300 linhas)

**Depends-on:** T8

**Interfaces:**
- Consome: `useCampaign` (dados já carregados), `useCompanyHistory`, `useUpdateCompany`, `useDeleteCompany`.
- Produz: `export function CompanyDrawer(props: { company: Company | null; campaign: Campaign; onClose(): void }): JSX.Element` (painel lateral; `Modal`/Radix Dialog do CRM).

Seções na ordem da ficha do LeadHunter (inventário §6), **sem** “Site” e sem “CRM externo”:
- cabeçalho (prioridade, score/100, completude) e avisos (demo, região);
- informações principais;
- “Por que conferir esta empresa?” (motivos e rótulo do fit);
- Instagram (candidatos, campo de URL, Confirmar/Rejeitar);
- visibilidade observada;
- histórico entre campanhas (só com 2+ campanhas);
- “No CRM” (situação de `crm` com link para `/contacts/:id`);
- acompanhamento (etapa, notas ≤5000, salvar, excluir com confirmação).

- [ ] **Step 1:** implementar.
- [ ] **Step 2:** `npm run lint` e `npm run build` do frontend. Esperado: zero erros.
- [ ] **Step 3:** conferir no navegador:
  - confirmar Instagram e recarregar (persiste);
  - mudar a etapa para “Não contatar” → sai do cartão “Prioridade alta”;
  - excluir empresa de campanha `running` → mensagem do 409.
- [ ] **Step 4:** controller commita `feat(M25-T10): ficha da empresa no LeadHunter`.

---

### Task 11: Locais pesquisados, Empresas já encontradas e Integrações

**Files:**
- Modify: `packages/frontend/src/pages/leadhunter/{SearchesPage,IntegrationsPage}.tsx`
- Create: `packages/frontend/src/components/leadhunter/{SearchCards,FoundCompaniesTable}.tsx`

**Depends-on:** T8

**Interfaces:**
- Consome: `useSearches`, `useFoundCompanies`, `useExportFound`, `useLeadHunterStatus`.
- “Nova campanha com este local” e “Atualizar agora” navegam para `/leadhunter?novo=1&keyword=…&location=…&force=1`. T9 lê esses parâmetros para abrir o `CampaignDialog` preenchido (o contrato de query string fica aqui; T9 consome).

- [ ] **Step 1:** implementar conforme o inventário §3 (cartões agrupados por local, selo “expirada”) e §6 (tabela com busca, “Mostrar demonstração”, exportar selecionadas/todas, nota de truncado em 2000, coluna CRM “Criado/Já existia/Erro/Não enviado”).
  - Integrações mostra DataForSEO e Jev “configurado · não testado” ou “aguardando”, os limites, as chamadas de hoje e o modelo Jev.
- [ ] **Step 2:** `npm run lint` e `npm run build` do frontend. Esperado: zero erros.
- [ ] **Step 3:** conferir no navegador:
  - após uma demo, o local aparece;
  - “Atualizar agora” abre o formulário com “Forçar busca nova” marcado (depende de T9 na conferência final);
  - exportar todas baixa CSV sem empresas demo.
- [ ] **Step 4:** controller commita `feat(M25-T11): locais pesquisados e integrações do LeadHunter`.

---

### Task 12: Pedidos de leads — backend novo

**Files:**
- Create: `packages/backend/src/db/migrations/20240038_lead_requests_leadhunter.ts`, `packages/backend/src/modules/leadhunter/delivery.ts`
- Modify: `packages/backend/src/modules/lead-requests/{lead-requests.schema,lead-requests.service,lead-requests.controller,lead-requests.routes}.ts`, `packages/backend/src/modules/public/public.routes.ts` (remover `router.use('/lead-requests', …)`), `packages/backend/src/server.ts` (registrar `onCampaignFinished.handler = deliverForCampaign`)
- Delete: `packages/backend/src/modules/lead-requests/lead-requests.public.routes.ts`
- Test: `packages/backend/src/modules/lead-requests/lead-requests.int.test.ts`

**Depends-on:** T7

**Interfaces:**
- Consome: `createCampaignChecked` e `sendCompaniesToContacts` (T7), `onCampaignFinished` (T6), `store.getCampaign`/`companies`, `createNotification`.
- **Migração `20240038`:**
  - `lead_requests` + `service varchar(20) not null default 'google'`, `keywords jsonb not null default '[]'`, `coordinates jsonb not null default '[]'`, `enrich boolean not null default true`, `use_jev boolean not null default true`, `force_refresh boolean not null default false`, `campaign_id uuid null → lh_campaigns SET NULL`, `decided_by uuid null → users SET NULL`;
  - `UPDATE lead_requests SET status='queued', claimed_at=null, claim_expires_at=null WHERE status IN ('claimed','running')`.
  - O CHECK de status fica como está (`claimed` só deixa de ser usado).
- **Schema:** `createLeadRequestSchema` passa a validar os mesmos campos de `validateCampaign` (sem `source`) + `notes ≤1000`, aceitando camelCase (`useJev`, `forceRefresh`). Novo `executeLeadRequestSchema` = os mesmos campos, todos opcionais (edição do admin). Novo `rejectLeadRequestSchema = { message: string 1–500 }`.
- **Rotas** (`/api/v1/lead-requests`, router com `requireAuth` + `requireLeadHunter`):
  - `GET /`, `POST /`, `GET /:id`, `POST /:id/cancel`, como hoje;
  - `POST /:id/execute`: `requireRole('admin')`;
  - `POST /:id/reject`: `requireRole('admin')`.
- **Serviço:**
  - `createLeadRequest(tenantId, viewer, input)`:
    - não-admin → cotas atuais, `queued`;
    - admin → sem cota diária, mas `quantity ≤ lead_request_max_quantity`; cria o pedido e, na **mesma** chamada, `createCampaignChecked(..., { leadRequestId })`; status `running`, `campaign_id` gravado.
    - Se `createCampaignChecked` recusar (400), o pedido não é criado: tudo numa transação ou o pedido inserido só depois do sucesso.
  - `executeLeadRequest(tenantId, adminId, id, edits)`:
    - portão atômico `UPDATE … WHERE status='queued'` → `running`;
    - aplica as edições;
    - cria a campanha;
    - falha 400 → volta para `queued` e propaga o erro;
    - 409 `not_queued` se outro admin já executou.
  - `rejectLeadRequest(tenantId, adminId, id, message)`: só `queued` → `cancelled` + `message` + `decided_by`; notifica quem pediu (`type: 'lead_request.rejected'`, título “Seu pedido de leads foi recusado”).
  - Remover `claimLeadRequest`, `progressLeadRequest`, `listQueue`, `requeueExpired` e `deliverLeadRequest` (o conteúdo útil de `deliverLeadRequest` vai para `delivery.ts`).
- **`delivery.ts`:** `deliverForCampaign(tenantId: string, campaignId: string): Promise<void>`.
  - No-op se nenhum `lead_request` tem esse `campaign_id` com status `running`.
  - Senão, numa transação:
    - portão `running` → estado final pelo mapeamento D10 (spec 7.4);
    - `sendCompaniesToContacts(…, { ownerId: requester ativo ou null, leadRequestId, trx })` com as empresas da campanha;
    - `lead_assignments` se o requester é captador;
    - `delivered_count`, `finished_at` e `message`, com a mensagem da campanha + “N já existiam no CRM”.
  - Depois do commit, `createNotification` (`lead_request.finished`, títulos de `FINISHED_TITLES`) só se o requester é membro ativo.

- [ ] **Step 1: Escrever os testes que falham** (com banco; `Providers` falso injetado via `startWorker`/`runNext` de T6):
  - `'captador cria pedido queued sem nenhuma chamada paga'`;
  - `'seller não consegue executar: 403'` (middleware em sequência, como em T7);
  - `'admin executa pedido de captador: contatos do captador, lead_assignments e notificação'`;
  - `'admin cria pedido próprio: campanha criada na hora e status running'`;
  - `'admin cria pedido com estimativa acima do limite: 400 e nenhum pedido gravado'`;
  - `'dois admins executam o mesmo pedido: o segundo recebe 409 not_queued'`;
  - `'recusa notifica e vira cancelled com a mensagem'`;
  - `'requester saiu do workspace: contatos sem dono e sem notificação'`;
  - `'campanha failed por 40501: pedido failed com a mensagem do provedor e 0 contatos'` (Review Focus 4);
  - `'empresas discarded/do_not_contact nunca viram contato do pedido'`;
  - `'flag desligada: /lead-requests responde 404'`;
  - `'migração devolve claimed/running para queued'`.
- [ ] **Step 2:** `TEST_DATABASE_URL=… npm run test --workspace=packages/backend -- lead-requests`. Esperado: FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar **toda** a suíte do backend e o `tsc`. Esperado: PASS.
- [ ] **Step 5:** controller commita `feat(M25-T12): pedidos de leads executados pelo admin dentro do CRM`.

---

### Task 13: Pedidos de leads — frontend novo

**Files:**
- Modify: `packages/frontend/src/components/lead-requests/LeadRequestForm.tsx`, `packages/frontend/src/pages/lead-requests/LeadRequestsPage.tsx`, `packages/frontend/src/services/leadRequests.service.ts`, `packages/frontend/src/hooks/useLeadRequests.ts`, `packages/frontend/src/components/layout/AppShell.tsx` (`CAPTADOR_PATHS` + `'/solicitacoes'`)
- Create: `packages/frontend/src/components/lead-requests/{ExecuteRequestDialog,RejectRequestDialog}.tsx`

**Depends-on:** T9, T12

**Interfaces:**
- Consome: `CampaignFields`/`campaignFieldsSchema` (T9) e as rotas de T12.
- Produz: `leadRequestsService.execute(id, edits)` e `.reject(id, message)`; hooks `useExecuteLeadRequest()` e `useRejectLeadRequest()`; `LeadRequestStatus` sem `'claimed'`; `LeadRequest` com `service`, `keywords`, `coordinates`, `enrich`, `use_jev`, `force_refresh`, `campaign_id`.

**Comportamento:**
- O formulário usa `<CampaignFields maxLimit={tenant.lead_request_max_quantity}>` + Observações.
  - Para admin, mostra a linha de estimativa e o botão “Buscar agora”.
  - Para os demais, o botão “Enviar pedido” e o texto “Um admin vai revisar e executar seu pedido.”
- Lista:
  - status “Aguardando admin” (`queued`) e “Buscando” (`running`);
  - admin vê, em pedidos `queued`, “Executar” (abre `ExecuteRequestDialog` com os campos preenchidos e editáveis + estimativa) e “Recusar” (motivo obrigatório);
  - pedido com `campaign_id`, visto por admin, tem link “Ver campanha” → `/leadhunter?c=<id>`;
  - captador continua vendo os leads entregues com link para “Meus leads”.

- [ ] **Step 1:** implementar.
- [ ] **Step 2:** `npm run lint` e `npm run build` do frontend. Esperado: zero erros.
- [ ] **Step 3:** conferir no navegador, com backend local, banco descartável e `DATAFORSEO_*` **vazio** (nenhum crédito gasto; o caminho feliz completo é coberto pelos testes de T12 e pelo aceite de T15):
  - captador abre `/solicitacoes` sem ser redirecionado, envia um pedido e vê “Aguardando admin”;
  - admin recusa um pedido → o captador recebe a notificação com o motivo;
  - admin clica em “Executar” noutro → aparece a mensagem de “sem credenciais” do backend e o pedido continua “Aguardando admin”;
  - seller não vê os botões “Executar”/“Recusar”.
- [ ] **Step 4:** controller commita `feat(M25-T13): solicitações de leads com os campos do LeadHunter`.

---

### Task 14: Migração do histórico do Radar Local

**Files:**
- Create: `../LeadHunter/scripts/export_for_crm.py` (repo LeadHunter), `packages/backend/scripts/import-leadhunter.ts`
- Test: `packages/backend/src/modules/leadhunter/import-script.int.test.ts` (fixture `packages/backend/src/test/fixtures/radar-export.json`, gerada pelo próprio export a partir de um SQLite com a campanha demo + 1 importação)

**Depends-on:** T6 (o teste de reaproveitamento usa `estimateCalls`); roda na mesma onda que T13 (arquivos disjuntos)

**Interfaces:**
- `export_for_crm.py <radar.sqlite3> <saida.json>`:
  - só biblioteca padrão; abre o SQLite em **somente leitura** (`file:...?mode=ro`, `uri=True`);
  - exporta `campaigns` (sem `crm_request`), `leads` (com `stage`, `notes` e `crm`), `campaign_leads`, `observations`, `search_coverage`, `searches`, `api_calls`;
  - ignora `sites` e `crm_requests`.
- `import-leadhunter.ts`:
  - uso `tsx scripts/import-leadhunter.ts --tenant <uuid> --file <json>`;
  - converte as chaves do `data` para camelCase (`instagram_status` → `instagramStatus`, etc.);
  - `identity` = id do lead no SQLite;
  - ids do SQLite viram uuid novos com mapa em memória;
  - **só insere**: `ON CONFLICT DO NOTHING` em `(tenant_id, identity)` para empresas; o resto é pulado se a campanha de origem (chave `config.radarId`, gravada na importação) já existe;
  - imprime contagens por tabela;
  - recusa rodar se o tenant não existe.

- [ ] **Step 1: Escrever os testes que falham:**
  - `'importa contagens iguais às do JSON'`;
  - `'rodar duas vezes não duplica nada'`;
  - `'etapa, notas e Instagram confirmado chegam intactos'`;
  - `'busca importada é reaproveitada por estimateCalls'` (com `executed_at` recente na fixture).
- [ ] **Step 2:** rodar. Esperado: FAIL.
- [ ] **Step 3:** implementar os dois scripts.
- [ ] **Step 4:** rodar de novo. Esperado: PASS. Rodar `python scripts/export_for_crm.py data/radar.sqlite3 %TEMP%/radar.json` no LeadHunter e conferir que o SQLite **não** mudou (mesmo hash antes e depois).
- [ ] **Step 5:** controller commita no CRM `feat(M25-T14): importação do histórico do Radar Local` e, no LeadHunter, `feat: exportação do histórico para o CRM`.

---

### Task 15: Corte e limpeza

**Files:**
- Modify: `packages/backend/src/modules/public/public.routes.ts` (remover `POST /leads/bulk` e `leadsBulkSchema`; `leadHunterLeadSchema` fica se ainda tiver uso, senão sai junto)

**Depends-on:** T13, T14

- [ ] **Step 1:** remover a rota e rodar `tsc` + toda a suíte do backend + `npm run build` do frontend. Esperado: tudo verde.
- [ ] **Step 2:** controller commita `chore(M25-T15): remove envio externo do LeadHunter`.
- [ ] **Step 3 — runbook de produção (só com autorização explícita do usuário em cada passo; envolve créditos do DataForSEO e dados reais):**
  1. deploy da `main` no Railway (as migrações `20240037`/`20240038` rodam no boot) e configurar `DATAFORSEO_*`, `TYPESAFE_*` e `LEADHUNTER_*` no Railway;
  2. parar o Radar Local;
  3. exportar o SQLite e rodar `import-leadhunter.ts` contra o `DATABASE_URL` de produção, passado só como variável do processo, com o tenant da Estus;
  4. `UPDATE tenants SET leadhunter_enabled = true WHERE id = '<estus>'`;
  5. **aceite:**
     - campanha real repetindo um local migrado (dentro de 30 dias) → 0 chamadas Maps;
     - captador pede → admin executa → leads no perfil do captador com notificação;
     - seller não consegue executar;
  6. revogar a chave de API do Radar em Integrações;
  7. **rollback:** `leadhunter_enabled = false` e religar o Radar (SQLite intacto).
- [ ] **Step 4:** whole-branch review (ver Execution Handoff) e registrar o resultado.
