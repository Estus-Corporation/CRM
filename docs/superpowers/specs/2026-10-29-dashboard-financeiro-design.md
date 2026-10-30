# Dashboard financeiro (lucro líquido, contas a pagar, divisão entre sócios) — Design

Data: 2026-10-29 · Status: aguardando revisão · Milestone sugerido: M30

## Objetivo

No Dashboard, um botão **Financeiro** (extrema direita do cabeçalho, ao lado dos filtros de período, que se deslocam para a esquerda) troca o conteúdo por um painel com o resultado real da empresa no mês: receita, impostos, gastos, pró-labore e **lucro líquido**, mais as contas a pagar e a divisão do lucro entre sócios.

**Acesso: só `admin`** (decisão do usuário). Botão escondido para os demais papéis e **todas** as rotas `/api/v1/finance/*` recusam quem não é admin (403). Gerente, vendedor e captador não veem nada.

## Decisões já tomadas

| Tema | Decisão |
|---|---|
| Receita | Soma de `deals.value` com `status='won'` e `closed_at` no mês (mesma fonte dos KPIs do Dashboard) |
| Impostos | Alíquotas em % cadastradas pelo admin, aplicadas sobre a receita do mês |
| Gastos | Recorrentes (mensais, com início/fim) + avulsos (data própria); cada ocorrência mensal tem status pago/pendente |
| Sócios | Cadastro com % de participação (soma = 100) e pró-labore mensal; pró-labore é custo, o restante do lucro é dividido pelos % |
| Regime | **Competência**: todas as contas do mês entram no lucro, pagas ou não. "A pagar" é só o saldo pendente |
| Tela | Troca de conteúdo dentro do Dashboard (estado local, não é rota nova), com transição animada |

## Modelo de dados (migration `20240048_create_finance_tables`)

Antes de criar: `git fetch` e conferir o maior número em `origin/main` (hoje `20240047`). Rodar só em `titancrm`/`titancrm_test`; commitar a migration junto com o código que a usa (incidente de 29/10/2026 no CLAUDE.md). `up` e `down` obrigatórios.

Todas as tabelas têm `tenant_id uuid NOT NULL` (FK `tenants`, `ON DELETE CASCADE`), `id uuid default gen_random_uuid()`, `created_at`/`updated_at timestamptz`.

- **`finance_expenses`**
  - `description text NOT NULL`, `category text NOT NULL default 'other'` (texto livre curto, sugestões no front)
  - `amount numeric(14,2) NOT NULL CHECK (amount >= 0)`
  - `kind text NOT NULL CHECK (kind IN ('recurring','one_off'))`
  - recorrente: `due_day smallint CHECK (1..31)`, `starts_on date NOT NULL`, `ends_on date NULL`
  - avulso: `due_date date NOT NULL`
  - `CHECK` garante que os campos de cada `kind` estão preenchidos e os do outro nulos
  - índice `(tenant_id, kind)`
- **`finance_payments`**: `expense_id` (FK, cascade), `month date NOT NULL` (sempre dia 1), `paid_at timestamptz NOT NULL`. `UNIQUE (expense_id, month)`. Existir linha = paga; desmarcar = apagar a linha.
- **`finance_taxes`**: `name text NOT NULL`, `rate numeric(5,2) NOT NULL CHECK (rate >= 0 AND rate <= 100)`, `kind text NOT NULL default 'percent_revenue'` (único valor aceito hoje, ver Evolução), `is_active boolean default true`.
- **`finance_partners`**: `name text NOT NULL`, `share_percent numeric(5,2) NOT NULL CHECK (0..100)`, `pro_labore numeric(14,2) NOT NULL default 0 CHECK (>= 0)`.

Dias 29–31 em recorrentes: o vencimento do mês é `min(due_day, último dia do mês)`.

## Cálculo (função pura `finance.calc.ts`, sem acesso a banco)

Entrada: `month`, receita do mês, despesas, pagamentos do mês, impostos ativos, sócios. Saída: o **resumo** abaixo. Dinheiro em centavos inteiros dentro da função, convertido na borda.

Uma despesa tem ocorrência no mês `M` se: recorrente com `starts_on <= fim de M` e (`ends_on` nulo ou `>= início de M`); avulsa com `due_date` dentro de `M`.

```
impostos[i]   = round(receita × rate_i / 100)
gastos        = Σ ocorrências do mês
proLabore     = Σ sócios.pro_labore
lucroLiquido  = receita − Σ impostos − gastos − proLabore
distribuição  = lucroLiquido > 0 ? lucroLiquido × share% por sócio : 0
```

- Sobra de arredondamento da divisão vai para o sócio de maior %, para a soma fechar.
- `aPagar` = Σ ocorrências sem pagamento no mês; cada conta recebe status `paid` | `pending` | `overdue` (vencimento < hoje e não paga).
- O resumo é uma **lista de linhas tipadas** (`lines: [{ key, label, kind: 'revenue'|'tax'|'expense'|'payroll', amount }]`), não campos fixos, para novas fontes entrarem sem quebrar o contrato (ver Evolução).

## API — `/api/v1/finance` (`requireAuth` → `requireRole('admin')`, tudo com `tenantId` como 1º argumento)

| Rota | Função |
|---|---|
| `GET /summary?month=YYYY-MM` | Resumo calculado: KPIs, `lines`, contas do mês (com status), distribuição, avisos (`partnersShareInvalid`, `noConfig`) |
| `GET/POST /expenses`, `PATCH/DELETE /expenses/:id` | CRUD de gastos |
| `PUT /expenses/:id/payments/:month` body `{ paid: boolean }` | Marca/desmarca ocorrência |
| `GET/PUT /taxes` | Lista; PUT substitui a lista inteira numa transação |
| `GET/PUT /partners` | Idem; PUT valida soma dos % = 100 quando não vazio, senão 422 `invalid_shares` |

