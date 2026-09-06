import type { FastifyReply, FastifyRequest } from "fastify";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ error: "Não autenticado." });
  }
}

export async function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "Não autenticado." });
  }

  if (request.user.role !== "super_admin") {
    return reply.code(403).send({ error: "Acesso restrito ao administrador da plataforma." });
  }
}

/**
 * Retorna o filtro de empresa a aplicar em consultas: super_admin enxerga tudo
 * (undefined = sem filtro), owner só enxerga a própria empresa.
 */
export function empresaFiltro(request: FastifyRequest): string | undefined {
  if (request.user.role === "super_admin") {
    return undefined;
  }
  return request.user.empresaId ?? "__sem_empresa__";
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; email: string; role: string; empresaId: string | null };
    user: { sub: string; email: string; role: string; empresaId: string | null };
  }
}
