import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth, empresaFiltro } from "../middleware/requireAuth.js";

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export async function relatoriosRoutes(app: FastifyInstance) {
  app.get("/resumo", { preHandler: requireAuth }, async (request, reply) => {
    const empresaId = empresaFiltro(request);

    const unidades = await prisma.unidade.findMany({
      where: empresaId ? { empresaId } : undefined,
      select: { id: true, nome: true },
    });
    const unidadeIds = unidades.map((u) => u.id);
    const nomesPorUnidade = new Map(unidades.map((u) => [u.id, u.nome]));

    const reservas = await prisma.reserva.findMany({
      where: {
        unidadeId: { in: unidadeIds },
        status: { not: "aguardando_pagamento" },
      },
      select: { unidadeId: true, valorTotal: true, status: true, data: true },
    });

    let faturamentoTotal = 0;
    const faturamentoPorUnidadeMap = new Map<string, number>();
    const contagemPorUnidadeMap = new Map<string, number>();
    const contagemPorDiaSemana = new Array(7).fill(0);

    for (const reserva of reservas) {
      if (reserva.status !== "cancelada") {
        contagemPorUnidadeMap.set(reserva.unidadeId, (contagemPorUnidadeMap.get(reserva.unidadeId) || 0) + 1);
        const diaSemana = reserva.data.getUTCDay();
        contagemPorDiaSemana[diaSemana] += 1;
      }

      if (reserva.status === "confirmada" && reserva.valorTotal) {
        faturamentoTotal += reserva.valorTotal;
        faturamentoPorUnidadeMap.set(
          reserva.unidadeId,
          (faturamentoPorUnidadeMap.get(reserva.unidadeId) || 0) + reserva.valorTotal
        );
      }
    }

    const faturamentoPorUnidade = unidadeIds
      .map((id) => ({
        unidadeId: id,
        nome: nomesPorUnidade.get(id) || "",
        total: Math.round((faturamentoPorUnidadeMap.get(id) || 0) * 100) / 100,
      }))
      .filter((u) => u.total > 0)
      .sort((a, b) => b.total - a.total);

    const unidadesMaisSolicitadas = unidadeIds
      .map((id) => ({
        unidadeId: id,
        nome: nomesPorUnidade.get(id) || "",
        totalReservas: contagemPorUnidadeMap.get(id) || 0,
      }))
      .filter((u) => u.totalReservas > 0)
      .sort((a, b) => b.totalReservas - a.totalReservas)
      .slice(0, 8);

    const tendenciaPorDiaSemana = DIAS_SEMANA.map((nome, index) => ({
      dia: nome,
      total: contagemPorDiaSemana[index],
    }));

    return reply.send({
      totalUnidades: unidades.length,
      faturamentoTotal: Math.round(faturamentoTotal * 100) / 100,
      totalReservasNaoCanceladas: reservas.filter((r) => r.status !== "cancelada").length,
      faturamentoPorUnidade,
      unidadesMaisSolicitadas,
      tendenciaPorDiaSemana,
    });
  });
}
