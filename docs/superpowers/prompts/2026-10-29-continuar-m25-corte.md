# Continuar o M25 (corte do LeadHunter) — handoff de 29/10/2026

Leia antes: `CLAUDE.md` (seções "Banco de dados", "Migrations" e "Next"), `plan.md` (M25, M27) e este arquivo.

## Estado

- **No ar (main `2485c57`):** LeadHunter dentro do CRM, T1–T14 do M25 — motor, worker, API `/api/v1/leadhunter`, telas (campanhas, ficha, locais, empresas já encontradas, integrações), pedidos de leads executados no CRM (`/api/v1/lead-requests`, só admin, entrega automática em `modules/leadhunter/delivery.ts`), scripts de histórico. Painel "Dados de prospecção" na tela do contato (M27).
- **Produção:** migrations até `20240042` aplicadas (a `20240042` real, do M26 T9, já substituiu o marcador). `DATAFORSEO_LOGIN/PASSWORD` no Railway. `tenants.leadhunter_enabled = true` **só** em `estus-corporation` (UUID `b2b6c5e9-f4f8-4545-9416-ca63c54feaea`), ligado por SQL no painel do Railway. **Sem** `TYPESAFE_API_KEY` (classificação por regras locais, com aviso de revisão).
- **Radar Local (repo `LeadHunter`, Python):** foi fechado; as rotas `/public/lead-requests` foram removidas do CRM, então ele não atende mais pedidos. Os commits dele (Instagram candidato, consulta de reserva, `export_for_crm.py`) já estão no GitHub.

## O que falta (por ordem)

1. **Teste de ponta a ponta em produção (primeiro).** Executar o pedido "hamburgueria" (ou um novo de 2–3 empresas) em Captação > Adicionar lead > Automático. Conferir: campanha criada em LeadHunter > Campanhas, leads entregues em Distribuir leads, contato com Maps, nota, Instagram candidato ("não confirmado") e score; notificação `lead_request.finished`. Gasta chamadas pagas do DataForSEO (~2 por empresa).
2. **Rodar os testes de integração com banco (nunca rodaram).** Precisa de `TEST_DATABASE_URL` apontando para o PostgreSQL local, banco `titancrm_test` (guarda em `src/test/assertTestDatabaseUrl.ts`: só localhost, nome `*_test`). Pedir a senha do `postgres` ao usuário e passar **inline no comando**, nunca em arquivo. Suítes: `store.int`, `engine.int`, `leadhunter.int`, `lead-requests.int`, `import-script.int`, `contactView.int`. Corrigir o que falhar.
3. **T15 — corte (cada passo com autorização do usuário):**
   - Exportar o histórico: `python scripts/export_for_crm.py data/radar.sqlite3 saida.json` (repo LeadHunter; só leitura, mas deixa `-shm`/`-wal` vazios ao lado do SQLite — apagar).
   - Importar: `ALLOW_REMOTE_DB=1 DATABASE_URL=<produção> npx tsx packages/backend/scripts/import-leadhunter.ts --tenant b2b6c5e9-f4f8-4545-9416-ca63c54feaea --file saida.json --confirm` (confira o `Destino:` impresso antes; só insere, uma transação). Depois conferir contagens e que "Empresas já encontradas" mostra o histórico.
   - Remover `POST /public/leads/bulk` e `leadsBulkSchema` de `modules/public/public.routes.ts` (e `leadHunterLeadSchema` se sem uso); atualizar o `plan.md`.
4. **Opcional:** `TYPESAFE_API_KEY` (console.typesafe.ai/keys) para classificação do nicho por IA (Jev).

## Pendências conhecidas (revisão de 29/10)

- Nada de T8–T13 foi visto no navegador (desktop 1366 px e celular 390 px): campanhas, importar/exportar CSV, ficha, formulário de pedidos, Executar/Recusar.
- Lacunas de teste: entrega concorrente (`deliverForCampaign` em paralelo), entrega com campanha de outro workspace, corrida "campanha termina antes de o pedido ser gravado" (mitigada pela varredura de 60 s).
- Um pedido `running` não pode ser cancelado pela UI (só `queued`); se o worker não rodar a campanha, o pedido fica `running` e a lista faz polling de 30 s para sempre.
- `recover()` no boot supõe **uma instância** no Railway: em deploy com sobreposição pode marcar campanha em andamento como `interrupted`. Pare a instância antiga antes de subir.
- Campanha com 0 empresas termina como `done` com 0 entregues (considerar `partial`/`failed`); polling de campanha sem teto (2,5 s) enquanto `queued`/`running`.
- `useCampaign` não invalida `lead-requests` nem contatos quando a campanha termina (só pelo polling).
- Código morto no módulo de pedidos (ramos de não-admin em `lead-requests.service`), porque a rota é só admin.
- `CampaignFields` usa um cast (`asCampaignForm`) por causa do campo `notes`; o certo é torná-lo genérico.
- Badge "Pedido de <nome>" na campanha: falta `requesterName` no backend (hoje mostra "Pedido de leads").
- "Contexto" do contato pode conter observações internas do admin (`lead_context`); só aparece sem ficha do LeadHunter, mas a API de contato devolve o campo.
- Instagram: a busca agora tem consulta de reserva e perfil por post, mas negócios sem Instagram indexado continuam "não localizados". Contatos já enviados antes da correção ficam sem Instagram (reenvio é ignorado como duplicado): editar à mão no CRM ou, com autorização, atualizar em lote no banco.
- Seed local: o `.env` do backend aponta para produção; a trava `assertLocalDatabase` recusa isso fora de `production`/`test`. Para rodar local, apontar para `titancrm` em `localhost` (serviço `postgresql-x64-18`).

## Cuidados (aprendidos)

- **Railway:** o deploy automático às vezes não dispara; usar Ctrl+K > "Deploy Latest Commit" e conferir o hash do commit na aba Deployments. O Railway CLI daqui estava sem login.
- Banco de produção: consultas e SQL só pelo painel do Railway (aba Data do serviço Postgres); `ALTER`/`UPDATE` apenas com autorização explícita.
- Nunca commitar/migrar sem o arquivo de migration junto (incidente de 29/10, ver `CLAUDE.md`).
- Windows: no PowerShell usar `curl.exe` (e `NUL`), não `curl`.

## Prompt para a próxima sessão

> Abra o CRM (`--add-dir ../LeadHunter`). Leia `CLAUDE.md`, `plan.md` e `docs/superpowers/prompts/2026-10-29-continuar-m25-corte.md`. Siga a lista "O que falta" na ordem, sem refazer o que já está no ar. Peça autorização antes de qualquer SQL ou comando contra o banco de produção, de enviar chamadas pagas ao DataForSEO e de publicar.
