import type { Knex } from 'knex';

/**
 * Marcador: esta migration já foi aplicada no banco de produção (rodando o backend local, cujo `.env`
 * aponta para lá), mas o arquivo original nunca foi commitado e o Knex se recusa a subir quando o banco
 * registra uma migration que o código não tem. Este arquivo de mesmo nome só devolve o registro ao
 * diretório; não altera o schema. Quando o arquivo original for commitado, ele substitui este.
 */
export async function up(_knex: Knex): Promise<void> {
  // sem alterações: a coluna já existe onde a migration foi aplicada
}

export async function down(_knex: Knex): Promise<void> {
  // sem alterações
}
