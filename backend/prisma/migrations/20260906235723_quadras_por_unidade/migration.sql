-- Remove FKs/index antigos antes de alterar as colunas que dependem deles
ALTER TABLE "reservas" DROP CONSTRAINT "reservas_unidadeId_fkey";
DROP INDEX "reservas_unidadeId_data_idx";

ALTER TABLE "unidade_modalidades" DROP CONSTRAINT "unidade_modalidades_modalidadeId_fkey";
ALTER TABLE "unidade_modalidades" DROP CONSTRAINT "unidade_modalidades_unidadeId_fkey";

-- CreateTable
CREATE TABLE "quadras" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quadras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quadra_modalidades" (
    "quadraId" TEXT NOT NULL,
    "modalidadeId" TEXT NOT NULL,
    "precoHora" DOUBLE PRECISION,

    CONSTRAINT "quadra_modalidades_pkey" PRIMARY KEY ("quadraId","modalidadeId")
);

-- Backfill: cada unidade existente ganha uma "Quadra 1", preservando o
-- comportamento atual (1 unidade = 1 quadra) ate o dono cadastrar as demais
-- quadras reais pelo painel.
INSERT INTO "quadras" ("id", "unidadeId", "nome", "ativa", "createdAt", "updatedAt")
SELECT 'quadra_' || u."id", u."id", 'Quadra 1', true, now(), now()
FROM "unidades" u;

-- Copia os vinculos de modalidade/preco da unidade para a quadra padrao dela
INSERT INTO "quadra_modalidades" ("quadraId", "modalidadeId", "precoHora")
SELECT 'quadra_' || um."unidadeId", um."modalidadeId", um."precoHora"
FROM "unidade_modalidades" um;

-- AlterTable: adiciona quadraId em reservas (nullable pra popular antes do NOT NULL)
ALTER TABLE "reservas" ADD COLUMN "quadraId" TEXT;

UPDATE "reservas" SET "quadraId" = 'quadra_' || "unidadeId";

ALTER TABLE "reservas" ALTER COLUMN "quadraId" SET NOT NULL;
ALTER TABLE "reservas" DROP COLUMN "unidadeId";

-- DropTable: substituida por quadra_modalidades (por quadra, nao por unidade)
DROP TABLE "unidade_modalidades";

-- CreateIndex
CREATE INDEX "quadras_unidadeId_idx" ON "quadras"("unidadeId");

-- CreateIndex
CREATE INDEX "reservas_quadraId_data_idx" ON "reservas"("quadraId", "data");

-- AddForeignKey
ALTER TABLE "quadras" ADD CONSTRAINT "quadras_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quadra_modalidades" ADD CONSTRAINT "quadra_modalidades_quadraId_fkey" FOREIGN KEY ("quadraId") REFERENCES "quadras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quadra_modalidades" ADD CONSTRAINT "quadra_modalidades_modalidadeId_fkey" FOREIGN KEY ("modalidadeId") REFERENCES "modalidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_quadraId_fkey" FOREIGN KEY ("quadraId") REFERENCES "quadras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
