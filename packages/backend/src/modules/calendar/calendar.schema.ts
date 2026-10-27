import { z } from 'zod';

export const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  allDay: z.boolean().optional().default(false),
  dealId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  attendeeIds: z.array(z.string().uuid()).max(50).optional(),
  // Convidados do lado do cliente: só nome e cargo
  externalAttendees: z
    .array(z.object({ name: z.string().trim().min(1).max(120), title: z.string().trim().max(80).optional() }))
    .max(30)
    .optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const listEventsQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
