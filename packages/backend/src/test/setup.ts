import { assertTestDatabaseUrl } from './assertTestDatabaseUrl';

// Roda antes de qualquer import do app: o env.ts valida process.env na primeira importação.
// O banco vem só de TEST_DATABASE_URL — e só se for um banco local terminado em `_test`.
if (process.env.TEST_DATABASE_URL) assertTestDatabaseUrl(process.env.TEST_DATABASE_URL);

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://unused@localhost/unused';
process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-at-least-32-chars';
process.env.NODE_ENV = 'test';

// O dotenv do env.ts não sobrescreve chaves já definidas: zerar aqui impede que um .env de dev com
// chaves reais vaze para os testes (e que um teste faça chamada paga ou envie e-mail de verdade).
for (const key of [
  'DATAFORSEO_LOGIN',
  'DATAFORSEO_PASSWORD',
  'TYPESAFE_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
]) {
  process.env[key] = '';
}
