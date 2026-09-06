import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// Remove a empresa demo criada por seed-demo-relatorios.ts (e, em cascata,
// sua unidade, reservas e login). So mexe nessa empresa especifica,
// identificada pelo e-mail unico do login demo - nunca toca em dados reais.

const prisma = new PrismaClient();
const DEMO_ADMIN_EMAIL = "demo-relatorios@esportetotal.local";

async function main() {
  const adminDemo = await prisma.adminUser.findUnique({ where: { email: DEMO_ADMIN_EMAIL } });

  if (!adminDemo?.empresaId) {
    console.log("Nenhuma empresa demo encontrada — nada para apagar.");
    return;
  }

  const empresa = await prisma.empresa.delete({ where: { id: adminDemo.empresaId } });
  console.log(`Empresa demo removida: ${empresa.nome} (${empresa.id})`);
  console.log("Unidade, reservas e login demo foram removidos junto (cascade).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
