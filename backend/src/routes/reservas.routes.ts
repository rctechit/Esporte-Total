import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth, empresaFiltro } from "../middleware/requireAuth.js";
import { updateReservaStatusSchema } from "../schemas/unidade.schema.js";

const reservaInclude = {
  quadra: {
    select: {
      id: true,
      nome: true,
      unidade: { select: { id: true, nome: true, slug: true, empresaId: true } },
    },
  },
  modalidade: { select: { id: true, nome: true } },
};

// O frontend espera `reserva.unidade` e `reserva.quadra` (nome da quadra) —
// achata a estrutura aninhada quadra->unidade vinda do Prisma.
function achatarReserva<T extends { quadra: { id: string; nome: string; unidade: unknown } }>(reserva: T) {
  const { quadra, ...rest } = reserva;
  return { ...rest, quadra: { id: quadra.id, nome: quadra.nome }, unidade: quadra.unidade };
}

export async function reservasRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: requireAuth }, async (request, reply) => {
    const { status } = request.query as { status?: string };
    const empresaId = empresaFiltro(request);

    const reservas = await prisma.reserva.findMany({
      where: {
        ...(status ? { status } : {}),
        // aguardando_pagamento so interessa ao cliente que esta pagando -
        // o dono da quadra so ve a reserva depois que o Pix confirma.
        ...(status ? {} : { status: { not: "aguardando_pagamento" } }),
        ...(empresaId ? { quadra: { unidade: { empresaId } } } : {}),
      },
      include: reservaInclude,
      orderBy: [{ data: "asc" }, { createdAt: "desc" }],
    });

    return reply.send(reservas.map(achatarReserva));
  });

  app.put("/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const empresaId = empresaFiltro(request);
    const parseResult = updateReservaStatusSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: "Dados inválidos.", details: parseResult.error.flatten() });
    }

    const existing = await prisma.reserva.findUnique({
      where: { id },
      include: { quadra: { select: { unidade: { select: { empresaId: true } } } } },
    });
    if (!existing || (empresaId && existing.quadra.unidade.empresaId !== empresaId)) {
      return reply.code(404).send({ error: "Reserva não encontrada." });
    }

    const reserva = await prisma.reserva.update({
      where: { id },
      data: { status: parseResult.data.status },
      include: reservaInclude,
    });

    return reply.send(achatarReserva(reserva));
  });
}
