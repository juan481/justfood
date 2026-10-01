-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'BARRA';

-- AlterEnum
ALTER TYPE "OrderChannel" ADD VALUE 'DINE_IN';

-- CreateEnum
CREATE TYPE "PrepArea" AS ENUM ('COCINA', 'BARRA', 'SIN_IMPRESION');

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('LIBRE', 'OCUPADA', 'ESPERANDO_PAGO');

-- AlterTable
ALTER TABLE "categories" ADD COLUMN "prepArea" "PrepArea" NOT NULL DEFAULT 'COCINA';

-- AlterTable
ALTER TABLE "products" ADD COLUMN "prepAreaOverride" "PrepArea";

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "prepAreaSnapshot" "PrepArea",
ADD COLUMN "preparedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "tableId" TEXT,
ADD COLUMN "guestCount" INTEGER,
ADD COLUMN "waiterUserId" TEXT,
ADD COLUMN "waiterName" TEXT;

-- CreateTable
CREATE TABLE "tables" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "status" "TableStatus" NOT NULL DEFAULT 'LIBRE',
    "currentOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tables_currentOrderId_key" ON "tables"("currentOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "tables_tenantId_branchId_number_key" ON "tables"("tenantId", "branchId", "number");

-- CreateIndex
CREATE INDEX "tables_tenantId_idx" ON "tables"("tenantId");

-- CreateIndex
CREATE INDEX "order_items_prepAreaSnapshot_preparedAt_idx" ON "order_items"("prepAreaSnapshot", "preparedAt");

-- CreateIndex
CREATE INDEX "orders_tableId_idx" ON "orders"("tableId");

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_currentOrderId_fkey" FOREIGN KEY ("currentOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
