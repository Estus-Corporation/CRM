import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';
import { db } from '../../db';

const TIER_LIMITS: Record<string, number> = {
  free: 100,
  starter: 1000,
  pro: 10000,
  enterprise: 100000,
};

async function getTenantPlan(tenantId: string): Promise<string> {
  const tenant = await db('tenants').where({ id: tenantId }).first('plan');
  return (tenant?.plan as string) ?? 'free';
}

export const tierRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: async (req: Request) => {
    if (!req.user) return TIER_LIMITS.free;
    const plan = await getTenantPlan(req.user.tenantId);
    return TIER_LIMITS[plan] ?? TIER_LIMITS.free;
  },
  keyGenerator: (req: Request) => req.user?.tenantId ?? ipKeyGenerator(req.ip ?? ''),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limit_exceeded', message: 'Daily API limit reached for your plan' },
  skip: (req: Request) => !req.user,
});
