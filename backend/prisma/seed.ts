import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

const MODALIDADES = [
  { nome: "Futebol", slug: "futebol", icone: "⚽" },
  { nome: "Tênis", slug: "tenis", icone: "🎾" },
  { nome: "Beach Tênis", slug: "beach-tenis", icone: "🏖️" },
  { nome: "Paraquedismo", slug: "paraquedismo", icone: "🪂" },
];

async function main() {
  for (const modalidade of MODALIDADES) {
    await prisma.modalidade.upsert({
      where: { slug: modalidade.slug },
      update: { nome: modalidade.nome, icone: modalidade.icone },
      create: modalidade,
    });
  }
  console.log(`Modalidades sincronizadas: ${MODALIDADES.map((m) => m.nome).join(", ")}`);

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminNome = process.env.ADMIN_NOME ?? "Administrador";

  if (!adminEmail || !adminPassword) {
    console.warn(
      "ADMIN_EMAIL / ADMIN_PASSWORD não definidos no .env — nenhum usuário admin foi criado."
    );
    return;
  }

  const passwordHash = await argon2.hash(adminPassword);

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: { passwordHash, nome: adminNome },
    create: { email: adminEmail, passwordHash, nome: adminNome },
  });

  console.log(`Usuário admin garantido: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
