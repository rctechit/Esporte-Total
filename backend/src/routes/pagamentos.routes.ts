import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { consultarPagamento } from "../lib/mercadopago.js";

export async function pagamentosRoutes(app: FastifyInstance) {
  // Chamado pelo Mercado Pago quando o status de um pagamento muda.
  // Não exige autenticação (é o Mercado Pago batendo aqui), mas só age
  // sobre reservas que já existem e já têm esse pixPaymentId associado.
  app.post("/webhook", async (request, reply) => {
    const body = request.body as { data?: { id?: string }; type?: string } | undefined;
    const paymentId = body?.data?.id;

    if (!paymentId) {
      return reply.code(200).send({ ok: true });
    }

    const pagamento = await consultarPagamento(paymentId).catch(() => null);
    if (!pagamento) {
      return reply.code(200).send({ ok: true });
    }

    if (pagamento.status === "approved") {
      await prisma.reserva.updateMany({
        where: { pixPaymentId: String(paymentId), status: "aguardando_pagamento" },
        data: { status: "pendente" },
      });
    } else if (["rejected", "cancelled"].includes(pagamento.status)) {
      await prisma.reserva.updateMany({
        where: { pixPaymentId: String(paymentId), status: "aguardando_pagamento" },
        data: { status: "cancelada" },
      });
    }

    return reply.code(200).send({ ok: true });
  });

  // Usado pela tela pública de agendamento para checar (via polling) se o
  // Pix já foi confirmado, sem precisar aguardar o webhook chegar.
  app.get("/reservas/:id/status", async (request, reply) => {
    const { id } = request.params as { id: string };

    const reserva = await prisma.reserva.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!reserva) {
      return reply.code(404).send({ error: "Reserva não encontrada." });
    }

    return reply.send(reserva);
  });
}
