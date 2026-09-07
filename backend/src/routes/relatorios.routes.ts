import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth, empresaFiltro } from "../middleware/requireAuth.js";
import { gerarSlots, HORA_ABERTURA_PADRAO, HORA_FECHAMENTO_PADRAO } from "../lib/horarios.js";

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES_CURTO = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export async function relatoriosRoutes(app: FastifyInstance) {
  app.get("/resumo", { preHandler: requireAuth }, async (request, reply) => {
    const empresaId = empresaFiltro(request);

    const unidades = await prisma.unidade.findMany({
      where: empresaId ? { empresaId } : undefined,
      select: { id: true, nome: true },
    });
    const unidadeIds = unidades.map((u) => u.id);
    const nomesPorUnidade = new Map(unidades.map((u) => [u.id, u.nome]));

    const quadras = await prisma.quadra.findMany({
      where: { unidadeId: { in: unidadeIds } },
      select: { id: true, nome: true, unidadeId: true },
    });
    const quadraIds = quadras.map((q) => q.id);
    const quadrasPorId = new Map(quadras.map((q) => [q.id, q]));

    const reservas = await prisma.reserva.findMany({
      where: {
        quadraId: { in: quadraIds },
        status: { not: "aguardando_pagamento" },
      },
      select: { quadraId: true, valorTotal: true, status: true, data: true, horarios: true },
    });

    let faturamentoTotal = 0;
    const faturamentoPorQuadraMap = new Map<string, number>();
    const contagemPorQuadraMap = new Map<string, number>();
    const contagemPorDiaSemana = new Array(7).fill(0);

    // Evolução mensal: faturamento locado dos últimos 6 meses (incluindo o atual).
    const hoje = new Date();
    const chaveMs = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}`;
    const mesesRecentes: { chave: string; mes: string }[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1));
      mesesRecentes.push({ chave: chaveMs(d.getUTCFullYear(), d.getUTCMonth() + 1), mes: MESES_CURTO[d.getUTCMonth()] });
    }
    const faturamentoPorMesMap = new Map<string, number>();

    // Ocupação por horário: quantas vezes cada combinação dia-da-semana x
    // horário foi reservada (aguardando aprovação ou locada) - ajuda a achar
    // os horários de pico e os "buracos" na agenda.
    const slotsPadrao = gerarSlots(HORA_ABERTURA_PADRAO, HORA_FECHAMENTO_PADRAO);
    const contagemPorHorarioMap = new Map<string, number>();

    for (const reserva of reservas) {
      if (reserva.status !== "cancelada") {
        contagemPorQuadraMap.set(reserva.quadraId, (contagemPorQuadraMap.get(reserva.quadraId) || 0) + 1);
        const diaSemana = reserva.data.getUTCDay();
        contagemPorDiaSemana[diaSemana] += 1;

        for (const horario of reserva.horarios) {
          if (slotsPadrao.includes(horario)) {
            const chave = `${diaSemana}-${horario}`;
            contagemPorHorarioMap.set(chave, (contagemPorHorarioMap.get(chave) || 0) + 1);
          }
        }
      }

      if (reserva.status === "confirmada" && reserva.valorTotal) {
        faturamentoTotal += reserva.valorTotal;
        faturamentoPorQuadraMap.set(
          reserva.quadraId,
          (faturamentoPorQuadraMap.get(reserva.quadraId) || 0) + reserva.valorTotal
        );

        const chaveMes = chaveMs(reserva.data.getUTCFullYear(), reserva.data.getUTCMonth() + 1);
        faturamentoPorMesMap.set(chaveMes, (faturamentoPorMesMap.get(chaveMes) || 0) + reserva.valorTotal);
      }
    }

    // Agrega por unidade (soma das quadras dela) para manter os graficos que
    // ja existiam antes das quadras.
    const faturamentoPorUnidadeMap = new Map<string, number>();
    const contagemPorUnidadeMap = new Map<string, number>();
    for (const quadra of quadras) {
      const faturamentoQuadra = faturamentoPorQuadraMap.get(quadra.id) || 0;
      const contagemQuadra = contagemPorQuadraMap.get(quadra.id) || 0;
      faturamentoPorUnidadeMap.set(quadra.unidadeId, (faturamentoPorUnidadeMap.get(quadra.unidadeId) || 0) + faturamentoQuadra);
      contagemPorUnidadeMap.set(quadra.unidadeId, (contagemPorUnidadeMap.get(quadra.unidadeId) || 0) + contagemQuadra);
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

    // Indicador por quadra: mostra, dentro de cada unidade, quais quadras
    // especificas estao rendendo mais ou tendo mais demanda - 2 quadras da
    // mesma unidade podem ter desempenho bem diferente.
    const desempenhoPorQuadra = quadraIds
      .map((id) => {
        const quadra = quadrasPorId.get(id)!;
        return {
          quadraId: id,
          quadraNome: quadra.nome,
          unidadeNome: nomesPorUnidade.get(quadra.unidadeId) || "",
          totalReservas: contagemPorQuadraMap.get(id) || 0,
          faturamento: Math.round((faturamentoPorQuadraMap.get(id) || 0) * 100) / 100,
        };
      })
      .filter((q) => q.totalReservas > 0 || q.faturamento > 0)
      .sort((a, b) => b.faturamento - a.faturamento || b.totalReservas - a.totalReservas);

    const tendenciaPorDiaSemana = DIAS_SEMANA.map((nome, index) => ({
      dia: nome,
      total: contagemPorDiaSemana[index],
    }));

    const evolucaoMensal = mesesRecentes.map(({ chave, mes }) => ({
      mes,
      total: Math.round((faturamentoPorMesMap.get(chave) || 0) * 100) / 100,
    }));

    const ocupacaoPorHorario = [] as { diaSemana: number; dia: string; horario: string; total: number }[];
    for (let diaSemana = 0; diaSemana < 7; diaSemana += 1) {
      for (const horario of slotsPadrao) {
        ocupacaoPorHorario.push({
          diaSemana,
          dia: DIAS_SEMANA_CURTO[diaSemana],
          horario,
          total: contagemPorHorarioMap.get(`${diaSemana}-${horario}`) || 0,
        });
      }
    }

    return reply.send({
      totalUnidades: unidades.length,
      totalQuadras: quadras.length,
      faturamentoTotal: Math.round(faturamentoTotal * 100) / 100,
      totalReservasNaoCanceladas: reservas.filter((r) => r.status !== "cancelada").length,
      faturamentoPorUnidade,
      unidadesMaisSolicitadas,
      desempenhoPorQuadra,
      tendenciaPorDiaSemana,
      evolucaoMensal,
      ocupacaoPorHorario,
    });
  });
}
