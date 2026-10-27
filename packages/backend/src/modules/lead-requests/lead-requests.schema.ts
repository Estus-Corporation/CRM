import { z } from 'zod';
import { leadHunterLeadSchema } from '../contacts/contacts.schema';

export const LEAD_REQUEST_STATUSES = ['queued', 'claimed', 'running', 'done', 'partial', 'failed', 'cancelled'] as const;

export const uuidParam = z.string().uuid();

export const createLeadRequestSchema = z.object({
  niche: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  quantity: z.number().int().min(1),
  notes: z.string().trim().max(1000).optional(),
});

export const listLeadRequestsQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  status: z.enum(LEAD_REQUEST_STATUSES).optional(),
});

export const queueQuerySchema = z.object({
  status: z.literal('queued').optional(),
});

export const progressSchema = z.object({
  message: z.string().max(300).optional(),
});

export const resultSchema = z.object({
  status: z.enum(['done', 'partial', 'failed']),
  message: z.string().max(500).optional(),
  leads: z.array(leadHunterLeadSchema).max(500),
});

export type CreateLeadRequestInput = z.infer<typeof createLeadRequestSchema>;
export type ListLeadRequestsQuery = z.infer<typeof listLeadRequestsQuerySchema>;
export type ResultInput = z.infer<typeof resultSchema>;
