-- CreateIndex
CREATE UNIQUE INDEX "orders_tenantId_legacyOrderId_key" ON "orders"("tenantId", "legacyOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenantId_legacyProductId_key" ON "products"("tenantId", "legacyProductId");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_tenantId_legacyId_key" ON "reservations"("tenantId", "legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "tables_inventory_tenantId_legacyId_key" ON "tables_inventory"("tenantId", "legacyId");

