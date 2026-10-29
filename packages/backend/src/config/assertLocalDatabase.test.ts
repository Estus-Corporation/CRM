import { describe, expect, it } from 'vitest';
import { assertLocalDatabase } from './assertLocalDatabase';

const REMOTE = 'postgresql://u:p@roundhouse.proxy.rlwy.net:5432/railway';
const LOCAL = 'postgresql://postgres:x@localhost:5432/titancrm';

describe('assertLocalDatabase', () => {
  it('recusa banco remoto em desenvolvimento e quando NODE_ENV não está definido', () => {
    expect(() => assertLocalDatabase(REMOTE, 'development', undefined)).toThrow(/banco remoto/);
    expect(() => assertLocalDatabase(REMOTE, undefined, undefined)).toThrow(/roundhouse/);
  });

  it('aceita banco local (localhost, 127.0.0.1, ::1)', () => {
    for (const url of [LOCAL, 'postgresql://a:b@127.0.0.1:5432/x', 'postgresql://a:b@[::1]:5432/x']) {
      expect(() => assertLocalDatabase(url, 'development', undefined)).not.toThrow();
    }
  });

  it('em produção e teste não interfere; ALLOW_REMOTE_DB=1 libera de propósito', () => {
    expect(() => assertLocalDatabase(REMOTE, 'production', undefined)).not.toThrow();
    expect(() => assertLocalDatabase(REMOTE, 'test', undefined)).not.toThrow();
    expect(() => assertLocalDatabase(REMOTE, 'development', '1')).not.toThrow();
  });

  it('um host que apenas contém "localhost" no nome continua sendo remoto', () => {
    expect(() => assertLocalDatabase('postgresql://a:b@localhost.evil.test/x', 'development', undefined)).toThrow();
  });
});
