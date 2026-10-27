# LeadHunter dentro do CRM — design

27/10/2026 · Marco **M25** do CRM · Substitui o desenho “Radar Local externo + API” do M24 (`LeadHunter/docs/PLANO_INTEGRACAO.md`, seções 4–6).

## 1. Intenção

Hoje o LeadHunter (Radar Local) é um app Python separado, no PC do operador, que conversa com o CRM por chave de API: envia leads (C1) e atende pedidos feitos no CRM (C2). O objetivo é **trazer todas as funções do LeadHunter para dentro do CRM**, para que a captação aconteça num lugar só, no navegador, sem depender de um computador ligado.

Regras de quem faz o quê:

- **Só admin** do workspace executa busca paga (DataForSEO / Jev).
- **Captadores, sellers e managers** só fazem **pedidos** em `/solicitacoes`; o pedido espera um admin executar.
- O admin que cria um pedido em `/solicitacoes` já executa direto (consome a API na hora).

Por enquanto a função é **só da Estus**. Pode ser vendida a outros assinantes do TitanFlow no futuro, mas como isso será cobrado fica para depois.

## 2. Metas

1. Paridade funcional com o LeadHunter atual (inventário na seção 6), exceto o que a seção 3 exclui.
2. `/solicitacoes` com **os mesmos campos** do formulário “Nova pesquisa” do LeadHunter.
3. Liga/desliga por workspace, ligado só no workspace da Estus.
4. Aposentar o Radar Local depois da validação em produção, trazendo o histórico dele para o CRM.

## 3. Fora do escopo (não-metas)

- **Prévias de site** (`radar/sites.py`, `radar/writers.py`, tabela `sites`, diálogo “Criar site”): o usuário vai escolher outra API de geração de sites depois. Não portar nada.
- **C1/C2 como integração externa**: envio por API, fila consultada pelo Radar, `crm_requests`, `leads.crm` e `CRM_*`. Isso deixa de existir, porque tudo passa a acontecer no mesmo sistema.
- **Venda para outros workspaces**: chave por cliente, crédito ou cobrança. Fica para quando decidirem vender.
- Itens que só existiam por o Radar ser um app local:
  - token `X-Radar-Token`, checagem de Host/Origin (o CRM já tem JWT e CORS);
  - download de backup SQLite (o Postgres do Railway tem backup próprio);
  - link “Plano do projeto” (`/plan`);
  - ferramentas WebMCP (`document.modelContext`).
- Adaptador Apify, executor 24h separado e conversão automática de localidade do DataForSEO (seguem como futuros do LeadHunter).

## 4. Anti-metas (falha mesmo que “funcione”)

- Uma chamada paga **repetida sozinha**: após reinício, erro ou nova tentativa de entrega. Toda chamada paga continua reservada antes e contada mesmo se falhar, como hoje.
- Um não-admin conseguir disparar chamada paga por qualquer rota.
- Um admin de **outro workspace** conseguir ligar a função e gastar as chaves da Estus.
- Dados de um workspace visíveis em outro (falta de `tenant_id` em qualquer consulta).
- Empresas encontradas virarem contatos do CRM sem alguém escolher: só viram contato quando o admin envia ou quando um pedido é entregue.
- Credenciais do DataForSEO/Jev chegarem ao navegador ou a mensagens de erro.

## 5. Decisões do usuário

| Tema | Decisão |
|---|---|
| Onde mora | Dentro do CRM (backend Express + frontend React), merge total das funções |
| Quem executa busca paga | Só `admin`. Manager **não** executa |
| Quem pede | Captador, seller, manager: pedido em `/solicitacoes`, que espera o admin |
| Admin em `/solicitacoes` | Executa direto (consome DataForSEO na hora) |
| Campos de `/solicitacoes` | Idênticos aos do formulário do LeadHunter |
| Quem pode usar | Só a Estus agora, por liga/desliga no workspace |
| Prévias de site | Fora; não portar |

## 6. O que portar (inventário)

Referência de comportamento: o código atual em `LeadHunter/radar/*.py`, `LeadHunter/app.py` e `LeadHunter/web/app.js`. A regra é: **onde este documento não diz nada, o comportamento é o do código Python**, incluindo mensagens em pt-BR.

### 6.1 Campanhas

