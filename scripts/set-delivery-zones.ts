// Configura las zonas de delivery (STANDARD / FROZEN) de un tenant desde la
// terminal — la pantalla de Ajustes ya permite editarlas a mano, esto es el
// atajo para el corte inicial de pizzazeka sin tener que loguearse primero.
//
// Uso:
//   npm run set:delivery-zones -- pizzazeka --standard-cost=2500 --standard-radius=2 --frozen-cost=2500 --frozen-radius=20
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function getFlag(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = args.find((a) => a.startsWith(prefix));
  return match?.slice(prefix.length);
}

async function main() {
  const [tenantSlug, ...flags] = process.argv.slice(2);
  if (!tenantSlug) {
    console.error(
      'Uso: npm run set:delivery-zones -- <tenantSlug> [--standard-cost=...] [--standard-radius=...] [--frozen-cost=...] [--frozen-radius=...]'
    );
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant "${tenantSlug}" no existe.`);
  const branch = await prisma.branch.findFirst({ where: { tenantId: tenant.id, isDefault: true } });
  if (!branch) throw new Error(`Tenant "${tenantSlug}" no tiene sucursal default.`);

  const standardCost = getFlag(flags, 'standard-cost');
  const standardRadius = getFlag(flags, 'standard-radius');
  const frozenCost = getFlag(flags, 'frozen-cost');
  const frozenRadius = getFlag(flags, 'frozen-radius');

  if (standardCost !== undefined || standardRadius !== undefined) {
    const zone = await prisma.deliveryZone.upsert({
      where: { tenantId_scope: { tenantId: tenant.id, scope: 'STANDARD' } },
      update: {
        ...(standardCost !== undefined ? { cost: parseInt(standardCost, 10) } : {}),
        ...(standardRadius !== undefined ? { radiusKm: parseFloat(standardRadius) } : {}),
      },
      create: {
        tenantId: tenant.id,
        branchId: branch.id,
        name: 'Estándar',
        type: 'radius',
        scope: 'STANDARD',
        cost: standardCost !== undefined ? parseInt(standardCost, 10) : 0,
        radiusKm: standardRadius !== undefined ? parseFloat(standardRadius) : null,
      },
    });
    console.log(`Zona STANDARD: $${zone.cost}, radio ${zone.radiusKm ?? 'sin límite'} km`);
  }

  if (frozenCost !== undefined || frozenRadius !== undefined) {
    const zone = await prisma.deliveryZone.upsert({
      where: { tenantId_scope: { tenantId: tenant.id, scope: 'FROZEN' } },
      update: {
        ...(frozenCost !== undefined ? { cost: parseInt(frozenCost, 10) } : {}),
        ...(frozenRadius !== undefined ? { radiusKm: parseFloat(frozenRadius) } : {}),
      },
      create: {
        tenantId: tenant.id,
        branchId: branch.id,
        name: 'Congelados',
        type: 'radius',
        scope: 'FROZEN',
        cost: frozenCost !== undefined ? parseInt(frozenCost, 10) : 0,
        radiusKm: frozenRadius !== undefined ? parseFloat(frozenRadius) : null,
      },
    });
    console.log(`Zona FROZEN: $${zone.cost}, radio ${zone.radiusKm ?? 'sin límite'} km`);
  }

  if (standardCost === undefined && standardRadius === undefined && frozenCost === undefined && frozenRadius === undefined) {
    console.log('Nada para actualizar — pasá al menos un flag.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
