import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth, empresaFiltro } from "../middleware/requireAuth.js";
import {
  createUnidadeSchema,
  updateUnidadeSchema,
  listUnidadesQuerySchema,
  addFotoSchema,
  disponibilidadeQuerySchema,
  createReservaSchema,
  type QuadraInput,
} from "../schemas/unidade.schema.js";
import { uniqueSlug } from "../lib/slug.js";
import { geocodeAddress } from "../lib/geocode.js";
import { gerarSlots, HORA_ABERTURA_PADRAO, HORA_FECHAMENTO_PADRAO } from "../lib/horarios.js";
import { criarPagamentoPix, mercadoPagoEnabled } from "../lib/mercadopago.js";
import { env } from "../env.js";

const unidadeInclude = {
  quadras: {
    include: { modalidades: { include: { modalidade: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  fotos: { orderBy: { ordem: "asc" as const } },
};

// A pagina publica/o dashboard esperam `unidade.modalidades` (uma lista
// achatada de modalidade+preco), como antes de existirem quadras. Aqui
// derivamos isso a partir das quadras: quando mais de uma quadra oferece a
// mesma modalidade, mostramos o menor preco ("a partir de").
function derivarModalidades(
  quadras: Array<{ ativa: boolean; modalidades: Array<{ modalidadeId: string; precoHora: number | null; modalidade: unknown }> }>,
  { somenteAtivas = false }: { somenteAtivas?: boolean } = {}
) {
  const mapa = new Map<string, { modalidadeId: string; precoHora: number | null; modalidade: unknown }>();

  for (const quadra of quadras) {
    if (somenteAtivas && !quadra.ativa) continue;

    for (const rel of quadra.modalidades) {
      const atual = mapa.get(rel.modalidadeId);
      if (!atual) {
        mapa.set(rel.modalidadeId, { modalidadeId: rel.modalidadeId, precoHora: rel.precoHora, modalidade: rel.modalidade });
        continue;
      }
      if (rel.precoHora != null && (atual.precoHora == null || rel.precoHora < atual.precoHora)) {
        atual.precoHora = rel.precoHora;
      }
    }
  }

  return Array.from(mapa.values());
}

function comModalidadesDerivadas<T extends { quadras?: Parameters<typeof derivarModalidades>[0] }>(
  unidade: T,
  opts?: { somenteAtivas?: boolean }
) {
  return { ...unidade, modalidades: derivarModalidades(unidade.quadras || [], opts) };
}

function blankToUndefined<T extends Record<string, unknown>>(data: T): T {
  const result = { ...data };
  for (const key of Object.keys(result)) {
    if (result[key] === "") {
      (result as Record<string, unknown>)[key] = undefined;
    }
  }
  return result;
}

function buildEnderecoCompleto(input: {
  endereco: string;
  numero?: string;
  bairro?: string;
  cidade: string;
  estado: string;
}): string {
  const partes = [input.endereco, input.numero, input.bairro, `${input.cidade} - ${input.estado}`, "Brasil"];
  return partes.filter(Boolean).join(", ");
}

async function validarModalidadesDasQuadras(quadras: QuadraInput[]) {
  const ids = Array.from(new Set(quadras.flatMap((q) => q.modalidades.map((m) => m.modalidadeId))));
  if (!ids.length) return true;
  const existentes = await prisma.modalidade.count({ where: { id: { in: ids } } });
  return existentes === ids.length;
}

export async function unidadesRoutes(app: FastifyInstance) {
  app.get("/admin/todas", { preHandler: requireAuth }, async (request, reply) => {
    const parseResult = listUnidadesQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.code(400).send({ error: "Parâmetros inválidos.", details: parseResult.error.flatten() });
    }
    const { modalidade, cidade, busca, page, pageSize } = parseResult.data;
    const empresaId = empresaFiltro(request);

    const where = {
      ...(empresaId ? { empresaId } : {}),
      ...(modalidade ? { quadras: { some: { modalidades: { some: { modalidade: { slug: modalidade } } } } } } : {}),
      ...(cidade ? { cidade: { equals: cidade, mode: "insensitive" as const } } : {}),
      ...(busca
        ? {
            OR: [
              { nome: { contains: busca, mode: "insensitive" as const } },
              { cidade: { contains: busca, mode: "insensitive" as const } },
              { descricao: { contains: busca, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, unidades] = await Promise.all([
      prisma.unidade.count({ where }),
      prisma.unidade.findMany({
        where,
        include: unidadeInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return reply.send({ total, page, pageSize, unidades: unidades.map((u) => comModalidadesDerivadas(u)) });
  });

  app.get("/admin/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const empresaId = empresaFiltro(request);
    const unidade = await prisma.unidade.findUnique({ where: { id }, include: unidadeInclude });

    if (!unidade || (empresaId && unidade.empresaId !== empresaId)) {
      return reply.code(404).send({ error: "Unidade não encontrada." });
    }

    return reply.send(comModalidadesDerivadas(unidade));
  });

  app.get("/", async (request, reply) => {
    const parseResult = listUnidadesQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.code(400).send({ error: "Parâmetros inválidos.", details: parseResult.error.flatten() });
    }
    const { modalidade, cidade, busca, page, pageSize } = parseResult.data;

    const where = {
      ativo: true,
      ...(modalidade ? { quadras: { some: { ativa: true, modalidades: { some: { modalidade: { slug: modalidade } } } } } } : {}),
      ...(cidade ? { cidade: { equals: cidade, mode: "insensitive" as const } } : {}),
      ...(busca
        ? {
            OR: [
              { nome: { contains: busca, mode: "insensitive" as const } },
              { cidade: { contains: busca, mode: "insensitive" as const } },
              { descricao: { contains: busca, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, unidades] = await Promise.all([
      prisma.unidade.count({ where }),
      prisma.unidade.findMany({
        where,
        include: unidadeInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return reply.send({
      total,
      page,
      pageSize,
      unidades: unidades.map((u) => comModalidadesDerivadas(u, { somenteAtivas: true })),
    });
  });

  app.get("/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const unidade = await prisma.unidade.findFirst({
      where: { slug, ativo: true },
      include: unidadeInclude,
    });

    if (!unidade) {
      return reply.code(404).send({ error: "Unidade não encontrada." });
    }

    return reply.send(comModalidadesDerivadas(unidade, { somenteAtivas: true }));
  });

  app.post("/", { preHandler: requireAuth }, async (request, reply) => {
    const parseResult = createUnidadeSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: "Dados inválidos.", details: parseResult.error.flatten() });
    }

    const { quadras, empresaId: empresaIdBody, ...rest } = blankToUndefined(parseResult.data);

    let empresaId: string;
    if (request.user.role === "super_admin") {
      if (!empresaIdBody) {
        return reply.code(400).send({ error: "Informe a empresa dona desta unidade." });
      }
      empresaId = empresaIdBody;
    } else {
      if (!request.user.empresaId) {
        return reply.code(403).send({ error: "Seu usuário não está vinculado a nenhuma empresa." });
      }
      empresaId = request.user.empresaId;
    }

    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
    if (!empresa) {
      return reply.code(400).send({ error: "Empresa informada não existe." });
    }

    if (!(await validarModalidadesDasQuadras(quadras))) {
      return reply.code(400).send({ error: "Uma ou mais modalidades informadas não existem." });
    }

    const slug = await uniqueSlug(rest.nome, async (candidate) => {
      const found = await prisma.unidade.findUnique({ where: { slug: candidate } });
      return Boolean(found);
    });

    const geo = await geocodeAddress(
      buildEnderecoCompleto({
        endereco: rest.endereco,
        numero: rest.numero,
        bairro: rest.bairro,
        cidade: rest.cidade,
        estado: rest.estado,
      })
    ).catch(() => null);

    const unidade = await prisma.unidade.create({
      data: {
        ...rest,
        empresaId,
        slug,
        latitude: geo?.latitude,
        longitude: geo?.longitude,
        quadras: {
          create: quadras.map((q) => ({
            nome: q.nome,
            ativa: q.ativa ?? true,
            modalidades: {
              create: q.modalidades.map((m) => ({ modalidadeId: m.modalidadeId, precoHora: m.precoHora })),
            },
          })),
        },
      },
      include: unidadeInclude,
    });

    return reply.code(201).send(comModalidadesDerivadas(unidade));
  });

  app.put("/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateUnidadeSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: "Dados inválidos.", details: parseResult.error.flatten() });
    }

    const empresaId = empresaFiltro(request);
    const existing = await prisma.unidade.findUnique({ where: { id } });
    if (!existing || (empresaId && existing.empresaId !== empresaId)) {
      return reply.code(404).send({ error: "Unidade não encontrada." });
    }

    const { quadras, empresaId: empresaIdBody, ...rest } = blankToUndefined(parseResult.data);

    if (quadras && !(await validarModalidadesDasQuadras(quadras))) {
      return reply.code(400).send({ error: "Uma ou mais modalidades informadas não existem." });
    }

    // Só super_admin pode reatribuir a unidade a outra empresa; um dono comum
    // nao envia esse campo (o select fica oculto pra ele no formulario).
    if (empresaIdBody && request.user.role === "super_admin") {
      const empresa = await prisma.empresa.findUnique({ where: { id: empresaIdBody } });
      if (!empresa) {
        return reply.code(400).send({ error: "Empresa informada não existe." });
      }
    }

    let idsParaRemover: string[] = [];
    if (quadras) {
      const quadrasExistentes = await prisma.quadra.findMany({
        where: { unidadeId: id },
        select: { id: true, _count: { select: { reservas: true } } },
      });
      const idsValidos = new Set(quadrasExistentes.map((q) => q.id));

      for (const q of quadras) {
        if (q.id && !idsValidos.has(q.id)) {
          return reply.code(400).send({ error: "Uma das quadras informadas não pertence a esta unidade." });
        }
      }

      const idsEnviados = new Set(quadras.filter((q): q is QuadraInput & { id: string } => Boolean(q.id)).map((q) => q.id));
      const paraRemover = quadrasExistentes.filter((q) => !idsEnviados.has(q.id));
      const comReservas = paraRemover.find((q) => q._count.reservas > 0);
      if (comReservas) {
        return reply.code(400).send({
          error: "Não é possível excluir uma quadra que já tem reservas — desmarque a opção \"ativa\" nela em vez de removê-la.",
        });
      }
      idsParaRemover = paraRemover.map((q) => q.id);
    }

    const enderecoMudou =
      rest.endereco !== undefined ||
      rest.numero !== undefined ||
      rest.bairro !== undefined ||
      rest.cidade !== undefined ||
      rest.estado !== undefined;

    let geo: { latitude: number; longitude: number } | null = null;
    if (enderecoMudou) {
      geo = await geocodeAddress(
        buildEnderecoCompleto({
          endereco: rest.endereco ?? existing.endereco,
          numero: rest.numero ?? existing.numero ?? undefined,
          bairro: rest.bairro ?? existing.bairro ?? undefined,
          cidade: rest.cidade ?? existing.cidade,
          estado: rest.estado ?? existing.estado,
        })
      ).catch(() => null);
    }

    const unidade = await prisma.$transaction(async (tx) => {
      if (quadras) {
        if (idsParaRemover.length) {
          await tx.quadra.deleteMany({ where: { id: { in: idsParaRemover } } });
        }

        for (const q of quadras) {
          if (q.id) {
            await tx.quadraModalidade.deleteMany({ where: { quadraId: q.id } });
            await tx.quadra.update({
              where: { id: q.id },
              data: {
                nome: q.nome,
                ativa: q.ativa ?? true,
                modalidades: {
                  create: q.modalidades.map((m) => ({ modalidadeId: m.modalidadeId, precoHora: m.precoHora })),
                },
              },
            });
          } else {
            await tx.quadra.create({
              data: {
                unidadeId: id,
                nome: q.nome,
                ativa: q.ativa ?? true,
                modalidades: {
                  create: q.modalidades.map((m) => ({ modalidadeId: m.modalidadeId, precoHora: m.precoHora })),
                },
              },
            });
          }
        }
      }

      return tx.unidade.update({
        where: { id },
        data: {
          ...rest,
          ...(empresaIdBody && request.user.role === "super_admin" ? { empresaId: empresaIdBody } : {}),
          ...(geo ? { latitude: geo.latitude, longitude: geo.longitude } : {}),
        },
        include: unidadeInclude,
      });
    });

    return reply.send(comModalidadesDerivadas(unidade));
  });

  app.delete("/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const empresaId = empresaFiltro(request);

    const existing = await prisma.unidade.findUnique({ where: { id } });
    if (!existing || (empresaId && existing.empresaId !== empresaId)) {
      return reply.code(404).send({ error: "Unidade não encontrada." });
    }

    await prisma.unidade.delete({ where: { id } });
    return reply.code(204).send();
  });

  app.post("/:id/fotos", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const empresaId = empresaFiltro(request);
    const parseResult = addFotoSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: "Dados inválidos.", details: parseResult.error.flatten() });
    }

    const unidade = await prisma.unidade.findUnique({ where: { id } });
    if (!unidade || (empresaId && unidade.empresaId !== empresaId)) {
      return reply.code(404).send({ error: "Unidade não encontrada." });
    }

    const foto = await prisma.foto.create({
      data: { ...parseResult.data, unidadeId: id },
    });

    return reply.code(201).send(foto);
  });

  app.delete("/:id/fotos/:fotoId", { preHandler: requireAuth }, async (request, reply) => {
    const { id, fotoId } = request.params as { id: string; fotoId: string };
    const empresaId = empresaFiltro(request);

    const unidade = await prisma.unidade.findUnique({ where: { id } });
    if (!unidade || (empresaId && unidade.empresaId !== empresaId)) {
      return reply.code(404).send({ error: "Unidade não encontrada." });
    }

    const foto = await prisma.foto.findFirst({ where: { id: fotoId, unidadeId: id } });
    if (!foto) {
      return reply.code(404).send({ error: "Foto não encontrada." });
    }

    await prisma.foto.delete({ where: { id: fotoId } });
    return reply.code(204).send();
  });

  // Agenda do dono: mostra os 3 estados que importam pro negocio (disponivel,
  // aguardando aprovacao, locado), agora com uma grade por quadra - 2 quadras
  // podem estar locadas no mesmo horario e uma terceira continuar livre.
  app.get("/:id/agenda-admin", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const empresaId = empresaFiltro(request);
    const parseResult = disponibilidadeQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.code(400).send({ error: "Parâmetros inválidos.", details: parseResult.error.flatten() });
    }
    const { data, modalidadeId } = parseResult.data;

    const unidade = await prisma.unidade.findUnique({ where: { id } });
    if (!unidade || (empresaId && unidade.empresaId !== empresaId)) {
      return reply.code(404).send({ error: "Unidade não encontrada." });
    }

    const quadras = await prisma.quadra.findMany({
      where: { unidadeId: id, modalidades: { some: { modalidadeId } } },
      orderBy: { createdAt: "asc" },
    });

    if (!quadras.length) {
      return reply.send({ quadras: [] });
    }

    const slots = gerarSlots(
      unidade.horaAbertura || HORA_ABERTURA_PADRAO,
      unidade.horaFechamento || HORA_FECHAMENTO_PADRAO
    );

    const dataConsulta = new Date(`${data}T00:00:00.000Z`);

    const reservasDoDia = await prisma.reserva.findMany({
      where: {
        quadraId: { in: quadras.map((q) => q.id) },
        modalidadeId,
        data: dataConsulta,
        status: { not: "cancelada" },
      },
      select: { quadraId: true, horarios: true, status: true, nomeSolicitante: true, telefoneSolicitante: true },
    });

    const porQuadra = new Map<string, Map<string, { status: string; nomeSolicitante: string; telefoneSolicitante: string }>>(
      quadras.map((q) => [q.id, new Map()])
    );
    for (const reserva of reservasDoDia) {
      const mapaHorarios = porQuadra.get(reserva.quadraId);
      if (!mapaHorarios) continue;
      for (const horario of reserva.horarios) {
        mapaHorarios.set(horario, {
          status: reserva.status,
          nomeSolicitante: reserva.nomeSolicitante,
          telefoneSolicitante: reserva.telefoneSolicitante,
        });
      }
    }

    const resultado = quadras.map((quadra) => ({
      quadraId: quadra.id,
      quadraNome: quadra.nome,
      horarios: slots.map((horario) => {
        const ocupado = porQuadra.get(quadra.id)?.get(horario);
        if (!ocupado) {
          return { horario, status: "disponivel" as const };
        }
        return {
          horario,
          status: ocupado.status === "confirmada" ? ("locado" as const) : ("aguardando_aprovacao" as const),
          nomeSolicitante: ocupado.nomeSolicitante,
          telefoneSolicitante: ocupado.telefoneSolicitante,
        };
      }),
    }));

    return reply.send({ quadras: resultado });
  });

  app.get("/:slug/disponibilidade", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const parseResult = disponibilidadeQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.code(400).send({ error: "Parâmetros inválidos.", details: parseResult.error.flatten() });
    }
    const { data, modalidadeId } = parseResult.data;

    const unidade = await prisma.unidade.findFirst({ where: { slug, ativo: true } });
    if (!unidade) {
      return reply.code(404).send({ error: "Unidade não encontrada." });
    }

    const quadras = await prisma.quadra.findMany({
      where: { unidadeId: unidade.id, ativa: true, modalidades: { some: { modalidadeId } } },
      include: { modalidades: { where: { modalidadeId } } },
    });

    if (!quadras.length) {
      return reply.code(400).send({ error: "Esta unidade não oferece a modalidade informada." });
    }

    const precos = quadras.map((q) => q.modalidades[0]?.precoHora).filter((p): p is number => p != null);
    const precoHora = precos.length ? Math.min(...precos) : null;

    const slots = gerarSlots(
      unidade.horaAbertura || HORA_ABERTURA_PADRAO,
      unidade.horaFechamento || HORA_FECHAMENTO_PADRAO
    );

    const dataConsulta = new Date(`${data}T00:00:00.000Z`);

    // "Aguardando pagamento" ainda trava o horario (evita dois clientes
    // pagando pelo mesmo slot ao mesmo tempo) - so cancelada libera.
    const reservasDoDia = await prisma.reserva.findMany({
      where: {
        quadraId: { in: quadras.map((q) => q.id) },
        modalidadeId,
        data: dataConsulta,
        status: { not: "cancelada" },
      },
      select: { quadraId: true, horarios: true },
    });

    const ocupadoPorQuadra = new Map<string, Set<string>>(quadras.map((q) => [q.id, new Set()]));
    for (const reserva of reservasDoDia) {
      const set = ocupadoPorQuadra.get(reserva.quadraId);
      if (!set) continue;
      for (const horario of reserva.horarios) set.add(horario);
    }

    // O horario so aparece como indisponivel quando TODAS as quadras dessa
    // modalidade estiverem ocupadas nele - se sobrar uma quadra livre, o
    // cliente ainda pode reservar (a quadra especifica e escolhida no back).
    return reply.send({
      precoHora,
      horaAbertura: unidade.horaAbertura || HORA_ABERTURA_PADRAO,
      horaFechamento: unidade.horaFechamento || HORA_FECHAMENTO_PADRAO,
      horarios: slots.map((horario) => ({
        horario,
        disponivel: quadras.some((q) => !ocupadoPorQuadra.get(q.id)?.has(horario)),
      })),
    });
  });

  app.post("/:id/reservas", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = createReservaSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: "Dados inválidos.", details: parseResult.error.flatten() });
    }
    const { modalidadeId, data, horarios, nomeSolicitante, telefoneSolicitante } = parseResult.data;

    const unidade = await prisma.unidade.findFirst({ where: { id, ativo: true } });
    if (!unidade) {
      return reply.code(404).send({ error: "Unidade não encontrada." });
    }

    const quadrasCandidatas = await prisma.quadra.findMany({
      where: { unidadeId: unidade.id, ativa: true, modalidades: { some: { modalidadeId } } },
      include: { modalidades: { where: { modalidadeId } } },
      orderBy: { createdAt: "asc" },
    });

    if (!quadrasCandidatas.length) {
      return reply.code(400).send({ error: "Esta unidade não oferece a modalidade informada." });
    }

    const slotsValidos = new Set(
      gerarSlots(unidade.horaAbertura || HORA_ABERTURA_PADRAO, unidade.horaFechamento || HORA_FECHAMENTO_PADRAO)
    );
    const horarioInvalido = horarios.find((h) => !slotsValidos.has(h));
    if (horarioInvalido) {
      return reply.code(400).send({ error: `O horário ${horarioInvalido} está fora do funcionamento da unidade.` });
    }

    const dataReserva = new Date(`${data}T00:00:00.000Z`);

    const reservaCriada = await prisma.$transaction(async (tx) => {
      // Tenta encaixar a reserva em alguma quadra que esteja livre em TODOS
      // os horarios pedidos - a primeira que servir e a escolhida. Isso e o
      // que permite 2 quadras estarem locadas no mesmo horario e uma
      // terceira continuar disponivel para reserva.
      let quadraEscolhida: (typeof quadrasCandidatas)[number] | null = null;

      for (const quadra of quadrasCandidatas) {
        const conflitos = await tx.reserva.findMany({
          where: {
            quadraId: quadra.id,
            data: dataReserva,
            status: { not: "cancelada" },
            horarios: { hasSome: horarios },
          },
        });
        if (conflitos.length === 0) {
          quadraEscolhida = quadra;
          break;
        }
      }

      if (!quadraEscolhida) {
        throw new Error("CONFLITO_HORARIO");
      }

      const precoHora = quadraEscolhida.modalidades[0]?.precoHora ?? null;
      const valorTotal = precoHora ? precoHora * horarios.length : null;
      const valorSinal = valorTotal ? Math.round(valorTotal * 0.3 * 100) / 100 : null;

      // Sem Mercado Pago configurado (ou sem preco definido para calcular o
      // sinal), cai no fluxo antigo: vai direto para "aguardando aprovacao".
      const statusInicial = mercadoPagoEnabled && valorSinal ? "aguardando_pagamento" : "pendente";

      return tx.reserva.create({
        data: {
          quadraId: quadraEscolhida.id,
          modalidadeId,
          data: dataReserva,
          horarios,
          nomeSolicitante,
          telefoneSolicitante,
          valorTotal,
          valorSinal,
          status: statusInicial,
        },
      });
    }).catch((error) => {
      if (error instanceof Error && error.message === "CONFLITO_HORARIO") {
        return null;
      }
      throw error;
    });

    if (!reservaCriada) {
      return reply.code(409).send({ error: "Um ou mais horários selecionados acabaram de ser reservados. Escolha outro horário." });
    }

    if (reservaCriada.status !== "aguardando_pagamento" || !reservaCriada.valorSinal) {
      return reply.code(201).send(reservaCriada);
    }

    // Gera a cobranca Pix do sinal. Se o Mercado Pago falhar aqui, a reserva
    // ja existe (o horario ja ficou travado) - deixamos como aguardando
    // pagamento e devolvemos o erro para o cliente tentar de novo.
    try {
      const notificationUrl = env.PUBLIC_API_URL
        ? `${env.PUBLIC_API_URL.replace(/\/$/, "")}/api/pagamentos/webhook`
        : undefined;

      const pagamento = await criarPagamentoPix({
        valor: reservaCriada.valorSinal,
        descricao: `Sinal de reserva - ${unidade.nome}`,
        reservaId: reservaCriada.id,
        notificationUrl,
      });

      if (!pagamento) {
        return reply.code(201).send(reservaCriada);
      }

      const reservaAtualizada = await prisma.reserva.update({
        where: { id: reservaCriada.id },
        data: {
          pixPaymentId: String(pagamento.id),
          pixQrCode: pagamento.qrCodeBase64,
          pixCopiaCola: pagamento.copiaECola,
        },
      });

      return reply.code(201).send(reservaAtualizada);
    } catch (error) {
      request.log.error(error, "Falha ao gerar cobrança Pix");
      return reply.code(201).send({
        ...reservaCriada,
        avisoPagamento: "Não foi possível gerar o Pix agora. Tente novamente em instantes ou entre em contato pelo telefone da unidade.",
      });
    }
  });
}
