import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { createModalidadeSchema, updateModalidadeSchema } from "../schemas/modalidade.schema.js";
import { uniqueSlug } from "../lib/slug.js";

export async function modalidadesRoutes(app: FastifyInstance) {
  app.get("/", async (_request, reply) => {
    const modalidades = await prisma.modalidade.findMany({
      orderBy: { nome: "asc" },
    });
    return reply.send(modalidades);
  });

  app.get("/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const modalidade = await prisma.modalidade.findUnique({ where: { slug } });

    if (!modalidade) {
      return reply.code(404).send({ error: "Modalidade não encontrada." });
    }

    return reply.send(modalidade);
  });

  app.post("/", { preHandler: requireAuth }, async (request, reply) => {
    const parseResult = createModalidadeSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.code(400).send({ error: "Dados inválidos.", details: parseResult.error.flatten() });
    }

    const data = parseResult.data;
    const slug = await uniqueSlug(data.nome, async (candidate) => {
      const found = await prisma.modalidade.findUnique({ where: { slug: candidate } });
      return Boolean(found);
    });

    const modalidade = await prisma.modalidade.create({
      data: { ...data, slug },
    });

    return reply.code(201).send(modalidade);
  });

  app.put("/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateModalidadeSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.code(400).send({ error: "Dados inválidos.", details: parseResult.error.flatten() });
    }

    const existing = await prisma.modalidade.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ error: "Modalidade não encontrada." });
    }

    const modalidade = await prisma.modalidade.update({
      where: { id },
      data: parseResult.data,
    });

    return reply.send(modalidade);
  });

  app.delete("/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.modalidade.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ error: "Modalidade não encontrada." });
    }

    await prisma.modalidade.delete({ where: { id } });
    return reply.code(204).send();
  });
}
