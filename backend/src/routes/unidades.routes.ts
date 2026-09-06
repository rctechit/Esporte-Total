import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  createUnidadeSchema,
  updateUnidadeSchema,
  listUnidadesQuerySchema,
  addFotoSchema,
  disponibilidadeQuerySchema,
  createReservaSchema,
} from "../schemas/unidade.schema.js";
import { uniqueSlug } from "../lib/slug.js";
import { geocodeAddress } from "../lib/geocode.js";
import { gerarSlots, HORA_ABERTURA_PADRAO, HORA_FECHAMENTO_PADRAO } from "../lib/horarios.js";

const unidadeInclude = {
  modalidades: { include: { modalidade: true } },
  fotos: { orderBy: { ordem: "asc" as const } },
};

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

export async function unidadesRoutes(app: FastifyInstance) {
  app.get("/admin/todas", { preHandler: requireAuth }, async (request, reply) => {
    const parseResult = listUnidadesQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.code(400).send({ error: "Parâmetros inválidos.", details: parseResult.error.flatten() });
    }
    const { modalidade, cidade, busca, page, pageSize } = parseResult.data;

    const where = {
      ...(modalidade ? { modalidades: { some: { modalidade: { slug: modalidade } } } } : {}),
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

    return reply.send({ total, page, pageSize, unidades });
  });

  app.get("/admin/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const unidade = await prisma.unidade.findUnique({ where: { id }, include: unidadeInclude });

    if (!unidade) {
      return reply.code(404).send({ error: "Unidade não encontrada." });
    }

    return reply.send(unidade);
  });

  app.get("/", async (request, reply) => {
    const parseResult = listUnidadesQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.code(400).send({ error: "Parâmetros inválidos.", details: parseResult.error.flatten() });
    }
    const { modalidade, cidade, busca, page, pageSize } = parseResult.data;

    const where = {
      ativo: true,
      ...(modalidade ? { modalidades: { some: { modalidade: { slug: modalidade } } } } : {}),
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

    return reply.send({ total, page, pageSize, unidades });
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

    return reply.send(unidade);
  });

  app.post("/", { preHandler: requireAuth }, async (request, reply) => {
    const parseResult = createUnidadeSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: "Dados inválidos.", details: parseResult.error.flatten() });
    }

    const { modalidades, ...rest } = blankToUndefined(parseResult.data);

    const modalidadesExistentes = await prisma.modalidade.count({
      where: { id: { in: modalidades.map((m) => m.modalidadeId) } },
    });
    if (modalidadesExistentes !== modalidades.length) {
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
        slug,
        latitude: geo?.latitude,
        longitude: geo?.longitude,
        modalidades: {
          create: modalidades.map((m) => ({ modalidadeId: m.modalidadeId, precoHora: m.precoHora })),
        },
      },
      include: unidadeInclude,
    });

    return reply.code(201).send(unidade);
  });

  app.put("/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateUnidadeSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: "Dados inválidos.", details: parseResult.error.flatten() });
    }

    const existing = await prisma.unidade.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ error: "Unidade não encontrada." });
    }

    const { modalidades, ...rest } = blankToUndefined(parseResult.data);

    if (modalidades) {
      const modalidadesExistentes = await prisma.modalidade.count({
        where: { id: { in: modalidades.map((m) => m.modalidadeId) } },
      });
      if (modalidadesExistentes !== modalidades.length) {
        return reply.code(400).send({ error: "Uma ou mais modalidades informadas não existem." });
      }
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
      if (modalidades) {
        await tx.unidadeModalidade.deleteMany({ where: { unidadeId: id } });
      }

      return tx.unidade.update({
        where: { id },
        data: {
          ...rest,
          ...(geo ? { latitude: geo.latitude, longitude: geo.longitude } : {}),
          ...(modalidades
            ? {
                modalidades: {
                  create: modalidades.map((m) => ({ modalidadeId: m.modalidadeId, precoHora: m.precoHora })),
                },
              }
            : {}),
        },
        include: unidadeInclude,
      });
    });

    return reply.send(unidade);
  });

  app.delete("/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.unidade.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ error: "Unidade não encontrada." });
    }

    await prisma.unidade.delete({ where: { id } });
    return reply.code(204).send();
  });

  app.post("/:id/fotos", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = addFotoSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: "Dados inválidos.", details: parseResult.error.flatten() });
    }

    const unidade = await prisma.unidade.findUnique({ where: { id } });
    if (!unidade) {
      return reply.code(404).send({ error: "Unidade não encontrada." });
    }

    const foto = await prisma.foto.create({
      data: { ...parseResult.data, unidadeId: id },
    });

    return reply.code(201).send(foto);
  });

  app.delete("/:id/fotos/:fotoId", { preHandler: requireAuth }, async (request, reply) => {
    const { id, fotoId } = request.params as { id: string; fotoId: string };

    const foto = await prisma.foto.findFirst({ where: { id: fotoId, unidadeId: id } });
    if (!foto) {
      return reply.code(404).send({ error: "Foto não encontrada." });
    }

    await prisma.foto.delete({ where: { id: fotoId } });
    return reply.code(204).send();
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

    const vinculo = await prisma.unidadeModalidade.findUnique({
      where: { unidadeId_modalidadeId: { unidadeId: unidade.id, modalidadeId } },
    });
    if (!vinculo) {
      return reply.code(400).send({ error: "Esta unidade não oferece a modalidade informada." });
    }

    const slots = gerarSlots(
      unidade.horaAbertura || HORA_ABERTURA_PADRAO,
      unidade.horaFechamento || HORA_FECHAMENTO_PADRAO
    );

    const dataConsulta = new Date(`${data}T00:00:00.000Z`);

    const reservasDoDia = await prisma.reserva.findMany({
      where: {
        unidadeId: unidade.id,
        modalidadeId,
        data: dataConsulta,
        status: { not: "cancelada" },
      },
      select: { horarios: true },
    });

    const horariosOcupados = new Set(reservasDoDia.flatMap((r) => r.horarios));

    return reply.send({
      precoHora: vinculo.precoHora,
      horaAbertura: unidade.horaAbertura || HORA_ABERTURA_PADRAO,
      horaFechamento: unidade.horaFechamento || HORA_FECHAMENTO_PADRAO,
      horarios: slots.map((horario) => ({ horario, disponivel: !horariosOcupados.has(horario) })),
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

    const vinculo = await prisma.unidadeModalidade.findUnique({
      where: { unidadeId_modalidadeId: { unidadeId: unidade.id, modalidadeId } },
    });
    if (!vinculo) {
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

    const reserva = await prisma.$transaction(async (tx) => {
      const conflitos = await tx.reserva.findMany({
        where: {
          unidadeId: unidade.id,
          modalidadeId,
          data: dataReserva,
          status: { not: "cancelada" },
          horarios: { hasSome: horarios },
        },
      });

      if (conflitos.length > 0) {
        throw new Error("CONFLITO_HORARIO");
      }

      const valorTotal = vinculo.precoHora ? vinculo.precoHora * horarios.length : null;

      return tx.reserva.create({
        data: {
          unidadeId: unidade.id,
          modalidadeId,
          data: dataReserva,
          horarios,
          nomeSolicitante,
          telefoneSolicitante,
          valorTotal,
        },
      });
    }).catch((error) => {
      if (error instanceof Error && error.message === "CONFLITO_HORARIO") {
        return null;
      }
      throw error;
    });

    if (!reserva) {
      return reply.code(409).send({ error: "Um ou mais horários selecionados acabaram de ser reservados. Escolha outro horário." });
    }

    return reply.code(201).send(reserva);
  });
}
