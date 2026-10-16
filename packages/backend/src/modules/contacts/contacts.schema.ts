import { z } from 'zod';

export const contactTypeEnum = z.enum(['lead', 'contact', 'client']);

export const createContactSchema = z.object({
  type: contactTypeEnum.default('lead'),
  fullName: z.string().min(1).max(255),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  companyName: z.string().max(255).optional(),
  jobTitle: z.string().max(255).optional(),
  source: z.string().max(100).optional(),
  niche: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  ownerId: z.string().uuid().optional(),
  customFields: z.record(z.unknown()).optional(),
});

export const updateContactSchema = createContactSchema.partial();

export const listContactsQuerySchema = z.object({
  type: contactTypeEnum.optional(),
  owner: z.string().uuid().optional(),
  search: z.string().optional(),
  niche: z.string().max(100).optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type ListContactsQuery = z.infer<typeof listContactsQuerySchema>;
