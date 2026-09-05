import { z } from "zod";

const telefoneRegex = /^[0-9()+\-\s]{8,20}$/;

export const createUnidadeSchema = z.object({
  nome: z.string().min(2).max(120),
  descricao: z.string().max(2000).optional(),
  telefone: z.string().regex(telefoneRegex).optional().or(z.literal("")),
  whatsapp: z.string().regex(telefoneRegex).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  site: z.string().url().optional().or(z.literal("")),
  endereco: z.string().min(3).max(200),
  numero: z.string().max(20).optional(),
  complemento: z.string().max(100).optional(),
  bairro: z.string().max(100).optional(),
  cidade: z.string().min(2).max(100),
  estado: z.string().length(2),
  cep: z.string().max(10).optional(),
  horarioFuncionamento: z.string().max(200).optional(),
  ativo: z.boolean().optional(),
  modalidadeIds: z.array(z.string().cuid()).min(1, "Selecione ao menos uma modalidade"),
});

export const updateUnidadeSchema = createUnidadeSchema.partial().extend({
  modalidadeIds: z.array(z.string().cuid()).min(1).optional(),
});

export const listUnidadesQuerySchema = z.object({
  modalidade: z.string().optional(),
  cidade: z.string().optional(),
  busca: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(12),
  incluirInativas: z.coerce.boolean().optional().default(false),
});

export const addFotoSchema = z.object({
  url: z.string().url(),
  publicId: z.string().optional(),
  ordem: z.number().int().min(0).optional(),
});

export type CreateUnidadeInput = z.infer<typeof createUnidadeSchema>;
export type UpdateUnidadeInput = z.infer<typeof updateUnidadeSchema>;
export type ListUnidadesQuery = z.infer<typeof listUnidadesQuerySchema>;
export type AddFotoInput = z.infer<typeof addFotoSchema>;
