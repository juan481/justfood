// Crea las mesas físicas (Mesa 1..N) de un tenant en su sucursal default.
// Re-corrible: salta números que ya existen, no duplica ni pisa el estado
// de una mesa que ya está en uso.
//
// Uso: npm run seed:tables -- pizzazeka 24
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [tenantSlug, countArg] = process.argv.slice(2);
  const count = parseInt(countArg || '', 10);
  if (!tenantSlug || !Number.isSafeInteger(count) || count < 1) {
    console.error('Uso: npm run seed:tables -- <tenantSlug> <cantidadDeMesas>');
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant "${tenantSlug}" no existe.`);
  const branch = await prisma.branch.findFirst({ where: { tenantId: tenant.id, isDefault: true } });
  if (!branch) throw new Error(`Tenant "${tenantSlug}" no tiene sucursal default.`);

  const existing = await prisma.table.findMany({ where: { tenantId: tenant.id, branchId: branch.id }, select: { number: true } });
  const existingNumbers = new Set(existing.map((t) => t.number));

  let created = 0;
  for (let n = 1; n <= count; n++) {
    if (existingNumbers.has(n)) continue;
    await prisma.table.create({ data: { tenantId: tenant.id, branchId: branch.id, number: n, capacity: 4 } });
    created++;
  }

  console.log(`Creadas ${created} mesas nuevas (de 1 a ${count}). Ya existían: ${existingNumbers.size}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
