import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/requireAuth.js";
import { createSignedUpload } from "../lib/cloudinary.js";
import { cloudinaryEnabled } from "../env.js";

export async function uploadsRoutes(app: FastifyInstance) {
  app.get("/status", async (_request, reply) => {
    return reply.send({ cloudinaryEnabled });
  });

  app.post("/sign", { preHandler: requireAuth }, async (_request, reply) => {
    if (!cloudinaryEnabled) {
      return reply
        .code(501)
        .send({ error: "Upload de imagens não está configurado. Use um link de imagem manualmente." });
    }

    const signedUpload = createSignedUpload();
    return reply.send(signedUpload);
  });
}
