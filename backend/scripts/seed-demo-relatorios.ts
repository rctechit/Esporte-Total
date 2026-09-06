import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth.js";
import { uniqueSlug } from "../src/lib/slug.js";

// Cria uma empresa/unidade "demo" isolada, com ~6 meses de reservas
// ficticias, so para visualizar como os relatorios ficam com volume real de
// dados. Roda direto no ambiente de producao (via Console do Railway) e e
// seguro rodar mais de uma vez - se a empresa demo ja existir, so adiciona
// mais reservas no mes atual.
//
// Para apagar tudo depois, rode: npx tsx scripts/cleanup-demo-relatorios.ts

const prisma = new PrismaClient();

const DEMO_ADMIN_EMAIL = "demo-relatorios@esportetotal.local";
const DEMO_ADMIN_SENHA = "DemoRelatorios2026!";
const DEMO_EMPRESA_NOME = "DEMO - pode apagar (relatorios)";
const DEMO_UNIDADE_NOME = "Arena Demo (dados ficticios)";

const HORARIOS = ["17:00", "18:00", "19:00", "20:00", "21:00"];
const NOMES = ["João", "Marcos", "Pedro", "Lucas", "Rafael", "Bruno", "Felipe", "André", "Carlos", "Diego"];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  const modalidade = await prisma.modalidade.findUnique({ where: { slug: "futebol" } });
  if (!modalidade) {
    throw new Error("Modalidade 'futebol' não encontrada — rode o seed principal primeiro.");
  }

  let adminDemo = await prisma.adminUser.findUnique({ where: { email: DEMO_ADMIN_EMAIL } });
  let empresaId = adminDemo?.empresaId ?? null;

  if (!adminDemo || !empresaId) {
    const passwordHash = await hashPassword(DEMO_ADMIN_SENHA);
    const empresa = await prisma.empresa.create({
      data: {
        nome: DEMO_EMPRESA_NOME,
        usuarios: {
          create: { email: DEMO_ADMIN_EMAIL, passwordHash, nome: "Conta Demo", role: "owner" },
        },
      },
    });
    empresaId = empresa.id;
    console.log(`Empresa demo criada: ${empresa.nome} (${empresa.id})`);
    console.log(`Login do dono demo: ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_SENHA}`);
  } else {
    console.log("Empresa demo já existia — reaproveitando.");
  }

  let unidade = await prisma.unidade.findFirst({ where: { empresaId } });

  if (!unidade) {
    const slug = await uniqueSlug(DEMO_UNIDADE_NOME, async (candidate) => {
      const found = await prisma.unidade.findUnique({ where: { slug: candidate } });
      return Boolean(found);
    });

    unidade = await prisma.unidade.create({
      data: {
        empresaId,
        nome: DEMO_UNIDADE_NOME,
        slug,
        endereco: "Rua Demonstração, 100",
        cidade: "Curitiba",
        estado: "PR",
        horaAbertura: "08:00",
        horaFechamento: "22:00",
        modalidades: { create: { modalidadeId: modalidade.id, precoHora: 120 } },
      },
    });
    console.log(`Unidade demo criada: ${unidade.nome} (${unidade.id})`);
  }

  const hoje = new Date();
  const registros = [];

  for (let mesOffset = 5; mesOffset >= 0; mesOffset -= 1) {
    const totalMes = 15 + (5 - mesOffset) * 4; // crescimento mes a mes
    for (let i = 0; i < totalMes; i += 1) {
      const diaDoMes = randInt(1, 27);
      const data = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - mesOffset, diaDoMes));
      if (data > hoje) continue;

      const diaSemana = data.getUTCDay();
      const pesoNoite = diaSemana === 0 || diaSemana === 6 ? 0.85 : 0.65;
      const horario = Math.random() < pesoNoite ? HORARIOS[randInt(2, 4)] : HORARIOS[randInt(0, 4)];

      const status = mesOffset === 0 && i >= totalMes - 3 ? "pendente" : "confirmada";
      registros.push({
        unidadeId: unidade.id,
        modalidadeId: modalidade.id,
        data,
        horarios: [horario],
        nomeSolicitante: NOMES[randInt(0, NOMES.length - 1)],
        telefoneSolicitante: `(41) 9${randInt(1000, 9999)}-${randInt(1000, 9999)}`,
        valorTotal: status === "confirmada" ? 120 : null,
        status,
      });
    }
  }

  await prisma.reserva.createMany({ data: registros });
  console.log(`Criadas ${registros.length} reservas ficticias na unidade demo.`);
  console.log("\nPara apagar tudo depois: npx tsx scripts/cleanup-demo-relatorios.ts");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