Validação com Zod (422), resposta `{ data }`. `month` inválido → 422. Despesa de outro tenant → 404. Sem tier mínimo.

Arquivos: `modules/finance/{finance.routes,finance.controller,finance.service,finance.calc,finance.schemas}.ts`; montado em `server.ts` como `/api/v1/finance`.

## Frontend

- `DashboardPage`: estado `view: 'overview' | 'finance'` guardado com `useStickyState` (`dashboard.view`) para não resetar ao trocar de tela. O botão só existe se `user.role === 'admin'`; se um não-admin tiver o estado guardado, cai em `overview`.
- Cabeçalho: `SegmentedControl` de período ganha margem e o botão **Financeiro** (ícone `Landmark`; volta como **Visão geral**) fica na extrema direita. No modo financeiro o seletor de dias dá lugar ao navegador de mês `‹ Out/2026 ›` (não avança além do mês atual).
- Transição: `AnimatePresence mode="wait"` com os helpers de `lib/motion.ts` (`pageMotion`), lembrando que `transitionEnd` remove `filter` para não quebrar `backdrop-filter`.
- Componentes novos em `components/finance/`: `FinanceView`, `ProfitFlowCard` ("Para onde vai a receita": barras proporcionais por linha), `PayablesCard` (contas do mês, check para pagar, selo de status), `PartnersSplitCard`, `FinanceSettingsModal` (abas Gastos / Impostos / Sócios, formulários com React Hook Form + Zod). KPIs reaproveitam `KpiCard` (sem sparkline), cards reaproveitam `CardHeader`/`.card`. Dinheiro em `Intl.NumberFormat('pt-BR', BRL)` completo (não compacto) no financeiro.
- `hooks/useFinance.ts` (TanStack Query; `keepPreviousData` no resumo; mutações invalidam `['finance']`).
- Estados: carregando (`Spinner`), vazio guiado (sem gastos/impostos/sócios → CTA "Configurar"), aviso âmbar se % dos sócios ≠ 100, prejuízo no mês exibido em vermelho com divisão zerada ("Sem lucro a distribuir").
- Mobile: segue `.mobile-sections` (cada card embrulhado em `div`), sem rolagem lateral; navegação de mês e botão cabem na linha de filtros.

## Testes

- **Unitários** (`vitest`, sem banco) para `finance.calc.ts`: recorrente com `ends_on`, recorrente começando no meio do mês, dia 31 em fevereiro, avulso dentro/fora do mês, prejuízo, receita zero, arredondamento da divisão, status `overdue`.
- **Integração** (exigem `TEST_DATABASE_URL`, como o resto do M25): 403 para manager/seller/captador em todas as rotas, isolamento entre tenants, `PUT /partners` com soma ≠ 100 → 422, marcar/desmarcar pagamento.
- Build do frontend (`npm run build --workspace=packages/frontend`) e `npx tsc --noEmit -p packages/backend` sem erros.

## Limitações conhecidas da v1

1. **A configuração vale "para o presente"**: editar valor de gasto recorrente, alíquota, % ou pró-labore recalcula também meses passados. Mitigação futura abaixo (fechamento de mês). Na tela, o modal de configuração avisa isso.
2. Comissões dos captadores (já existem em "Minhas comissões") **não** entram automaticamente como custo; por ora o admin lança como gasto.
3. Filtros Hoje/7 dias/30 dias continuam só visuais no modo geral.

## Evolução prevista (não entra agora, mas o desenho já acomoda)

Ordenadas pelo que mais vale e menos custa:

1. **Fechamento de mês** (`finance_closings`: snapshot JSON do resumo, `closed_at`, `closed_by`): congela os números do mês e resolve a limitação 1. `GET /summary` devolve o snapshot se existir.
2. **Comissões automáticas**: nova linha `kind: 'payroll'`/`'expense'` em `lines`, lida de `lead_assignments` fechados no mês. Só adiciona uma fonte no serviço; a tela e o contrato não mudam.
3. **Tendência de 6 meses** (lucro/receita/gastos): `finance.calc` já é pura, basta chamá-la por mês em um `GET /trend`; gráfico no padrão do `RevenueChart`.
4. **Lembretes de vencimento**: job que cria notificação `finance.due` (infra de `notifications` + SSE já existe; mapear o `type` em `lib/notificationLink.ts`).
5. **Outros tipos de imposto**: `finance_taxes.kind` ganha `fixed_monthly`, ou faixas progressivas do Simples (alíquota por faturamento dos últimos 12 meses). Nada muda no resto, pois o cálculo de imposto é uma função por `kind`.
6. **Outras receitas** (fora do CRM) e **reserva de lucro** (% retido antes da distribuição): mais linhas em `lines` e um passo antes de `distribuição`.
7. **Repasse efetivado por sócio** (marcar que o sócio já recebeu), generalizando `finance_payments` com `partner_id`.
8. **Exportação CSV** do mês (padrão do export de atividades: `;` e cabeçalho sem acento).
9. **Orçamento por categoria** (meta vs. realizado) e **comprovantes anexados** nas contas.
10. **Salários de funcionários** (vínculo `user_id` opcional em `finance_expenses` com categoria "folha"), e abrir leitura (não edição) ao gerente via parâmetro do `requireRole`, se um dia for desejado.
11. **Gating por plano** (`requireTier`) se o financeiro virar recurso pago.
