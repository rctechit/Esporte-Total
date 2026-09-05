import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  createUnidadeSchema,
  updateUnidadeSchema,
  listUnidadesQuerySchema,
  addFotoSchema,
} from "../schemas/unidade.schema.js";
import { uniqueSlug } from "../lib/slug.js";
import { geocodeAddress } from "../lib/geocode.js";

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

    const { modalidadeIds, ...rest } = blankToUndefined(parseResult.data);

    const modalidadesExistentes = await prisma.modalidade.count({
      where: { id: { in: modalidadeIds } },
    });
    if (modalidadesExistentes !== modalidadeIds.length) {
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
          create: modalidadeIds.map((modalidadeId) => ({ modalidadeId })),
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

    const { modalidadeIds, ...rest } = blankToUndefined(parseResult.data);

    if (modalidadeIds) {
      const modalidadesExistentes = await prisma.modalidade.count({
        where: { id: { in: modalidadeIds } },
      });
      if (modalidadesExistentes !== modalidadeIds.length) {
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
      if (modalidadeIds) {
        await tx.unidadeModalidade.deleteMany({ where: { unidadeId: id } });
      }

      return tx.unidade.update({
        where: { id },
        data: {
          ...rest,
          ...(geo ? { latitude: geo.latitude, longitude: geo.longitude } : {}),
          ...(modalidadeIds
            ? { modalidades: { create: modalidadeIds.map((modalidadeId) => ({ modalidadeId })) } }
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
}
