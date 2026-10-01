-- CreateEnum
CREATE TYPE "DeliveryZoneScope" AS ENUM ('ALL', 'STANDARD', 'FROZEN');

-- AlterTable
ALTER TABLE "delivery_zones" ADD COLUMN "scope" "DeliveryZoneScope" NOT NULL DEFAULT 'ALL';

-- CreateIndex
CREATE UNIQUE INDEX "delivery_zones_tenantId_scope_key" ON "delivery_zones"("tenantId", "scope");
