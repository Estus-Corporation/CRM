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
  // Dados de prospecção (LeadHunter / planilha)
  address: z.string().max(500).optional(),
  mapsUrl: z.string().max(1000).optional(),
  instagram: z.string().max(255).optional(),
  website: z.string().max(500).optional(),
  googleRating: z.coerce.number().min(0).max(5).optional(),
  googleReviews: z.coerce.number().int().min(0).optional(),
  // Contexto da empresa pro captador saber com quem fala
  leadContext: z.string().max(5000).optional(),
  tags: z.array(z.string()).optional(),
  ownerId: z.string().uuid().optional(),
  customFields: z.record(z.unknown()).optional(),
});

const optionalText = (max: number) => z.string().max(max).optional();

// Lote vindo do celular (vCard) ou de planilha — o frontend manda em blocos de até 500
export const bulkContactSchema = z.object({
  fullName: z.string().max(255),
  phone: optionalText(50),
  email: optionalText(255),
  company: optionalText(255),
  jobTitle: optionalText(255),
  niche: optionalText(255),
  source: optionalText(100),
  address: optionalText(500),
  mapsUrl: optionalText(1000),
  instagram: optionalText(255),
  website: optionalText(500),
  googleRating: z.coerce.number().min(0).max(5).optional(),
  googleReviews: z.coerce.number().int().min(0).optional(),
  leadContext: optionalText(5000),
});

export const bulkImportSchema = z.object({
  contacts: z.array(bulkContactSchema).min(1).max(500),
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
