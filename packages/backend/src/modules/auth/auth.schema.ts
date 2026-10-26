import { z } from 'zod';
import { keyPeopleSchema } from '../tenants/tenants.service';

export const registerSchema = z.object({
  workspaceName: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  fullName: z.string().min(2).max(255),
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// Foto de perfil: data URL da imagem recortada no frontend (256px)
const avatarSchema = z
  .string()
  .max(400_000)
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Foto inválida')
  .nullable();

export const updateMeSchema = z.object({
  fullName: z.string().trim().min(2).max(255).optional(),
  jobTitle: z.string().max(120).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  avatar: avatarSchema.optional(),
  password: z.string().min(8).optional(),
  currentPassword: z.string().optional(),
});

export const switchWorkspaceSchema = z.object({
  tenantId: z.string().uuid(),
});

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  keyPeople: keyPeopleSchema.optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type SwitchWorkspaceInput = z.infer<typeof switchWorkspaceSchema>;
