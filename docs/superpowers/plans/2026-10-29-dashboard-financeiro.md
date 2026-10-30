# Dashboard financeiro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botão "Financeiro" no Dashboard (só admin) que troca o conteúdo por um painel com receita, impostos, gastos, pró-labore, lucro líquido, contas a pagar e divisão do lucro entre sócios.

**Architecture:** Módulo backend novo `modules/finance` com um núcleo de cálculo puro (`finance.calc.ts`, centavos inteiros, testado sem banco) e um serviço que só lê/grava e chama o cálculo. Frontend: troca de estado dentro de `DashboardPage` (`overview` | `finance`), componentes novos em `components/finance/`, hooks TanStack Query em `hooks/useFinance.ts`.

**Tech Stack:** Express + Knex + Zod + vitest (backend); React + TanStack Query + React Hook Form + Zod + framer-motion + Tailwind (frontend).

**Spec:** [docs/superpowers/specs/2026-10-29-dashboard-financeiro-design.md](../specs/2026-10-29-dashboard-financeiro-design.md)

## Global Constraints

- **Só `admin`**: toda rota `/api/v1/finance/*` usa `requireAuth` → `requireRole('admin')` (403 para os demais); o botão só renderiza para `user.role === 'admin'`.
- Todo serviço recebe `tenantId` como **primeiro argumento** e toda query filtra `tenant_id`. Item de outro tenant → **404**.
- Resposta `{ data }`; validação Zod → 422; erro de regra de negócio = `Object.assign(new Error(msg), { status, code })`.
- Regime de **competência**: todas as ocorrências do mês entram no lucro, pagas ou não; `pendingTotal` é só o saldo não pago.
- Dinheiro: `numeric(14,2)` no banco; **centavos inteiros** dentro de `finance.calc.ts`; a API devolve **reais** (number com 2 casas).
- Datas `date` do Postgres: sempre ler como texto (`to_char(col,'YYYY-MM-DD')`), nunca como `Date` (evita deslocamento de fuso). "Hoje" e o mês de `closed_at` usam `America/Sao_Paulo`.
- Mês é sempre `'YYYY-MM'`; em `finance_payments.month` grava-se o dia 1 (`YYYY-MM-01`).
- Migration **`20240048_create_finance_tables`** (`up` e `down`). Antes de criar: `git fetch` e conferir o maior número em `origin/main` (hoje `20240047`). **Nunca** rodar `npm run dev`/`dev:backend`/`migrate:latest` com o `.env` de produção; migrar só `titancrm`/`titancrm_test`. A migration é commitada no mesmo commit do código que a usa.
- Textos de UI em pt-BR; dinheiro no financeiro com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` completo (não compacto).
- Commits no padrão `feat(M30-T1): …` com o trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; trabalho direto na `main`. Cada task termina verde (`npx tsc --noEmit -p packages/backend`, testes unitários, `npm run build --workspace=packages/frontend`) antes do commit e do push.
- Testes de integração exigem `TEST_DATABASE_URL` (banco local `*_test`). Sem ela, **não declarar que passaram** — reportar "escritos, não executados".

## Review Focus

1. Mês sem receita e sem nenhuma configuração: nada de `NaN`/divisão por zero; o painel mostra estado vazio guiado (testes: Task 1 `noConfig`, receita 0).
2. Sócios com % somando ≠ 100: API recusa com 422 `invalid_shares`; se vier do banco inconsistente, o resumo avisa e **não** distribui (testes: Task 1 e Task 2).
3. Recorrente com vencimento dia 29–31 em mês curto: cai no último dia do mês (teste: Task 1).
4. Marcar paga duas vezes / desmarcar o que não está paga: idempotente, sem erro (teste: Task 2).
5. Despesa de outro tenant (editar, apagar, marcar paga): 404, sem vazar existência (teste: Task 2).

---

### Task 1: Núcleo de cálculo puro

**Files:**
- Create: `packages/backend/src/modules/finance/finance.calc.ts`
- Test: `packages/backend/src/modules/finance/finance.calc.test.ts`

**Interfaces:**
- Produces (exportados de `finance.calc.ts`; valores em centavos salvo `Dto`):
  - `type Cents = number`
  - `interface ExpenseInput { id: string; description: string; category: string; amount: Cents; kind: 'recurring' | 'one_off'; dueDay: number | null; startsOn: string | null; endsOn: string | null; dueDate: string | null }` (datas `YYYY-MM-DD`)
  - `interface TaxInput { id: string; name: string; rate: number }`
  - `interface PartnerInput { id: string; name: string; sharePercent: number; proLabore: Cents }`
  - `interface CalcInput { month: string; today: string; revenue: Cents; expenses: ExpenseInput[]; paidExpenseIds: ReadonlySet<string>; taxes: TaxInput[]; partners: PartnerInput[] }` (`today` = `YYYY-MM-DD`; `taxes` já só os ativos)
  - `interface Payable { expenseId: string; description: string; category: string; amount: Cents; dueDate: string; status: 'paid' | 'pending' | 'overdue' }`
  - `interface SummaryLine { key: string; label: string; kind: 'revenue' | 'tax' | 'expense' | 'payroll'; amount: Cents }`
  - `interface Distribution { partnerId: string; name: string; sharePercent: number; proLabore: Cents; profitShare: Cents }`
  - `interface MonthSummary { month: string; revenue: Cents; taxesTotal: Cents; expensesTotal: Cents; proLaboreTotal: Cents; netProfit: Cents; pendingTotal: Cents; lines: SummaryLine[]; payables: Payable[]; distribution: Distribution[]; warnings: { partnersShareInvalid: boolean; noConfig: boolean } }`
  - `expenseOccurrence(expense: ExpenseInput, month: string): string | null` — data de vencimento da ocorrência no mês, ou `null`
  - `calcMonth(input: CalcInput): MonthSummary`
  - `summaryToReais(s: MonthSummary): MonthSummaryDto` — mesmo formato com todo campo em centavos dividido por 100 (`MonthSummaryDto` exportado, estruturalmente igual a `MonthSummary` com valores em reais)

- [ ] **Step 1: Escrever os testes (falhando)** em `finance.calc.test.ts` (sem banco), com estes casos e valores:
  - `expenseOccurrence`: recorrente `dueDay 31` em `'2027-02'` → `'2027-02-28'`; recorrente `dueDay 5, startsOn '2026-10-15'` → `null` em `'2026-09'` e `'2026-10-05'` em `'2026-10'`; recorrente com `endsOn '2026-09-30'` → ocorre em `'2026-09'`, `null` em `'2026-10'`; avulsa `dueDate '2026-10-20'` → `'2026-10-20'` em `'2026-10'`, `null` em `'2026-11'`.
  - `calcMonth` cenário base: receita `1_000_000`; impostos 6% e 2%; um gasto recorrente de `300_000`; sócios A (60%, pró-labore `100_000`) e B (40%, `50_000`) → `taxesTotal 80_000`, `expensesTotal 300_000`, `proLaboreTotal 150_000`, `netProfit 470_000`, distribuição A `282_000` e B `188_000`.
  - Arredondamento: `netProfit 100` com sócios 33.33 / 33.33 / 33.34 → partes `[33, 33, 34]` (sobra para o maior %). Imposto: receita `333` × 6% → `20`.
  - Prejuízo: receita `0`, gasto `100_000` → `netProfit -100_000` e todo `profitShare` = `0`.
  - Status: `today '2026-10-20'`; vencida e não paga → `overdue`; vencida e paga → `paid`; vencimento `'2026-10-25'` não paga → `pending`; `pendingTotal` soma `overdue + pending`.
  - `warnings`: sócios somando 90% → `partnersShareInvalid: true` e nenhuma distribuição (`profitShare 0`); nada cadastrado (sem gastos, impostos e sócios) → `noConfig: true`; receita `0` sem configuração → sem `NaN` em nenhum campo.
  - `lines`: ordem `revenue` (`key 'revenue'`), um `tax` por imposto (`tax:<id>`), um `expense` por categoria (`expense:<category>`), `payroll` (`key 'pro_labore'`, só se `proLaboreTotal > 0`).
  - `summaryToReais`: `470_000` → `4700`.
- [ ] **Step 2:** Rodar `npx vitest run src/modules/finance/finance.calc.test.ts` (em `packages/backend`) → FALHA (módulo inexistente).
- [ ] **Step 3: Implementar `finance.calc.ts`** com as assinaturas acima. Algoritmo não óbvio: divisão do lucro em pontos-base (`Math.round(sharePercent*100)`); cada parte `floor(netProfit × bp / 10000)`; a sobra (`netProfit − Σ partes`) vai para o sócio de maior %. Vencimento recorrente = `min(dueDay, último dia do mês)`. Soma dos % válida quando `Math.round(Σ sharePercent × 100) === 10000`; sem sócios, `partnersShareInvalid` é `false`. `netProfit ≤ 0` ou % inválido → todas as partes `0`.
- [ ] **Step 4:** Rodar o mesmo comando → PASSA.
- [ ] **Step 5: Commit** — `git add packages/backend/src/modules/finance && git commit -m "feat(M30-T1): núcleo de cálculo do financeiro (puro, testado)"` (+ trailer) e `git push origin main`.

---

### Task 2: Tabelas, CRUD e rotas protegidas

**Files:**
- Create: `packages/backend/src/db/migrations/20240048_create_finance_tables.ts`
- Create: `packages/backend/src/modules/finance/finance.schemas.ts`, `finance.service.ts`, `finance.controller.ts`, `finance.routes.ts`
- Modify: `packages/backend/src/server.ts` (importar e montar `app.use('/api/v1/finance', financeRoutes)` junto das demais)
- Test: `packages/backend/src/modules/finance/finance.int.test.ts`

**Interfaces:**
- Consumes: nada da Task 1 ainda (o resumo vem na Task 3).
- Produces (`finance.service.ts`; DTOs em camelCase, dinheiro em **reais**, datas `YYYY-MM-DD`):
  - `interface ExpenseDto { id: string; description: string; category: string; amount: number; kind: 'recurring' | 'one_off'; dueDay: number | null; startsOn: string | null; endsOn: string | null; dueDate: string | null }`
  - `interface TaxDto { id: string; name: string; rate: number; isActive: boolean }`
  - `interface PartnerDto { id: string; name: string; sharePercent: number; proLabore: number }`
  - `listExpenses(tenantId)`, `createExpense(tenantId, input)`, `updateExpense(tenantId, id, patch)`, `deleteExpense(tenantId, id)` (404 se não for do tenant)
  - `setPayment(tenantId, expenseId, month, paid): Promise<{ paid: boolean }>` (idempotente; 404 se a despesa não for do tenant; `month` `YYYY-MM`)
  - `listTaxes(tenantId)`, `replaceTaxes(tenantId, taxes)`; `listPartners(tenantId)`, `replacePartners(tenantId, partners)` (transação; soma dos % ≠ 100 com lista não vazia → 422 `code: 'invalid_shares'`)
- Rotas: `GET/POST /expenses`, `PATCH/DELETE /expenses/:id`, `PUT /expenses/:id/payments/:month` (body `{ paid: boolean }`), `GET/PUT /taxes` (body `{ taxes: [{ name, rate, isActive? }] }`), `GET/PUT /partners` (body `{ partners: [{ name, sharePercent, proLabore }] }`).

- [ ] **Step 1: Escrever `finance.int.test.ts`** seguindo o padrão de `lead-requests.int.test.ts` (Express em porta efêmera com as rotas + `errorHandler`, JWT assinado com `jose`, `describe.skipIf(!hasTestDb)`, `migrateTestDb()` em `beforeAll`, tenant novo por teste com `makeTenant()`/`makeUser`). Casos:
  - manager, seller e captador recebem **403** em `GET /expenses`, `GET /taxes`, `GET /partners` (e sem token, 401).
  - Admin cria despesa recorrente e avulsa, lista, edita o `amount`, apaga; payload inválido (ex.: recorrente sem `dueDay`) → 422.
  - **Isolamento:** admin do tenant B recebe **404** ao `PATCH`, `DELETE` e `PUT …/payments/2026-10` de despesa do tenant A; `GET /expenses` de B não lista a de A.
  - **Idempotência:** `PUT payments` com `paid: true` duas vezes deixa **1** linha em `finance_payments`; `paid: false` sem pagamento existente responde 200 `{ data: { paid: false } }`; `month` `'2026-13'` → 422.
  - `PUT /partners` com 60+30 → 422 `code: 'invalid_shares'`; 60+40 → 200; `PUT` com lista vazia → 200; `PUT /taxes` substitui a lista (a antiga some).
- [ ] **Step 2:** Rodar `npx vitest run src/modules/finance/finance.int.test.ts` → FALHA (ou "pulado" se não houver `TEST_DATABASE_URL`; nesse caso seguir e registrar que não pôde ser executado).
- [ ] **Step 3: Migration** `20240048_create_finance_tables` com as quatro tabelas exatamente como na seção "Modelo de dados" do spec (`finance_expenses` com os `CHECK` por `kind`, `finance_payments` com `UNIQUE (expense_id, month)`, `finance_taxes.kind` default `'percent_revenue'`, `finance_partners`); `down` derruba na ordem inversa. `tenant_id` com FK e `ON DELETE CASCADE`.
- [ ] **Step 4: Schemas Zod** (`finance.schemas.ts`): `createExpenseSchema` (união discriminada por `kind`: recorrente exige `dueDay` 1–31 e `startsOn`; avulsa exige `dueDate`; `amount >= 0`), `updateExpenseSchema` (parcial, **sem** `kind`), `setPaymentSchema`, `monthParamSchema` (regex `^\d{4}-(0[1-9]|1[0-2])$`), `replaceTaxesSchema`, `replacePartnersSchema`.
- [ ] **Step 5: Serviço + controller + rotas** com as assinaturas acima; `router.use(requireAuth, requireRole('admin'))` no topo de `finance.routes.ts`; montar em `server.ts`. Conversão reais↔`numeric` na borda do serviço; datas lidas com `to_char`.
- [ ] **Step 6:** `npx tsc --noEmit -p packages/backend` (da raiz) sem erros; rodar o teste de integração se houver `TEST_DATABASE_URL` → PASSA.
- [ ] **Step 7: Commit** — `git add` da migration, do módulo, do `server.ts` e do teste; `git commit -m "feat(M30-T1): tabelas e API de gastos, impostos e sócios (admin)"`; `git push origin main`.

---

### Task 3: Resumo do mês (`GET /summary`)

**Files:**
- Modify: `packages/backend/src/modules/finance/finance.service.ts`, `finance.controller.ts`, `finance.routes.ts`
- Test: `packages/backend/src/modules/finance/finance.int.test.ts` (novos casos)

**Interfaces:**
- Consumes (Task 1): `calcMonth`, `summaryToReais`, `MonthSummaryDto`, `CalcInput`. (Task 2): leituras de despesas/impostos/sócios.
- Produces: `getSummary(tenantId: string, month: string): Promise<MonthSummaryDto>`; rota `GET /api/v1/finance/summary?month=YYYY-MM` → `{ data: MonthSummaryDto }` (sem `month` = mês atual em `America/Sao_Paulo`).

- [ ] **Step 1: Escrever os testes de integração:** tenant com 2 negócios `won` fechados em `2026-10` (R$ 6.000 e R$ 4.000), 1 `won` em `2026-09`, 1 `open`, e um `won` de **outro tenant** em `2026-10`; imposto 10%; gasto recorrente R$ 1.000; sócio único 100% com pró-labore R$ 500 → `GET /summary?month=2026-10` devolve `revenue 10000`, `taxesTotal 1000`, `expensesTotal 1000`, `proLaboreTotal 500`, `netProfit 7500`, distribuição `[7500]`; marcar o gasto pago zera `pendingTotal` **sem** alterar `netProfit`; `month=2026-9` → 422; manager → 403.
- [ ] **Step 2:** Rodar o teste → FALHA.
- [ ] **Step 3: Implementar `getSummary`:** receita = `SUM(value)` de `deals` do tenant com `status='won'` e `date_trunc('month', closed_at AT TIME ZONE 'America/Sao_Paulo')` igual ao mês; pagamentos do mês em `finance_payments` → `paidExpenseIds`; `today` em `America/Sao_Paulo`; só impostos `is_active`; monta o `CalcInput` em centavos, chama `calcMonth` e `summaryToReais`.
- [ ] **Step 4:** `npx tsc --noEmit -p packages/backend` e `npx vitest run src/modules/finance` (calc + integração se houver banco) → PASSA.
- [ ] **Step 5: Commit** — `feat(M30-T1): resumo mensal do financeiro (GET /finance/summary)`; `git push origin main`.

---

### Task 4: Serviço e hooks do frontend + utilitários de mês

**Files:**
- Create: `packages/frontend/src/services/finance.service.ts`, `packages/frontend/src/hooks/useFinance.ts`, `packages/frontend/src/lib/finance.ts`

**Interfaces:**
- Consumes: contrato HTTP da Task 2/3.
- Produces:
  - `lib/finance.ts`: `currentMonth(): string` (mês local `YYYY-MM`), `shiftMonth(month: string, delta: number): string`, `formatMonth(month: string): string` (`'Out/2026'`, abreviação pt-BR com inicial maiúscula), `formatBRL(value: number): string`.
  - `finance.service.ts`: tipos `ExpenseDto`, `TaxDto`, `PartnerDto`, `MonthSummaryDto` (espelham o backend; `MonthSummaryDto.payables[].status`, `lines[].kind`, `warnings`) e `financeService` com `getSummary(month)`, `listExpenses()`, `createExpense(input)`, `updateExpense(id, patch)`, `deleteExpense(id)`, `setPayment(id, month, paid)`, `getTaxes()`, `saveTaxes(taxes)`, `getPartners()`, `savePartners(partners)`.
  - `hooks/useFinance.ts`: `financeKeys` (raiz `['finance']`), `useFinanceSummary(month)` (`placeholderData: keepPreviousData`), `useExpenses()`, `useTaxes()`, `usePartners()`, `useSaveExpense()` (cria ou atualiza conforme `id`), `useDeleteExpense()`, `useSetPayment()`, `useSaveTaxes()`, `useSavePartners()`; toda mutação invalida `financeKeys.all`.

- [ ] **Step 1:** Criar os três arquivos com as assinaturas acima (padrão de `reports.service.ts` / `useReports.ts`).
- [ ] **Step 2:** Verificar `shiftMonth('2026-01', -1) === '2025-12'`, `shiftMonth('2026-12', 1) === '2027-01'` e `formatMonth('2026-10') === 'Out/2026'` com um `node -e` descartável (sem arquivo de teste: o frontend não tem vitest).
- [ ] **Step 3:** `npm run build --workspace=packages/frontend` → sem erros TS.
- [ ] **Step 4: Commit** — `feat(M30-T1): serviço e hooks do financeiro no frontend`; `git push origin main`.

---

### Task 5: Painel financeiro (leitura + pagar conta)

**Files:**
- Create: `packages/frontend/src/components/finance/FinanceView.tsx`, `MonthNavigator.tsx`, `ProfitFlowCard.tsx`, `PayablesCard.tsx`, `PartnersSplitCard.tsx`

**Interfaces:**
- Consumes (Task 4): `useFinanceSummary`, `useSetPayment`, `formatBRL`, `formatMonth`, `shiftMonth`, `currentMonth`.
- Produces:
  - `MonthNavigator({ month, onChange }: { month: string; onChange: (m: string) => void })` — `‹ Out/2026 ›`, o botão `›` fica desabilitado no mês atual.
  - `FinanceView({ month, onOpenSettings }: { month: string; onOpenSettings: () => void })`.

- [ ] **Step 1:** `FinanceView`: carregando → `Spinner`; `warnings.noConfig` e receita 0 → `EmptyState` com ação "Configurar" (`onOpenSettings`); caso normal, grade de 4 `KpiCard` (`sparkline={false}`): **Receita**, **Impostos**, **Gastos + pró-labore** (`expensesTotal + proLaboreTotal`), **Lucro líquido** (`highlight`; negativo em vermelho com sub "Prejuízo no mês"), cada um com `icon` do lucide; botão **Configurar** (`CardAction`) no topo. Abaixo, `grid lg:grid-cols-2` com `ProfitFlowCard` e `PartnersSplitCard`, e `PayablesCard` em largura total. Cada card dentro de `div` (regra `.mobile-sections`), usando `.card p-5` + `CardHeader`.
- [ ] **Step 2:** `ProfitFlowCard` ("Para onde vai a receita"): uma linha por `summary.lines` com rótulo, valor e barra proporcional à receita (largura `min(100, amount/revenue*100)%`; receita 0 → barras vazias, sem divisão por zero), mais linha final "Lucro líquido".
- [ ] **Step 3:** `PayablesCard` ("Contas a pagar"): lista de `payables` ordenada por vencimento (`dd/MM`), selo `Paga` (verde) / `Pendente` (âmbar) / `Atrasada` (vermelho), checkbox que chama `useSetPayment` (`{ id, month, paid }`) com estado otimista via invalidação; rodapé "A pagar: {pendingTotal}". Lista vazia → texto "Nenhuma conta neste mês".
- [ ] **Step 4:** `PartnersSplitCard` ("Divisão do lucro"): por sócio, nome, %, pró-labore e `profitShare`; aviso âmbar se `warnings.partnersShareInvalid` ("Os percentuais dos sócios não somam 100%"); lucro ≤ 0 → "Sem lucro a distribuir"; sem sócios → texto com link "Cadastrar sócios" que chama `onOpenSettings` (passar como prop).
- [ ] **Step 5:** `npm run build --workspace=packages/frontend` → sem erros.
- [ ] **Step 6: Commit** — `feat(M30-T1): painel financeiro (KPIs, contas a pagar, divisão do lucro)`; `git push origin main`.

---

### Task 6: Modal de configuração — aba Gastos

**Files:**
- Create: `packages/frontend/src/components/finance/FinanceSettingsModal.tsx`, `ExpensesTab.tsx`

**Interfaces:**
- Consumes: `Modal`, `Input`, `Button`, `useExpenses`, `useSaveExpense`, `useDeleteExpense`.
- Produces: `FinanceSettingsModal({ open, onClose }: { open: boolean; onClose: () => void })` com abas `Gastos` | `Impostos` | `Sócios` (`SegmentedControl`, `layoutId="finance-settings-tab"`); nesta task só `Gastos` funciona e as outras duas mostram um componente provisório vazio que a Task 7 substitui. Aviso fixo no topo: "Alterações valem para todos os meses, inclusive os já passados."

- [ ] **Step 1:** `ExpensesTab`: lista de gastos (descrição, categoria, valor, tipo "Mensal dia X" / "Avulso dd/MM/aaaa") com editar e excluir (confirmação inline "Excluir? Sim/Não"); formulário com React Hook Form + Zod: descrição, categoria (input com `datalist`: Aluguel, Software, Marketing, Folha, Impostos/guias, Outros), valor, tipo (`SegmentedControl` Mensal/Avulso), e conforme o tipo `dueDay` + `startsOn` (+ `endsOn` opcional) ou `dueDate`. Valor digitado em reais com vírgula aceito (`"1.234,56"` → `1234.56`).
- [ ] **Step 2:** `npm run build --workspace=packages/frontend` → sem erros.
- [ ] **Step 3: Commit** — `feat(M30-T1): configuração de gastos do financeiro`; `git push origin main`.

---

### Task 7: Modal de configuração — abas Impostos e Sócios

**Files:**
- Create: `packages/frontend/src/components/finance/TaxesTab.tsx`, `PartnersTab.tsx`
- Modify: `packages/frontend/src/components/finance/FinanceSettingsModal.tsx` (trocar os provisórios)

**Interfaces:**
- Consumes: `useTaxes`, `useSaveTaxes`, `usePartners`, `useSavePartners`.

- [ ] **Step 1:** `TaxesTab`: linhas editáveis (nome, alíquota %, ativo) com adicionar/remover e botão "Salvar" (`useSaveTaxes`, substitui a lista); alíquota entre 0 e 100; mostra "Total sobre a receita: X%".
- [ ] **Step 2:** `PartnersTab`: linhas (nome, % de participação, pró-labore mensal) com adicionar/remover; mostra a soma dos % em tempo real (verde em 100, âmbar caso contrário) e **desabilita "Salvar"** enquanto a lista não vazia não somar 100; erro 422 `invalid_shares` do servidor exibido sob o botão.
- [ ] **Step 3:** `npm run build --workspace=packages/frontend` → sem erros.
- [ ] **Step 4: Commit** — `feat(M30-T1): configuração de impostos e sócios do financeiro`; `git push origin main`.

---

### Task 8: Botão e transição no Dashboard

**Files:**
- Modify: `packages/frontend/src/pages/dashboard/DashboardPage.tsx`

**Interfaces:**
- Consumes: `FinanceView`, `MonthNavigator`, `FinanceSettingsModal`, `currentMonth`, `useStickyState`, `useAuthStore`, `pageMotion` (`lib/motion.ts`).

- [ ] **Step 1:** Estado `view` via `useStickyState<'overview' | 'finance'>('dashboard.view', 'overview')` e `financeMonth` via `useStickyState('dashboard.financeMonth', currentMonth())`; `isAdmin = user?.role === 'admin'`; `activeView = isAdmin ? view : 'overview'`.
- [ ] **Step 2:** Cabeçalho (`flex flex-wrap items-end justify-between gap-4`): à esquerda título/subtítulo (no modo financeiro: "Resultado real do mês"); à direita um grupo `flex items-center gap-3` com, no modo geral, o `SegmentedControl` de períodos (com `mr-2`/`md:mr-4` para afastar da borda) e, no modo financeiro, o `MonthNavigator`; ao final, **só para admin**, o botão (`Button`, ícone `Landmark`/`LayoutDashboard`) "Financeiro" ↔ "Visão geral".
- [ ] **Step 3:** Corpo envolvido em `AnimatePresence mode="wait"` com `motion.div` (`key={activeView}` e `{...pageMotion}`); `overview` mantém **exatamente** o conteúdo atual (barra do plano Free, KPIs, gráficos, atividades); `finance` renderiza `FinanceView`. `FinanceSettingsModal` montado uma vez, aberto por `settingsOpen`.
- [ ] **Step 4:** `npm run build --workspace=packages/frontend` → sem erros TS.
- [ ] **Step 5: Verificação manual** no banco **local** (confirmar `DATABASE_URL` = `localhost` antes de subir o backend): logar como `admin.teste@titanflow.local` (workspace `demo-titanflow`, senha `Demo@1234`) → botão visível, transição suave, cadastrar gasto/imposto/sócios, conferir o lucro; logar como `vendedor.teste@titanflow.local` e `captador.teste@titanflow.local` → botão ausente e `GET /api/v1/finance/summary` → 403. Se o ambiente local não puder subir, dizer isso explicitamente em vez de afirmar que funciona.
- [ ] **Step 6: Commit** — `feat(M30-T1): botão Financeiro no Dashboard com transição`; `git push origin main`.

---

### Task 9: Documentação

**Files:**
- Modify: `CLAUDE.md` (tabela de milestones, seção **Next**, **Key implementation notes**), `plan.md`

- [ ] **Step 1:** Em `CLAUDE.md`: linha `M30 T1 | Dashboard financeiro (lucro líquido, contas a pagar, divisão entre sócios), migration 20240048 | ✅ Done`; nota nova no topo de **Key implementation notes** (módulo `modules/finance`, cálculo puro em `finance.calc.ts` em centavos, regime de competência, só admin, configuração vale para o presente — fechamento de mês é a próxima evolução, link para o spec); remover/encurtar notas obsoletas só se contradisserem. Espelhar em `plan.md`.
- [ ] **Step 2: Commit** — `docs: atualiza CLAUDE.md pós M30-T1`; `git push origin main`.

---

## Self-review (feito)

- **Cobertura do spec:** modelo de dados e `CHECK`s (T2), cálculo e arredondamento (T1), API e validações (T2/T3), tela, transição, mobile e estados vazios (T5/T8), configuração (T6/T7), limitações documentadas (T6 aviso, T9), testes (T1–T3). "Evolução prevista" fica fora por definição do spec.
- **Decisões que o plano fixa e o spec deixava abertas:** fuso `America/Sao_Paulo` para "hoje" e para o mês de `closed_at`; API devolve reais; mês sem `?month` = mês atual; categoria como texto livre com sugestões.
- **Consistência de nomes:** `MonthSummaryDto`, `calcMonth`, `summaryToReais`, `ExpenseDto/TaxDto/PartnerDto` e `financeService` são usados com as mesmas assinaturas nas tasks 1–8.
