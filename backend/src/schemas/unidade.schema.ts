import { z } from "zod";

const telefoneRegex = /^[0-9()+\-\s]{8,20}$/;
const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const modalidadePrecoSchema = z.object({
  modalidadeId: z.string().cuid(),
  precoHora: z.number().positive().max(100000).optional(),
});

export const quadraSchema = z.object({
  id: z.string().cuid().optional(),
  nome: z.string().min(1, "Dê um nome para a quadra").max(60),
  ativa: z.boolean().optional(),
  modalidades: z.array(modalidadePrecoSchema).min(1, "Selecione ao menos uma modalidade para a quadra"),
});

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
  horaAbertura: z.string().regex(horaRegex).optional().or(z.literal("")),
  horaFechamento: z.string().regex(horaRegex).optional().or(z.literal("")),
  ativo: z.boolean().optional(),
  empresaId: z.string().cuid().optional(),
  quadras: z.array(quadraSchema).min(1, "Cadastre ao menos uma quadra"),
});

export const updateUnidadeSchema = createUnidadeSchema.partial().extend({
  quadras: z.array(quadraSchema).min(1).optional(),
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

export const disponibilidadeQuerySchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD"),
  modalidadeId: z.string().cuid(),
});

export const createReservaSchema = z.object({
  modalidadeId: z.string().cuid(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD"),
  horarios: z
    .array(z.string().regex(/^([01]\d|2[0-3]):00$/))
    .min(1, "Selecione ao menos um horário"),
  nomeSolicitante: z.string().min(2).max(120),
  telefoneSolicitante: z.string().regex(telefoneRegex),
});

export const updateReservaStatusSchema = z.object({
  status: z.enum(["pendente", "confirmada", "cancelada"]),
});

export type QuadraInput = z.infer<typeof quadraSchema>;
export type CreateUnidadeInput = z.infer<typeof createUnidadeSchema>;
export type UpdateUnidadeInput = z.infer<typeof updateUnidadeSchema>;
export type ListUnidadesQuery = z.infer<typeof listUnidadesQuerySchema>;
export type AddFotoInput = z.infer<typeof addFotoSchema>;
export type DisponibilidadeQuery = z.infer<typeof disponibilidadeQuerySchema>;
export type CreateReservaInput = z.infer<typeof createReservaSchema>;
export type UpdateReservaStatusInput = z.infer<typeof updateReservaStatusSchema>;
