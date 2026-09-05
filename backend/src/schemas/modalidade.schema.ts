import { z } from "zod";

export const createModalidadeSchema = z.object({
  nome: z.string().min(2).max(80),
  descricao: z.string().max(500).optional(),
  icone: z.string().max(10).optional(),
});

export const updateModalidadeSchema = createModalidadeSchema.partial();

export type CreateModalidadeInput = z.infer<typeof createModalidadeSchema>;
export type UpdateModalidadeInput = z.infer<typeof updateModalidadeSchema>;
