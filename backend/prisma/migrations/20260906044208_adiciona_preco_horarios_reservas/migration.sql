-- AlterTable
ALTER TABLE "unidade_modalidades" ADD COLUMN     "precoHora" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "unidades" ADD COLUMN     "horaAbertura" TEXT,
ADD COLUMN     "horaFechamento" TEXT;

-- CreateTable
CREATE TABLE "reservas" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "modalidadeId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "horarios" TEXT[],
    "nomeSolicitante" TEXT NOT NULL,
    "telefoneSolicitante" TEXT NOT NULL,
    "valorTotal" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservas_unidadeId_data_idx" ON "reservas"("unidadeId", "data");

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_modalidadeId_fkey" FOREIGN KEY ("modalidadeId") REFERENCES "modalidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
