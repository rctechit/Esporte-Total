import { z } from "zod";

export const createEmpresaSchema = z.object({
  nome: z.string().min(2).max(120),
  email: z.string().email().optional().or(z.literal("")),
  telefone: z.string().max(20).optional().or(z.literal("")),
  adminNome: z.string().min(2).max(120),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres"),
});

export const updateEmpresaSchema = z.object({
  nome: z.string().min(2).max(120).optional(),
  email: z.string().email().optional().or(z.literal("")),
  telefone: z.string().max(20).optional().or(z.literal("")),
  ativa: z.boolean().optional(),
});

export type CreateEmpresaInput = z.infer<typeof createEmpresaSchema>;
export type UpdateEmpresaInput = z.infer<typeof updateEmpresaSchema>;
