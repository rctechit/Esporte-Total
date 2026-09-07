import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth.js";
import { uniqueSlug } from "../src/lib/slug.js";

// Cria uma empresa/unidade "demo" isolada, com 5 quadras e ~6 meses de
// reservas ficticias, so para visualizar como os relatorios (e a agenda por
// quadra) ficam com volume real de dados. Roda direto no ambiente de
// producao (via Console do Railway) e e seguro rodar mais de uma vez: as
// quadras que ja existem nao ganham historico duplicado (so um "top up" no
// mes atual), e quadras novas da lista abaixo ganham o historico completo.
//
// Para apagar tudo depois, rode: npx tsx scripts/cleanup-demo-relatorios.ts

const prisma = new PrismaClient();

const DEMO_ADMIN_EMAIL = "demo-relatorios@esportetotal.local";
const DEMO_ADMIN_SENHA = "DemoRelatorios2026!";
const DEMO_EMPRESA_NOME = "DEMO - pode apagar (relatorios)";
const DEMO_UNIDADE_NOME = "Arena Demo (dados ficticios)";

const QUADRAS_DEMO = [
  { nome: "Quadra 1 - Society", modalidadeSlug: "futebol", precoHora: 120, peso: 0.28 },
  { nome: "Quadra 2 - Society", modalidadeSlug: "futebol", precoHora: 120, peso: 0.2 },
  { nome: "Quadra 3 - Beach Tênis", modalidadeSlug: "beach-tenis", precoHora: 90, peso: 0.2 },
  { nome: "Quadra 4 - Tênis", modalidadeSlug: "tenis", precoHora: 80, peso: 0.18 },
  { nome: "Quadra 5 - Beach Tênis", modalidadeSlug: "beach-tenis", precoHora: 95, peso: 0.14 },
];

const HORARIOS = ["17:00", "18:00", "19:00", "20:00", "21:00"];
const NOMES = ["João", "Marcos", "Pedro", "Lucas", "Rafael", "Bruno", "Felipe", "André", "Carlos", "Diego"];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sortearHorario(diaSemana: number) {
  const pesoNoite = diaSemana === 0 || diaSemana === 6 ? 0.85 : 0.65;
  return Math.random() < pesoNoite ? HORARIOS[randInt(2, 4)] : HORARIOS[randInt(0, 4)];
}

async function main() {
  const modalidadesPorSlug = new Map(
    (await prisma.modalidade.findMany()).map((m) => [m.slug, m])
  );
  for (const q of QUADRAS_DEMO) {
    if (!modalidadesPorSlug.has(q.modalidadeSlug)) {
      throw new Error(`Modalidade '${q.modalidadeSlug}' não encontrada — rode o seed principal primeiro.`);
    }
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
      },
    });
    console.log(`Unidade demo criada: ${unidade.nome} (${unidade.id}).`);
  }

  // Garante que todas as quadras da lista existem (cria só as que faltam —
  // é isso que permite rodar de novo pra "adicionar mais quadras" depois).
  const quadrasExistentes = await prisma.quadra.findMany({ where: { unidadeId: unidade.id } });
  const nomesExistentes = new Set(quadrasExistentes.map((q) => q.nome));

  for (const q of QUADRAS_DEMO) {
    if (nomesExistentes.has(q.nome)) continue;
    const modalidade = modalidadesPorSlug.get(q.modalidadeSlug)!;
    await prisma.quadra.create({
      data: {
        unidadeId: unidade.id,
        nome: q.nome,
        modalidades: { create: { modalidadeId: modalidade.id, precoHora: q.precoHora } },
      },
    });
    console.log(`Quadra criada: ${q.nome}`);
  }

  const quadras = await prisma.quadra.findMany({
    where: { unidadeId: unidade.id },
    include: { modalidades: true, _count: { select: { reservas: true } } },
  });
  const quadrasPorNome = new Map(quadras.map((q) => [q.nome, q]));

  const hoje = new Date();
  const registros = [];

  for (const config of QUADRAS_DEMO) {
    const quadra = quadrasPorNome.get(config.nome)!;
    const modalidadeId = quadra.modalidades[0].modalidadeId;
    const precoHora = quadra.modalidades[0].precoHora || 100;
    const jaTinhaReservas = quadra._count.reservas > 0;

    // Quadra que ja tem historico so ganha um "top up" no mes atual (evita
    // duplicar 6 meses de dados toda vez que o script roda de novo).
    // Quadra nova (recem criada) ganha o historico completo de 6 meses.
    const meses = jaTinhaReservas ? [0] : [5, 4, 3, 2, 1, 0];

    for (const mesOffset of meses) {
      const baseMes = jaTinhaReservas ? 6 : 20;
      const totalMes = Math.round((baseMes + (5 - mesOffset) * 5) * config.peso * 3);

      for (let i = 0; i < totalMes; i += 1) {
        const diaDoMes = randInt(1, 27);
        const data = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - mesOffset, diaDoMes));
        if (data > hoje) continue;

        const diaSemana = data.getUTCDay();
        const horario = sortearHorario(diaSemana);
        const status = mesOffset === 0 && i >= totalMes - 2 ? "pendente" : "confirmada";

        registros.push({
          quadraId: quadra.id,
          modalidadeId,
          data,
          horarios: [horario],
          nomeSolicitante: NOMES[randInt(0, NOMES.length - 1)],
          telefoneSolicitante: `(41) 9${randInt(1000, 9999)}-${randInt(1000, 9999)}`,
          valorTotal: status === "confirmada" ? precoHora : null,
          status,
        });
      }
    }
  }

  await prisma.reserva.createMany({ data: registros });
  console.log(`Criadas ${registros.length} reservas ficticias, distribuídas em ${quadras.length} quadras.`);
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
