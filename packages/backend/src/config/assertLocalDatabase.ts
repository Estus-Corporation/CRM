const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Fora de produção e de teste, recusa um DATABASE_URL que não seja da própria máquina: o `.env` local já
 * apontou para o banco de produção e `npm run dev` aplicou uma migration lá sem o arquivo ser commitado,
 * o que derrubou o Railway. Quem precisa mesmo de um banco remoto (ex.: script de importação do M25)
 * define ALLOW_REMOTE_DB=1 no comando, sabendo o que faz.
 */
export function assertLocalDatabase(
  databaseUrl: string | undefined,
  nodeEnv: string | undefined,
  allowRemote: string | undefined,
): void {
  if (!databaseUrl || nodeEnv === 'production' || nodeEnv === 'test' || allowRemote === '1') return;
  let host: string;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    return;
  }
  if (LOCAL_HOSTS.has(host)) return;
  throw new Error(
    `DATABASE_URL aponta para um banco remoto (${host}) fora de produção. Use o banco local (localhost) no .env; ` +
      'para um banco remoto de propósito, rode com ALLOW_REMOTE_DB=1. Veja "Migrations" no CLAUDE.md.',
  );
}