- **Formulário**, validado por `validate_campaign` (`radar/domain.py`):
  - `niche` (obrigatório, ≤100);
  - `city` (obrigatório, ≤100);
  - `service` (`google | website | marketing`);
  - `limit` (1–50);
  - `keywords` (1–3, ≤180 cada, separadas por linha, vírgula ou `;`; vazio = “nicho cidade”);
  - `coordinates` (até 3 `lat,lon,zoom`, zoom 3–21);
  - `enrich` (Instagram, padrão sim), `use_jev` (padrão sim), `force_refresh` (padrão não);
  - `source` (`demo | live`).
- **Estimativa ao vivo**: “N de M consultas reaproveitadas · até X chamadas pagas · limite Y”, com a fórmula de `estimate_calls`. Campanha `live` com estimativa acima do limite por campanha é recusada na criação.
- **Execução** (`radar/engine.py`):
  - busca Maps por termo × ponto, com `depth = max(30, limit)`;
  - filtro de cidade e `region_review`;
  - deduplicação por identidade;
  - seleção top-N por pontuação após cada consulta (resultado parcial sobrevive a falha posterior);
  - classificação Jev ou regras locais;
  - Instagram por busca orgânica;
  - recálculo com mediana de avaliações dos pares;
  - estados `queued | running | completed | partial | failed | cancelled | interrupted`, com as mesmas regras de transição e mensagens;
  - cancelamento entre chamadas;
  - avisos (`warnings`).
- **Demonstração**: 10 empresas fictícias, sem chamadas, nunca misturadas às reais (grupo de identidade separado), fora de “Empresas já encontradas” e da exportação por padrão.
- **Importação** CSV/JSON (`/api/import`, `parse_csv`): 1–100 empresas, aliases de cabeçalho e regras de linha iguais. Só pontua; nenhuma chamada paga.
- **Exportação CSV**: 22 colunas, `;`, UTF-8 com BOM e proteção contra fórmula, iguais ao LeadHunter; filtros `q`/prioridade/etapa.

### 6.2 Empresas (ficha)

- Pontuação v1 (`score_lead`): pesos, motivos, prioridades `high | medium | low | review | excluded`, visibilidade, completude e cobertura (“presente em X de Y buscas”).
- Etapas: `new | reviewing | contacted | interested | discarded | do_not_contact`. Notas até 5000 caracteres. Etapa e notas valem para todas as campanhas da empresa.
- Instagram: candidatos (até 3), confirmar ou rejeitar manualmente. Confirmação ou rejeição manual nunca é sobrescrita por busca nova.
- Visibilidade observada por busca, “não apareceu nos primeiros N” e histórico entre campanhas.
- Excluir empresa: bloqueado (409) enquanto alguma campanha dela estiver `queued` ou `running`.
- Regras de mescla do `upsert_lead`.
- Telefone guardado como veio do provedor e formatado só na exibição e no CSV.

### 6.3 Histórico de buscas (H1)

- Cache de buscas Maps pagas:
  - chave `sha256("maps|termo|lugar|pt")[:32]`;
  - reaproveita se a profundidade é ≥ à pedida e a busca tem até `SEARCH_CACHE_DAYS` (padrão 30, limite 0–3650);
  - reaproveitamento soma `reuse_count`;
  - só busca bem-sucedida é salva.
- Instagram reaproveitado pelo prazo, ou 1 dia após erro. Jev reaproveitado por empresa + nicho normalizado.
- Tela “Locais pesquisados”, agrupada por local, com os botões “Nova campanha com este local” e “Atualizar agora” (formulário com `force_refresh`).
- Tela “Empresas já encontradas”: deduplicada, busca, mostrar demonstração, exportar selecionadas ou todas (até 5000), coluna de situação no CRM (ver 7.6).

### 6.4 Consumo

- Toda chamada paga (Maps, orgânica do Instagram, Jev) é **reservada antes** numa tabela de chamadas, dentro de transação com trava, e fechada depois como `success | error | unknown`, com custo, tokens e modelo.
- Limites: `MAX_CALLS_PER_CAMPAIGN` (padrão 80) e `MAX_CALLS_PER_DAY` (padrão 200, dia UTC). Contam tentativas, inclusive falhas. Sem repetição automática.
- Consumo por campanha: “Busca|Jev: N chamadas · US$ custo · tokens · N sem sucesso confirmado”.
- Tela de integrações e consumo: DataForSEO e Jev “configurado” ou “aguardando”, limites e modelo Jev. Mostra só booleanos, nunca segredos.

### 6.5 Provedores

- **DataForSEO Maps** (`/v3/serp/google/maps/live/advanced`) e **orgânica** (`/v3/serp/google/organic/live/advanced`):
  - Basic auth, `language_code: "pt"`, `location_name` ou `location_coordinate`;
  - timeout 35 s, resposta até 8 MB, sem retry;
  - parse, limites de campo e `40102 = não encontrado` iguais a `radar/providers.py`.
