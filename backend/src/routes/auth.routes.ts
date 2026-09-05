import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { verifyPassword } from "../lib/auth.js";
import { loginSchema } from "../schemas/auth.schema.js";
import { requireAuth } from "../middleware/requireAuth.js";

const ONE_DAY_SECONDS = 60 * 60 * 24;

export async function authRoutes(app: FastifyInstance) {
  app.post(
    "/login",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const parseResult = loginSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.code(400).send({ error: "Dados inválidos.", details: parseResult.error.flatten() });
      }

      const { email, password } = parseResult.data;

      const admin = await prisma.adminUser.findUnique({ where: { email } });

      // Mensagem genérica propositalmente igual para e-mail inexistente ou senha errada,
      // evitando enumeração de contas.
      const invalidCredentialsResponse = () =>
        reply.code(401).send({ error: "E-mail ou senha inválidos." });

      if (!admin) {
        return invalidCredentialsResponse();
      }

      const passwordValid = await verifyPassword(admin.passwordHash, password);

      if (!passwordValid) {
        return invalidCredentialsResponse();
      }

      const token = app.jwt.sign(
        { sub: admin.id, email: admin.email },
        { expiresIn: `${ONE_DAY_SECONDS}s` }
      );

      reply.setCookie("token", token, {
        ...app.cookieOptions,
        maxAge: ONE_DAY_SECONDS,
      });

      return reply.send({ id: admin.id, email: admin.email, nome: admin.nome });
    }
  );

  app.post("/logout", async (_request, reply) => {
    reply.clearCookie("token", { path: "/" });
    return reply.send({ ok: true });
  });

  app.get("/me", { preHandler: requireAuth }, async (request, reply) => {
    const admin = await prisma.adminUser.findUnique({
      where: { id: request.user.sub },
      select: { id: true, email: true, nome: true },
    });

    if (!admin) {
      return reply.code(401).send({ error: "Não autenticado." });
    }

    return reply.send(admin);
  });
}
