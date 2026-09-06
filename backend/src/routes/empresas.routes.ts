import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireSuperAdmin } from "../middleware/requireAuth.js";
import { hashPassword } from "../lib/auth.js";
import { createEmpresaSchema, updateEmpresaSchema } from "../schemas/empresa.schema.js";

function blankToUndefined<T extends Record<string, unknown>>(data: T): T {
  const result = { ...data };
  for (const key of Object.keys(result)) {
    if (result[key] === "") {
      (result as Record<string, unknown>)[key] = undefined;
    }
  }
  return result;
}

export async function empresasRoutes(app: FastifyInstance) {
  // Apenas o super_admin (voce, operador do hub) gerencia empresas e cria o
  // login de cada dono de quadra.
  app.get("/", { preHandler: requireSuperAdmin }, async (_request, reply) => {
    const empresas = await prisma.empresa.findMany({
      include: {
        _count: { select: { unidades: true, usuarios: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return reply.send(empresas);
  });

  app.post("/", { preHandler: requireSuperAdmin }, async (request, reply) => {
    const parseResult = createEmpresaSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: "Dados inválidos.", details: parseResult.error.flatten() });
    }

    const data = blankToUndefined(parseResult.data);

    const emailExistente = await prisma.adminUser.findUnique({ where: { email: data.adminEmail } });
    if (emailExistente) {
      return reply.code(400).send({ error: "Já existe um usuário com este e-mail." });
    }

    const passwordHash = await hashPassword(data.adminPassword);

    const empresa = await prisma.empresa.create({
      data: {
        nome: data.nome,
        email: data.email,
        telefone: data.telefone,
        usuarios: {
          create: {
            nome: data.adminNome,
            email: data.adminEmail,
            passwordHash,
            role: "owner",
          },
        },
      },
      include: { usuarios: { select: { id: true, nome: true, email: true } } },
    });

    return reply.code(201).send(empresa);
  });

  app.put("/:id", { preHandler: requireSuperAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateEmpresaSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: "Dados inválidos.", details: parseResult.error.flatten() });
    }

    const existing = await prisma.empresa.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ error: "Empresa não encontrada." });
    }

    const empresa = await prisma.empresa.update({
      where: { id },
      data: blankToUndefined(parseResult.data),
    });

    return reply.send(empresa);
  });

  app.delete("/:id", { preHandler: requireSuperAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.empresa.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ error: "Empresa não encontrada." });
    }

    await prisma.empresa.delete({ where: { id } });
    return reply.code(204).send();
  });
}
