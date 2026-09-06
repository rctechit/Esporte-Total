import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import { env, corsOrigins, isProduction } from "./env.js";
import { authRoutes } from "./routes/auth.routes.js";
import { modalidadesRoutes } from "./routes/modalidades.routes.js";
import { unidadesRoutes } from "./routes/unidades.routes.js";
import { uploadsRoutes } from "./routes/uploads.routes.js";
import { reservasRoutes } from "./routes/reservas.routes.js";
import { empresasRoutes } from "./routes/empresas.routes.js";
import { relatoriosRoutes } from "./routes/relatorios.routes.js";
import { pagamentosRoutes } from "./routes/pagamentos.routes.js";

export function buildApp() {
  const app = Fastify({
    logger: {
      level: isProduction ? "info" : "debug",
      redact: ["req.headers.cookie", "req.headers.authorization"],
    },
    trustProxy: true,
  });

  app.register(helmet, {
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  app.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
  });

  app.register(cookie);

  app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: "token",
      signed: false,
    },
  });

  app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
  });

  app.decorate(
    "cookieOptions",
    Object.freeze({
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : ("lax" as const),
      path: "/",
    })
  );

  app.get("/health", async () => ({ status: "ok" }));

  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(modalidadesRoutes, { prefix: "/api/modalidades" });
  app.register(unidadesRoutes, { prefix: "/api/unidades" });
  app.register(uploadsRoutes, { prefix: "/api/uploads" });
  app.register(reservasRoutes, { prefix: "/api/reservas" });
  app.register(empresasRoutes, { prefix: "/api/empresas" });
  app.register(relatoriosRoutes, { prefix: "/api/relatorios" });
  app.register(pagamentosRoutes, { prefix: "/api/pagamentos" });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "none" | "lax";
      path: string;
    };
  }
}
