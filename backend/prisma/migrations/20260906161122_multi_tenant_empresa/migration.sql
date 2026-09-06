-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- Empresa padrao para dados existentes (unidades cadastradas antes do multi-tenant)
INSERT INTO "empresas" ("id", "nome", "updatedAt")
VALUES ('empresa_padrao_migracao', 'Esporte Total', CURRENT_TIMESTAMP);

-- AlterTable: admin_users
ALTER TABLE "admin_users" ADD COLUMN     "empresaId" TEXT,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'owner';

-- Admins existentes viram super_admin (visao completa da plataforma)
UPDATE "admin_users" SET "role" = 'super_admin';

-- AlterTable: reservas
ALTER TABLE "reservas" ADD COLUMN     "pixCopiaCola" TEXT,
ADD COLUMN     "pixPaymentId" TEXT,
ADD COLUMN     "pixQrCode" TEXT,
ADD COLUMN     "valorSinal" DOUBLE PRECISION,
ALTER COLUMN "status" SET DEFAULT 'aguardando_pagamento';

-- Reservas existentes ja passaram pelo fluxo antigo (sem Pix obrigatorio) - preservar como estavam
UPDATE "reservas" SET "status" = 'pendente' WHERE "status" = 'aguardando_pagamento';

-- AlterTable: unidades (empresaId nullable primeiro, para poder popular)
ALTER TABLE "unidades" ADD COLUMN     "empresaId" TEXT;

UPDATE "unidades" SET "empresaId" = 'empresa_padrao_migracao' WHERE "empresaId" IS NULL;

ALTER TABLE "unidades" ALTER COLUMN "empresaId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "admin_users_empresaId_idx" ON "admin_users"("empresaId");

-- CreateIndex
CREATE INDEX "reservas_pixPaymentId_idx" ON "reservas"("pixPaymentId");

-- CreateIndex
CREATE INDEX "unidades_empresaId_idx" ON "unidades"("empresaId");

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
