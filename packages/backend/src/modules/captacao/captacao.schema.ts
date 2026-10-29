import { z } from 'zod';

// callback e lost não aparecem mais como opção (ficam pra leads antigos); answered = atendeu
export const CALL_STATUSES = ['pending', 'no_answer', 'answered', 'wrong_number', 'callback', 'meeting', 'lost'] as const;

export const LOST_REASONS = ['no_interest', 'has_supplier', 'price', 'wrong_number', 'closed_business', 'other'] as const;

export const updateMyLeadSchema = z.object({
  callStatus: z.enum(CALL_STATUSES).optional(),
  callNotes: z.string().max(2000).nullable().optional(),
  // true = Concluir lead; false = Editar (reabre)
  concluded: z.boolean().optional(),
  // true = Em aguardo (salva sem concluir); false = tira do aguardo
  onHold: z.boolean().optional(),
  // Situação informada pelo captador ao salvar: ganhou / perdeu (null = sem situação)
  leadResult: z.enum(['won', 'lost']).nullable().optional(),
  // Motivo da perda (com leadResult = lost)
  lostReason: z.enum(LOST_REASONS).nullable().optional(),
  // Próximo contato combinado com o lead (null = sem retorno)
  nextContactAt: z.string().datetime({ offset: true }).nullable().optional(),
  // true = esta gravação é uma tentativa de ligação nova (entra no histórico com o callStatus)
  logCall: z.boolean().optional(),
  // Reunião marcada: quando e como
  meetingAt: z.string().datetime({ offset: true }).nullable().optional(),
  meetingMode: z.enum(['online', 'presencial']).nullable().optional(),
  meetingLocation: z.string().trim().max(500).nullable().optional(),
  // Detalhes que vão pro evento do calendário
  meetingDuration: z.number().int().min(15).max(480).nullable().optional(),
  meetingAttendeeIds: z.array(z.string().uuid()).max(20).optional(),
  meetingGuests: z
    .array(z.object({ name: z.string().trim().min(1).max(120), title: z.string().trim().max(80).optional() }))
    .max(20)
    .optional(),
  // Plano B (WhatsApp): situação da mensagem; null = plano B não usado
  // waiting = enviada; no_reply = sem resposta (desistiu de esperar); no_whatsapp = número sem WhatsApp
  whatsappStatus: z.enum(['waiting', 'replied', 'no_reply', 'no_whatsapp']).nullable().optional(),
  // Pessoas de contato conseguidas na ligação (lista inteira; salva na empresa)
  leadPeople: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        title: z.string().trim().max(80).optional(),
        phone: z.string().trim().max(50).optional(),
        email: z.string().trim().email().max(255).optional().or(z.literal('')),
      }),
    )
    .max(20)
    .optional(),
});

export const myLeadsQuerySchema = z.object({
  status: z.enum(CALL_STATUSES).optional(),
  // won: só os que fecharam negócio (tela Minhas comissões)
  // followup: retorno marcado pra hoje ou atrasado
  scope: z.enum(['today', 'open', 'all', 'won', 'followup']).default('open'),
});

export const assignLeadsSchema = z.object({
  captadorId: z.string().uuid(),
  contactIds: z.array(z.string().uuid()).min(1).max(200),
});

export const availableContactsQuerySchema = z.object({
  search: z.string().optional(),
  niche: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

export const assignmentsQuerySchema = z.object({
  captadorId: z.string().uuid().optional(),
  status: z.enum(CALL_STATUSES).optional(),
  outcome: z.enum(['open', 'won', 'lost']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

export const closeAssignmentSchema = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('won'), dealValue: z.coerce.number().positive().max(1e12) }),
  z.object({ outcome: z.literal('lost') }),
  // Reabre o lead (desfaz o fechamento)
  z.object({ outcome: z.null() }),
]);

/** Lead digitado à mão na aba Distribuir (opcionalmente já entregue a um captador) */
export const createLeadSchema = z.object({
  fullName: z.string().trim().min(1).max(255),
  phone: z.string().trim().max(50).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  companyName: z.string().trim().max(255).optional(),
  jobTitle: z.string().trim().max(255).optional(),
  niche: z.string().trim().max(100).optional(),
  address: z.string().trim().max(500).optional(),
  mapsUrl: z.string().trim().max(1000).optional(),
  instagram: z.string().trim().max(255).optional(),
  website: z.string().trim().max(500).optional(),
  leadContext: z.string().trim().max(5000).optional(),
  captadorId: z.string().uuid().optional(),
});

export const commissionPaymentSchema = z.object({
  paid: z.boolean(),
});

export const updateSettingsSchema = z.object({
  commissionRate: z.coerce.number().min(0).max(100).optional(),
  // Cota diária da distribuição automática (0 = desligada)
  leadsPerDay: z.coerce.number().int().min(0).max(200).optional(),
});

export type UpdateMyLeadInput = z.infer<typeof updateMyLeadSchema>;
export type MyLeadsQuery = z.infer<typeof myLeadsQuerySchema>;
export type AssignLeadsInput = z.infer<typeof assignLeadsSchema>;
export type AvailableContactsQuery = z.infer<typeof availableContactsQuerySchema>;
export type AssignmentsQuery = z.infer<typeof assignmentsQuerySchema>;
export type CloseAssignmentInput = z.infer<typeof closeAssignmentSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
