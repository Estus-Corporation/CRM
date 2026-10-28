import { z } from 'zod';
import { STAGES } from './domain';

// Entrada das rotas do LeadHunter. Formulário de campanha e importação são validados pelas regras do
// domínio (validateCampaign/validateImport, com as mensagens do Python); aqui ficam ids, filtros e corpos simples.

const EXPORT_MAX = 5000;
const SEND_MAX = 500;

export const uuid = z.string().uuid('Identificador inválido.');

export const idParams = z.object({ id: uuid });

const PRIORITIES = ['high', 'medium', 'low', 'review', 'excluded'] as const;

/** Filtro vazio (`?priority=`) é o mesmo que ausente, como no LeadHunter. */
const optionalFilter = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

export const companyFiltersQuery = z.object({
  q: z.string().max(200).optional(),
  priority: optionalFilter(z.enum(PRIORITIES, { message: 'Prioridade inválida.' })),
  stage: optionalFilter(z.enum(STAGES as [string, ...string[]], { message: 'Etapa inválida.' })),
});

export const foundCompaniesQuery = z.object({ demo: z.enum(['0', '1']).optional() });

export const sendContactsBody = z.object({
  companyIds: z.array(uuid).max(SEND_MAX, `Selecione até ${SEND_MAX} empresas.`).optional(),
  ownerId: uuid.nullable(),
});

export const exportCompaniesBody = z.object({
  companyIds: z.array(uuid).max(EXPORT_MAX, `Selecione até ${EXPORT_MAX} empresas.`).optional(),
});

export const patchCompanyBody = z.object({
  stage: z.enum(STAGES as [string, ...string[]], { message: 'Etapa inválida.' }).optional(),
  notes: z.string().optional(),
  instagramStatus: z.enum(['confirmed', 'rejected', 'candidate'], { message: 'Estado do Instagram inválido.' }).optional(),
  instagram: z.string().nullable().optional(),
});

export type CompanyFilters = z.infer<typeof companyFiltersQuery>;
export type SendContactsBody = z.infer<typeof sendContactsBody>;
export type PatchCompanyBody = z.infer<typeof patchCompanyBody>;
