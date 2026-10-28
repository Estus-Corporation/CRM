import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { db } from '../db';
import { hasTestDb, makeTenant, makeUser, migrateTestDb, resetLeadHunter } from './db';
import { requireLeadHunter } from '../shared/middleware/requireLeadHunter';
import { getTenant, updateTenantSchema } from '../modules/tenants/tenants.service';

function fakeRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe.skipIf(!hasTestDb)('base do LeadHunter', () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('migração cria a flag desligada por padrão', async () => {
    const tenantId = await makeTenant();
    const row = await db('tenants').where({ id: tenantId }).first('leadhunter_enabled');
    expect(row.leadhunter_enabled).toBe(false);
  });

  it('requireLeadHunter responde 404 com a flag desligada e chama next com ela ligada', async () => {
    const off = await makeTenant();
    const on = await makeTenant({ leadhunterEnabled: true });
    const offUser = await makeUser(off, 'admin');
    const onUser = await makeUser(on, 'admin');

    const resOff = fakeRes();
    const nextOff = vi.fn();
    await requireLeadHunter(
      { user: { id: offUser, tenantId: off, role: 'admin' } } as unknown as Request,
      resOff as unknown as Response,
      nextOff,
    );
    expect(resOff.status).toHaveBeenCalledWith(404);
    expect(resOff.json).toHaveBeenCalledWith({ error: 'Not found' });
    expect(nextOff).not.toHaveBeenCalled();

    const resOn = fakeRes();
    const nextOn = vi.fn();
    await requireLeadHunter(
      { user: { id: onUser, tenantId: on, role: 'admin' } } as unknown as Request,
      resOn as unknown as Response,
      nextOn,
    );
    expect(nextOn).toHaveBeenCalledTimes(1);
    expect(resOn.status).not.toHaveBeenCalled();
  });

  it('migração cria as 7 tabelas lh_* e a CHECK de estado da campanha recusa valor inválido', async () => {
    const tables = [
      'lh_campaigns',
      'lh_companies',
      'lh_campaign_companies',
      'lh_observations',
      'lh_api_calls',
      'lh_searches',
      'lh_search_coverage',
    ];
    for (const table of tables) {
      const { rows } = await db.raw('select to_regclass(?) as reg', [`public.${table}`]);
      expect(rows[0].reg, table).not.toBeNull();
    }

    const tenantId = await makeTenant();
    await expect(
      db('lh_campaigns').insert({ tenant_id: tenantId, config: {}, state: 'invalido' }),
    ).rejects.toThrow(/lh_campaigns_state_valid/);
    await expect(
      db('lh_campaigns').insert({ tenant_id: tenantId, config: {}, state: 'queued' }),
    ).resolves.toBeDefined();
  });

  it('requireLeadHunter: sem usuário responde 401', async () => {
    const res = fakeRes();
    const next = vi.fn();
    await requireLeadHunter({} as unknown as Request, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireLeadHunter: workspace inexistente responde 404', async () => {
    const res = fakeRes();
    const next = vi.fn();
    await requireLeadHunter(
      { user: { id: randomUUID(), tenantId: randomUUID(), role: 'admin' } } as unknown as Request,
      res as unknown as Response,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireLeadHunter: erro do banco vai para next(err), sem responder', async () => {
    const res = fakeRes();
    const next = vi.fn();
    await requireLeadHunter(
      { user: { id: randomUUID(), tenantId: 'not-a-uuid', role: 'admin' } } as unknown as Request,
      res as unknown as Response,
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('GET /tenant expõe leadhunter_enabled', async () => {
    const tenantId = await makeTenant({ leadhunterEnabled: true });
    const tenant = await getTenant(tenantId);
    expect(tenant).toHaveProperty('leadhunter_enabled', true);
  });

  it('updateTenantSchema ignora leadhunter_enabled', () => {
    const parsed = updateTenantSchema.parse({ leadhunterEnabled: true, leadhunter_enabled: true });
    expect(parsed).not.toHaveProperty('leadhunterEnabled');
    expect(parsed).not.toHaveProperty('leadhunter_enabled');
  });

  it('resetLeadHunter roda no banco de teste (confere o nome antes de truncar)', async () => {
    await expect(resetLeadHunter()).resolves.toBeUndefined();
  });
});
