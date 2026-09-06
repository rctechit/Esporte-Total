import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { updateReservaStatusSchema } from "../schemas/unidade.schema.js";

const reservaInclude = {
  unidade: { select: { id: true, nome: true, slug: true } },
  modalidade: { select: { id: true, nome: true } },
};

export async function reservasRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: requireAuth }, async (request, reply) => {
    const { status } = request.query as { status?: string };

    const reservas = await prisma.reserva.findMany({
      where: status ? { status } : undefined,
      include: reservaInclude,
      orderBy: [{ data: "asc" }, { createdAt: "desc" }],
    });

    return reply.send(reservas);
  });

  app.put("/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateReservaStatusSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: "Dados inválidos.", details: parseResult.error.flatten() });
    }

    const existing = await prisma.reserva.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ error: "Reserva não encontrada." });
    }

    const reserva = await prisma.reserva.update({
      where: { id },
      data: { status: parseResult.data.status },
      include: reservaInclude,
    });

    return reply.send(reserva);
  });
}
