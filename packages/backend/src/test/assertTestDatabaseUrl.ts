/**
 * Trava de segurança dos testes de integração: eles migram e truncam tabelas, então só podem
 * rodar num banco local descartável (nome terminado em `_test`), nunca no de dev ou de produção.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function assertTestDatabaseUrl(raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('TEST_DATABASE_URL invalida: nao e uma URL de conexao');
  }
  const dbName = decodeURIComponent(url.pathname.slice(1));
  if (!dbName.endsWith('_test')) {
    throw new Error('TEST_DATABASE_URL recusada: o nome do banco precisa terminar em "_test"');
  }
  // O pg-connection-string (usado pelo knex) deixa `?host=`, `?hostaddr=`, `?dbname=` etc. sobrescreverem
  // o destino da URL: só `sslmode` é aceito na query.
  for (const key of url.searchParams.keys()) {
    if (key !== 'sslmode') {
      throw new Error(`TEST_DATABASE_URL recusada: parametro de query "${key}" nao permitido (so sslmode)`);
    }
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error('TEST_DATABASE_URL recusada: o host precisa ser localhost, 127.0.0.1 ou ::1');
  }
}