- **TypeSafe/Jev** (`/v1/systemone`): mesmo payload (texto da empresa marcado como evidência não confiável) e mesma validação de `choice`/`confidence`.

## 7. Como fica no CRM

### 7.1 Liga/desliga

- Coluna nova `tenants.leadhunter_enabled boolean not null default false`.
- **Não editável** por `PATCH /tenant` nem por tela: liga-se por SQL no banco de produção, só no workspace da Estus. Motivo: as chaves são da Estus, e qualquer admin de outro workspace poderia ligá-la para si (anti-meta).
- Exposta em `GET /tenant` (leitura), para o frontend esconder menu e rotas.
- Desligada no workspace:
  - as rotas novas de LeadHunter respondem 404;
  - `/solicitacoes` some do menu e suas rotas respondem 404, porque sem LeadHunter ninguém atende o pedido;
  - os outros workspaces não veem nada.

### 7.2 Backend

- **Módulo novo** `modules/leadhunter/`, seguindo o padrão routes/controller/service/schema. A lógica pura (normalização, validação, pontuação, chave de cache, CSV, estimativa) fica em arquivos sem acesso a banco, para ser testável. Montagem em `/api/v1/leadhunter`, com:
  - `requireAuth`;
  - um middleware que confere `leadhunter_enabled` (404 se desligado);
  - `requireRole('admin')` no router inteiro.
- O captador já é barrado pela lista de rotas permitidas (`requireAuth.ts`); não adicionar o prefixo novo nela.
- **Banco**: migrações a partir de `20240037`. Tabelas equivalentes às do SQLite, todas com `tenant_id` (FK `tenants`, CASCADE):
  - campanhas;
  - empresas;
  - campanha↔empresa (com `analysis`);
  - observações;
  - chamadas pagas;
  - buscas salvas (cache);
  - cobertura de buscas.

  JSON vira `jsonb`. Identidade da empresa única por workspace. Nomes, colunas e índices ficam a critério do builder.
- **Execução em segundo plano**: o backend hoje não tem nenhum job. Criar um worker no próprio processo, iniciado em `server.ts` depois de `migrate.latest()`:
  - roda uma campanha por vez, a mais antiga `queued` primeiro;
  - pega a campanha com `FOR UPDATE SKIP LOCKED`;
  - no boot, faz o mesmo que `recover()`: `running` → `interrupted` (sem retomar) e chamadas `pending` → `unknown`.
  - *ponytail:* supõe uma única instância no Railway (o caso atual). Com réplicas, o recover do boot de uma instância interromperia a campanha de outra; aí seria preciso um dono por instância.
- **Reserva de chamada**: o `BEGIN IMMEDIATE` do SQLite vira transação com `pg_advisory_xact_lock`. **O limite diário é global (todas as chaves são uma só)**, e o limite por campanha é por campanha.
- **Env** (opcionais em `config/env.ts`; sem DataForSEO só `demo` e importação funcionam):
  - `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`;
  - `TYPESAFE_API_KEY`, `TYPESAFE_MODEL` (padrão `jev-1.13.0`);
  - `LEADHUNTER_MAX_CALLS_PER_CAMPAIGN` (80), `LEADHUNTER_MAX_CALLS_PER_DAY` (200), `LEADHUNTER_SEARCH_CACHE_DAYS` (30).
- **HTTP para provedores**: `fetch` nativo do Node 20 com `AbortSignal.timeout(35000)`. Sem dependência nova.

### 7.3 Frontend

- Seção nova no menu **só para admin** com `leadhunter_enabled`: “LeadHunter”, com três telas:
  1. **Campanhas**: lista de campanhas recentes; lista de prospecção da campanha (cartões de totais, filtros, tabela, progresso, cancelar, consumo, avisos); ficha da empresa em painel lateral; novo, importar e exportar.
  2. **Locais pesquisados**, com Empresas já encontradas.
  3. **Integrações e consumo**.
- Visual no **design system do CRM** (componentes `components/ui`, tokens, dark/light, mobile sem rolagem horizontal), não no CSS do Radar. Conteúdo, campos, rótulos e textos seguem o LeadHunter.
- Atualização com `refetchInterval` do TanStack Query enquanto houver campanha `queued`/`running`. O Radar consultava a cada 1,8 s; algo entre 2 e 3 s basta.
- Bloqueio no `AppShell` igual ao de `/captacao` para quem não é admin.

