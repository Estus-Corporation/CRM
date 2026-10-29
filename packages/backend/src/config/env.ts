import { z } from 'zod';
import dotenv from 'dotenv';
import { assertLocalDatabase } from './assertLocalDatabase';

dotenv.config();

const schema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  BACKEND_URL: z.string().url().default('http://localhost:3001'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('TitanFlow <onboarding@resend.dev>'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // LeadHunter (busca de leads): sem as chaves a campanha ao vivo não roda
  DATAFORSEO_LOGIN: z.string().optional(),
  DATAFORSEO_PASSWORD: z.string().optional(),
  TYPESAFE_API_KEY: z.string().optional(),
  TYPESAFE_MODEL: z.string().default('jev-1.13.0'),
  LEADHUNTER_MAX_CALLS_PER_CAMPAIGN: z.coerce.number().int().min(0).default(80),
  LEADHUNTER_MAX_CALLS_PER_DAY: z.coerce.number().int().min(0).default(200),
  LEADHUNTER_SEARCH_CACHE_DAYS: z.coerce.number().int().min(0).default(30),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

try {
  assertLocalDatabase(parsed.data.DATABASE_URL, parsed.data.NODE_ENV, process.env.ALLOW_REMOTE_DB);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

export const env = parsed.data;
