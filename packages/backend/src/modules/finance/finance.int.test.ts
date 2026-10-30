import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../../db';
import { errorHandler } from '../../shared/middleware/errorHandler';
import { hasTestDb, makeTenant, makeUser, migrateTestDb } from '../../test/db';
import financeRoutes from './finance.routes';

// Financeiro (M30): só admin, isolado por tenant. A API roda de ponta a ponta (guardas, Zod, errorHandler)
// num Express em porta efêmera, contra o banco de teste.

interface Actor {
  id: string;
  tenantId: string;
  role: 'admin' | 'manager' | 'seller' | 'captador';
}

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const sign = (actor: Actor) =>
  new SignJWT({ tenantId: actor.tenantId, role: actor.role, email: 'x@teste.local' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(actor.id)
    .setExpirationTime('5m')
    .sign(secret);

const RECURRING = { description: 'Aluguel', category: 'Aluguel', amount: 1500.5, kind: 'recurring', dueDay: 5, startsOn: '2026-01-01' };
const ONE_OFF = { description: 'Notebook', category: 'Equipamento', amount: 500, kind: 'one_off', dueDate: '2026-10-20' };

describe.skipIf(!hasTestDb)('financeiro (M30)', () => {
  let server: Server;
  let url: string;

  const actorFor = async (tenantId: string, role: Actor['role']): Promise<Actor> => ({ id: await makeUser(tenantId, role), tenantId, role });
  const newAdmin = async () => actorFor(await makeTenant(), 'admin');

  async function api(actor: Actor | null, method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = {};
    if (actor) headers.Authorization = `Bearer ${await sign(actor)}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${url}/api/v1/finance${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  beforeAll(async () => {
    await migrateTestDb();
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/v1/finance', financeRoutes);
    app.use(errorHandler);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('acesso', () => {
    it.each(['manager', 'seller', 'captador'] as const)('%s recebe 403 em todas as leituras', async (role) => {
      const actor = await actorFor(await makeTenant(), role);
      for (const path of ['/expenses', '/taxes', '/partners']) {
        expect((await api(actor, 'GET', path)).status).toBe(403);
      }
    });

    it('sem token recebe 401', async () => {
      expect((await api(null, 'GET', '/expenses')).status).toBe(401);
    });
  });

  describe('gastos', () => {
    it('admin cria recorrente e avulso, lista, edita e apaga', async () => {
      const admin = await newAdmin();
      const rec = await api(admin, 'POST', '/expenses', RECURRING);
      expect(rec.status).toBe(201);
      expect(rec.body.data).toMatchObject({ amount: 1500.5, kind: 'recurring', dueDay: 5, startsOn: '2026-01-01', endsOn: null, dueDate: null });
      const one = await api(admin, 'POST', '/expenses', ONE_OFF);
      expect(one.status).toBe(201);
      expect(one.body.data).toMatchObject({ kind: 'one_off', dueDate: '2026-10-20', dueDay: null, startsOn: null });

      expect((await api(admin, 'GET', '/expenses')).body.data).toHaveLength(2);

      const patched = await api(admin, 'PATCH', `/expenses/${rec.body.data.id}`, { amount: 1800 });
      expect(patched.status).toBe(200);
      expect(patched.body.data.amount).toBe(1800);

      expect((await api(admin, 'DELETE', `/expenses/${one.body.data.id}`)).status).toBe(204);
      expect((await api(admin, 'GET', '/expenses')).body.data).toHaveLength(1);
    });

    it('recusa recorrente sem dia de vencimento e avulso sem data (422)', async () => {
      const admin = await newAdmin();
      const { dueDay: _dueDay, ...semDia } = RECURRING;
      const { dueDate: _dueDate, ...semData } = ONE_OFF;
      expect((await api(admin, 'POST', '/expenses', semDia)).status).toBe(422);
      expect((await api(admin, 'POST', '/expenses', semData)).status).toBe(422);
      expect((await api(admin, 'POST', '/expenses', { ...RECURRING, amount: -1 })).status).toBe(422);
    });

    it('despesa de outro tenant dá 404 (editar, apagar e marcar paga) e não aparece na lista', async () => {
      const a = await newAdmin();
      const b = await newAdmin();
      const { body } = await api(a, 'POST', '/expenses', RECURRING);
      const id = body.data.id as string;

      expect((await api(b, 'PATCH', `/expenses/${id}`, { amount: 1 })).status).toBe(404);
      expect((await api(b, 'DELETE', `/expenses/${id}`)).status).toBe(404);
      expect((await api(b, 'PUT', `/expenses/${id}/payments/2026-10`, { paid: true })).status).toBe(404);
      expect((await api(b, 'GET', '/expenses')).body.data).toHaveLength(0);
      expect(await db('finance_payments').where({ expense_id: id }).count('* as n').first()).toMatchObject({ n: '0' });
    });
  });

  describe('pagamentos', () => {
    it('marcar paga duas vezes deixa uma linha; desmarcar sem pagamento não dá erro', async () => {
      const admin = await newAdmin();
      const id = (await api(admin, 'POST', '/expenses', RECURRING)).body.data.id as string;
      const count = async () => Number((await db('finance_payments').where({ expense_id: id }).count('* as n').first())!.n);

      expect((await api(admin, 'PUT', `/expenses/${id}/payments/2026-10`, { paid: true })).body.data).toEqual({ paid: true });
      expect((await api(admin, 'PUT', `/expenses/${id}/payments/2026-10`, { paid: true })).status).toBe(200);
      expect(await count()).toBe(1);

      expect((await api(admin, 'PUT', `/expenses/${id}/payments/2026-10`, { paid: false })).body.data).toEqual({ paid: false });
      expect(await count()).toBe(0);
      const again = await api(admin, 'PUT', `/expenses/${id}/payments/2026-10`, { paid: false });
      expect(again.status).toBe(200);
      expect(again.body.data).toEqual({ paid: false });
    });

    it('mês inválido dá 422', async () => {
      const admin = await newAdmin();
      const id = (await api(admin, 'POST', '/expenses', RECURRING)).body.data.id as string;
      expect((await api(admin, 'PUT', `/expenses/${id}/payments/2026-13`, { paid: true })).status).toBe(422);
    });
  });

  describe('impostos', () => {
    it('PUT substitui a lista inteira', async () => {
      const admin = await newAdmin();
      const first = await api(admin, 'PUT', '/taxes', { taxes: [{ name: 'Simples', rate: 6 }, { name: 'ISS', rate: 2, isActive: false }] });
      expect(first.status).toBe(200);
      expect(first.body.data).toHaveLength(2);
      expect(first.body.data.find((t: { name: string }) => t.name === 'ISS').isActive).toBe(false);

      await api(admin, 'PUT', '/taxes', { taxes: [{ name: 'Novo', rate: 1.5 }] });
      const list = (await api(admin, 'GET', '/taxes')).body.data;
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ name: 'Novo', rate: 1.5, isActive: true });
    });

    it('alíquota acima de 100 dá 422', async () => {
      const admin = await newAdmin();
      expect((await api(admin, 'PUT', '/taxes', { taxes: [{ name: 'X', rate: 101 }] })).status).toBe(422);
    });
  });

  describe('sócios', () => {
    it('percentuais que não somam 100 dão 422 invalid_shares', async () => {
      const admin = await newAdmin();
      const res = await api(admin, 'PUT', '/partners', {
        partners: [{ name: 'A', sharePercent: 60, proLabore: 0 }, { name: 'B', sharePercent: 30, proLabore: 0 }],
      });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('invalid_shares');
    });

    it('60 + 40 passa, e lista vazia também', async () => {
      const admin = await newAdmin();
      const ok = await api(admin, 'PUT', '/partners', {
        partners: [{ name: 'A', sharePercent: 60, proLabore: 3000 }, { name: 'B', sharePercent: 40, proLabore: 1500.75 }],
      });
      expect(ok.status).toBe(200);
      expect(ok.body.data.map((p: { proLabore: number }) => p.proLabore).sort()).toEqual([1500.75, 3000]);

      const empty = await api(admin, 'PUT', '/partners', { partners: [] });
      expect(empty.status).toBe(200);
      expect(empty.body.data).toEqual([]);
    });
  });

  describe('resumo do mês', () => {
    /** Negócio direto no banco (pipeline e etapa mínimos do tenant) */
    async function makeDeal(tenantId: string, value: number, status: 'won' | 'open', closedAt: string | null) {
      const [pipeline] = await db('pipelines').insert({ tenant_id: tenantId, name: 'P' }).returning('id');
      const [stage] = await db('pipeline_stages').insert({ tenant_id: tenantId, pipeline_id: pipeline.id, name: 'S' }).returning('id');
      await db('deals').insert({ tenant_id: tenantId, pipeline_id: pipeline.id, stage_id: stage.id, title: 'Negócio', value, status, closed_at: closedAt });
    }

    it('soma só os negócios ganhos do mês deste tenant e fecha o lucro líquido', async () => {
      const admin = await newAdmin();
      const other = await newAdmin();
      await makeDeal(admin.tenantId, 6000, 'won', '2026-10-15T15:00:00Z');
      await makeDeal(admin.tenantId, 4000, 'won', '2026-10-02T15:00:00Z');
      await makeDeal(admin.tenantId, 9000, 'won', '2026-09-30T15:00:00Z');
      await makeDeal(admin.tenantId, 777, 'open', null);
      await makeDeal(other.tenantId, 5000, 'won', '2026-10-15T15:00:00Z');

      await api(admin, 'PUT', '/taxes', { taxes: [{ name: 'Simples', rate: 10 }] });
      const expense = (await api(admin, 'POST', '/expenses', { ...RECURRING, amount: 1000 })).body.data.id as string;
      await api(admin, 'PUT', '/partners', { partners: [{ name: 'A', sharePercent: 100, proLabore: 500 }] });

      const res = await api(admin, 'GET', '/summary?month=2026-10');
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        month: '2026-10',
        revenue: 10000,
        taxesTotal: 1000,
        expensesTotal: 1000,
        proLaboreTotal: 500,
        netProfit: 7500,
        pendingTotal: 1000,
      });
      expect(res.body.data.distribution).toMatchObject([{ name: 'A', profitShare: 7500 }]);

      await api(admin, 'PUT', `/expenses/${expense}/payments/2026-10`, { paid: true });
      const paid = (await api(admin, 'GET', '/summary?month=2026-10')).body.data;
      expect(paid.pendingTotal).toBe(0);
      expect(paid.netProfit).toBe(7500);
      expect(paid.payables[0].status).toBe('paid');
    });

    it('o mês do negócio é o de Brasília: 22h de 31/10 em BRT é outubro, não novembro', async () => {
      const admin = await newAdmin();
      await makeDeal(admin.tenantId, 3000, 'won', '2026-11-01T01:00:00Z');
      expect((await api(admin, 'GET', '/summary?month=2026-10')).body.data.revenue).toBe(3000);
      expect((await api(admin, 'GET', '/summary?month=2026-11')).body.data.revenue).toBe(0);
    });

    it('sem month usa o mês atual; month inválido dá 422; não-admin dá 403', async () => {
      const admin = await newAdmin();
      const current = await api(admin, 'GET', '/summary');
      expect(current.status).toBe(200);
      expect(current.body.data.month).toMatch(/^\d{4}-\d{2}$/);
      expect(current.body.data.warnings.noConfig).toBe(true);

      expect((await api(admin, 'GET', '/summary?month=2026-9')).status).toBe(422);
      const manager = await actorFor(admin.tenantId, 'manager');
      expect((await api(manager, 'GET', '/summary?month=2026-10')).status).toBe(403);
    });
  });
});