### 7.4 `/solicitacoes` (pedidos)

**Formulário**: os mesmos campos do 6.1, exceto `source` (pedido é sempre coleta real), mais `notes` (observações, ≤1000, que já existe). Validação igual à da campanha. `quantity` = `limit` (1–50, ainda limitado por `tenants.lead_request_max_quantity`).

**Quem pede (captador, seller, manager)**:

- Cria o pedido `queued` (“Aguardando admin”). Nenhuma chamada paga.
- Cotas atuais continuam (máximo por pedido, pedidos por dia, `pg_advisory_xact_lock`).
- Vê só os próprios pedidos e pode cancelar enquanto `queued`. O manager continua vendo os de todos, como hoje.
- Notificado quando o pedido termina ou é recusado.

**Admin**:

- **Pedido próprio**: ao enviar, vê a estimativa e confirma. O pedido nasce já com campanha `live` criada e na fila do worker. Sem cota diária para admin, porque os limites de chamadas já o protegem.
- **Pedidos dos outros**:
  - lista com filtro por usuário;
  - abre o pedido com o formulário preenchido e editável, vê a estimativa e clica em **Executar**, que cria a campanha ligada ao pedido;
  - ou **Recusar**, com motivo: o pedido vira `cancelled` com a mensagem e notifica quem pediu.
- **Ao terminar a campanha de um pedido**, entrega automática, no lugar do antigo `POST /result`:
  - o top-N vira contato via `importContactsBulk` com `source='leadhunter'`, `externalId` = id da empresa, `lead_request_id` e dono = quem pediu (sem dono se não for mais membro ativo);
  - quem pediu é captador → também ganha `lead_assignments`;
  - duplicados ficam com o dono atual e entram na mensagem;
  - o estado da campanha vira estado do pedido pelo mapeamento D10 da C2: `completed→done`, `partial→partial`, `failed→failed`, `cancelled`/`interrupted` → `partial` com empresas ou `failed` sem;
  - notificação `lead_request.finished`;
  - entrega na mesma transação que fecha o pedido, sem chamada paga.
- Empresas em `discarded`/`do_not_contact` nunca viram contato.

**Estados** (CHECK existente): `queued`, `running`, `done`, `partial`, `failed`, `cancelled`. `claimed` e as colunas de reserva (`claimed_at`, `claim_expires_at`) deixam de ser usados. O pedido ganha a referência à campanha (`campaign_id`) e passa a guardar os campos extras do formulário.

**Correção necessária**: o `AppShell` hoje manda o captador para fora de `/solicitacoes` (não está em `CAPTADOR_PATHS`), embora o menu mostre o link. Incluir.

### 7.5 Enviar empresas ao CRM (o antigo C1, agora interno)

Na lista de prospecção: “Criar contatos” (todas ou marcadas) → escolher responsável (membros ativos) → `importContactsBulk`, com o mesmo mapeamento da C1 (`LeadHunter/docs/PLANO_INTEGRACAO.md` §5.1):

- Instagram só quando confirmado;
- `lead_score` = pontuação limitada a 0–100;
- `lead_context` = motivos + notas;
- empresas `discarded`/`do_not_contact` e de demonstração excluídas.

Reenvio não duplica (por `external_id`). A empresa guarda o resultado (contato, data, “criado”, “já existia” ou erro), que aparece na ficha e na coluna “CRM” de Empresas já encontradas. O limite de 300 contatos do plano Free continua valendo, como já faz `importContactsBulk`.

### 7.6 O que sai do CRM, e quando

- **F3**: removidas as rotas públicas do executor de pedidos (`public/lead-requests`: fila, claim, progress, result). A migração da F3 devolve para `queued` qualquer pedido que esteja `claimed`/`running` (na prática não deve haver: a C2 nunca rodou em produção).
- **F4**, no corte: removido `public/leads/bulk` e revogada a chave de API usada pelo Radar. Até lá, o envio manual (C1) do Radar continua funcionando.

`GET /public/users` e as rotas públicas de contatos/deals ficam: não são só do LeadHunter.

## 8. Migração de dados e aposentadoria do Radar Local

**Nunca os dois ligados ao mesmo tempo.** O Radar e o CRM teriam contadores de chamadas separados contra a mesma conta do DataForSEO (o limite diário dobraria), e a mesma empresa poderia ser editada nos dois lados. Por isso:

