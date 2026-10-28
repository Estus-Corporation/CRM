import { z } from 'zod';

export const LEAD_REQUEST_STATUSES = ['queued', 'claimed', 'running', 'done', 'partial', 'failed', 'cancelled'] as const;

export const uuidParam = z.string().uuid();

// Os campos do formulário da campanha do LeadHunter (sem `source`: pedido é sempre coleta real). Aqui fica só
// o formato de transporte; as regras e mensagens em pt-BR são as de `validateCampaign`, aplicadas no serviço
// (na criação e, na execução, sobre o resultado da mescla do pedido com a edição do admin).
const listOfText = z.union([z.string(), z.array(z.string())]);
const campaignFields = {
  niche: z.string(),
  city: z.string(),
  service: z.string(),
  limit: z.number(),
  quantity: z.number(), // nome antigo de `limit`: sem ele a quantidade pedida viraria o padrão (10) em silêncio
  keywords: listOfText,
  coordinates: listOfText,
  enrich: z.boolean(),
  useJev: z.boolean(),
  use_jev: z.boolean(),
  forceRefresh: z.boolean(),
  force_refresh: z.boolean(),
};

const notes = z.string().trim().max(1000).optional();

export const createLeadRequestSchema = z
  .object({ ...campaignFields, notes })
  .partial()
  .required({ niche: true, city: true });

/** Edição do admin ao executar: os mesmos campos, todos opcionais; o resultado é validado após a mescla. */
export const executeLeadRequestSchema = z.object({ ...campaignFields, notes }).partial();

export const rejectLeadRequestSchema = z.object({ message: z.string().trim().min(1).max(500) });

export const listLeadRequestsQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  status: z.enum(LEAD_REQUEST_STATUSES).optional(),
});

export type CreateLeadRequestInput = z.infer<typeof createLeadRequestSchema>;
export type ExecuteLeadRequestInput = z.infer<typeof executeLeadRequestSchema>;
export type ListLeadRequestsQuery = z.infer<typeof listLeadRequestsQuerySchema>;
