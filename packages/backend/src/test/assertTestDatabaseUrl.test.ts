import { describe, expect, it } from 'vitest';
import { assertTestDatabaseUrl } from './assertTestDatabaseUrl';

describe('assertTestDatabaseUrl', () => {
  it.each([
    'postgresql://postgres:x@localhost:5432/titancrm_test',
    'postgres://u@127.0.0.1/crm_test',
    'postgres://u:p@[::1]:5432/crm_test?sslmode=disable',
  ])('aceita banco de teste local: %s', (url) => {
    expect(() => assertTestDatabaseUrl(url)).not.toThrow();
  });

  it.each([
    ['banco de dev', 'postgresql://postgres:x@localhost:5432/titancrm'],
    ['host do Railway', 'postgresql://postgres:x@roundhouse.proxy.rlwy.net:5432/railway'],
    ['host remoto mesmo com _test', 'postgresql://postgres:x@db.exemplo.com:5432/crm_test'],
    ['sem nome de banco', 'postgresql://postgres:x@localhost:5432'],
    ['nome de banco vazio', 'postgresql://postgres:x@localhost:5432/'],
    ['não é URL', 'isto-nao-e-url'],
    ['?host= sobrescrevendo o destino', 'postgresql://u:p@localhost:5432/x_test?host=remote.example.com'],
    ['?hostaddr= sobrescrevendo o destino', 'postgresql://u:p@localhost:5432/x_test?hostaddr=203.0.113.9'],
    ['?dbname= sobrescrevendo o banco', 'postgresql://u:p@localhost:5432/x_test?dbname=titancrm'],
    ['?port= sobrescrevendo a porta', 'postgresql://u:p@localhost:5432/x_test?port=6543'],
  ])('recusa %s', (_label, url) => {
    expect(() => assertTestDatabaseUrl(url)).toThrow();
  });
});
