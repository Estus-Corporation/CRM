import { z } from 'zod';

export const createDealSchema = z.object({
  title: z.string().min(1).max(255),
  pipelineId: z.string().uuid(),
  stageId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  value: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  expectedClose: z.string().optional(),
  customFields: z.record(z.unknown()).optional(),
});

export const updateDealSchema = createDealSchema.partial();

export const moveDealSchema = z.object({
  stageId: z.string().uuid(),
  position: z.number().int().min(0).optional(),
});

export const lostDealSchema = z.object({
  lostReason: z.string().optional(),
});

export const reorderDealsSchema = z.object({
  stageId: z.string().uuid(),
  dealIds: z.array(z.string().uuid()),
});

export const listDealsQuerySchema = z.object({
  pipeline: z.string().uuid().optional(),
  stage: z.string().uuid().optional(),
  status: z.enum(['open', 'won', 'lost']).optional(),
  owner: z.string().uuid().optional(),
  contact: z.string().uuid().optional(),
  q: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});

export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
export type ListDealsQuery = z.infer<typeof listDealsQuerySchema>;
