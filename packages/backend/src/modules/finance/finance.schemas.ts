import { z } from 'zod';

export const uuidParam = z.string().uuid();

/** YYYY-MM */
export const monthParam = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês inválido (use AAAA-MM)');

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD)')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), 'Data inválida');

// numeric(14,2) comporta até 12 dígitos antes da vírgula
const money = z.number().min(0).max(999_999_999_999.99);

const expenseBase = {
  description: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(60).default('Outros'),
  amount: money,
};

export const createExpenseSchema = z.discriminatedUnion('kind', [
  z.object({
    ...expenseBase,
    kind: z.literal('recurring'),
    dueDay: z.number().int().min(1).max(31),
    startsOn: isoDate,
    endsOn: isoDate.nullish(),
  }),
  z.object({ ...expenseBase, kind: z.literal('one_off'), dueDate: isoDate }),
]);

/** Edição parcial; o tipo (`kind`) não muda. Campos que não pertencem ao tipo da despesa são recusados no serviço. */
export const updateExpenseSchema = z
  .object({
    description: expenseBase.description,
    category: z.string().trim().min(1).max(60),
    amount: money,
    dueDay: z.number().int().min(1).max(31),
    startsOn: isoDate,
    endsOn: isoDate.nullable(),
    dueDate: isoDate,
  })
  .partial();

export const setPaymentSchema = z.object({ paid: z.boolean() });

export const replaceTaxesSchema = z.object({
  taxes: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        rate: z.number().min(0).max(100),
        isActive: z.boolean().default(true),
      }),
    )
    .max(50),
});

export const replacePartnersSchema = z.object({
  partners: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        sharePercent: z.number().min(0).max(100),
        proLabore: money.default(0),
      }),
    )
    .max(50),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ReplaceTaxesInput = z.infer<typeof replaceTaxesSchema>['taxes'];
export type ReplacePartnersInput = z.infer<typeof replacePartnersSchema>['partners'];