- F1–F3 vão para produção com `leadhunter_enabled = false` em todos os workspaces. A validação dessas fases é local (Postgres descartável, provedor simulado). O Radar segue sendo a ferramenta em uso, com `CRM_POLL` desligado.
- **Corte (F4), nesta ordem:** parar o Radar Local → rodar o script de migração **uma vez** → ligar a flag na Estus → validar em produção.
- Se algo der errado após o corte, desliga-se a flag e o Radar volta a rodar: o SQLite não é alterado pelo script.

Detalhes da migração:

- Script único, rodado pelo operador, que lê `LeadHunter/data/radar.sqlite3` e grava no Postgres do workspace da Estus:
  - campanhas, empresas (com etapa, notas e Instagram revisado), observações, cobertura, buscas salvas e chamadas pagas (histórico de custo);
  - sem prévias de site nem dados de C1/C2 (o vínculo empresa↔contato da C1 pode ser refeito por `external_id`, que é o id da empresa).

  Só insere: o que já existe no destino é pulado, sem atualizar (o Radar está parado, então não há edição concorrente para mesclar). Rodar duas vezes não duplica.
- Depois da validação em produção, o repo LeadHunter vira arquivo: README apontando para o CRM e sem novas funções. A atualização dos `.md` dos dois repos é a próxima sessão, por pedido do usuário.

## 9. Testes e verificação

- O CRM não tem testes automatizados. **Decisão do builder (minha):** adicionar `vitest` só como dependência de desenvolvimento do backend, para a lógica pura. Portar os casos correspondentes de `LeadHunter/tests/test_radar.py`:
  - `DomainTests`;
  - as partes puras de `SearchHistoryTests`;
  - CSV (import/export/fórmula);
  - estimativa.

  Motivo: é lógica de dinheiro (limites, reaproveitamento) e de regra de negócio que já tem testes prontos para copiar.
- Partes com banco e worker: verificação por `curl` contra Postgres descartável com DataForSEO simulado, como no M24 (reserva antes da chamada, limite diário, reinício sem repetir chamada, cancelamento, entrega de pedido, 404 com flag desligada, 403 para não-admin, isolamento por tenant). Documentar no `plan.md`.
- Portões de sempre: `tsc --noEmit` do backend, `npm run lint` e build do frontend.

## 10. Fases

| Fase | Entrega | Aceite |
|---|---|---|
| **F1 — Backend base** | Flag, tabelas, lógica pura + testes, provedores, worker, rotas de campanha/empresa/buscas/importação/exportação/consumo | Testes portados passam; `curl` cobre demo, live simulada, limites, reinício e isolamento |
| **F2 — Telas do LeadHunter** | Seção LeadHunter no frontend (7.3) e “Criar contatos” (7.5) | Fluxo demo e importação completos no navegador; paridade com as telas do Radar (menos sites e CRM externo) |
| **F3 — `/solicitacoes` novo** | Formulário completo, fluxo admin executa / outros pedem, entrega automática, recusa, correção do `AppShell` | Captador pede → admin executa → leads no perfil do captador com notificação; admin pede e executa direto; seller não consegue disparar chamada |
| **F4 — Corte** | Script de migração do SQLite e corte na ordem da seção 8, validação real em produção (com autorização e créditos DataForSEO), remoção de `public/leads/bulk`, revogação da chave | Uma campanha real no CRM reaproveita uma busca migrada (0 chamadas Maps); Radar Local parado |

F2 e F3 dependem de F1; F3 usa componentes de F2; F4 vem por último.

## 11. Deixado ao builder

- Nomes de tabelas, colunas, índices, arquivos e rotas, respeitando as convenções do `CLAUDE.md` do CRM.
- Divisão interna do módulo e dos componentes React.
- Layout exato das telas dentro do design system do CRM.
- Intervalo de atualização das telas (2–3 s) e do worker.
- Linguagem do script de migração (Node/TS no CRM ou Python ao lado do LeadHunter).

## 12. Escolhas minhas (não decididas pelo usuário)

- Flag só por SQL, sem tela (7.1).
- `/solicitacoes` some nos workspaces com a flag desligada (7.1).
- Visual no design system do CRM, não no do Radar (7.3).
- Limite diário global; admin sem cota diária de pedidos (7.2, 7.4).
- “Recusar pedido” com motivo, usando o estado `cancelled` (7.4).
- Migrar o histórico do SQLite (8).
- `vitest` no backend só para lógica pura (9).
- Remover as rotas do executor de pedidos na F3 e `public/leads/bulk` na F4 (7.6).
- Corte sem convivência: Radar parado antes da migração, script só de inserção, flag ligada depois; volta ao Radar se der errado (8).
