import { z } from 'zod';
import dotenv from 'dotenv';

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
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
