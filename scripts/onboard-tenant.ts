// Fase 5 — alta de un nuevo tenant sin tocar código: crea Tenant + Branch
// default + usuario ADMIN + categorías base + settings por defecto. Mismo
// patrón operativo que prisma/seed.ts y el resto de scripts/*.ts.
//
// Uso: npm run onboard:tenant -- <slug> "<Nombre del restaurante>" "<direccion>" [usuario-admin]
//
// El 4to argumento (usuario admin) es opcional y por defecto es "<slug>-admin"
// — `username` es único en TODA la base (no solo por tenant, ver src/lib/auth.ts),
// así el login no necesita preguntar a qué restaurante pertenecés. Un literal
// "admin" fijo acá chocaría con el admin de cualquier tenant que ya lo tenga.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = ['entradas', 'platos', 'postres', 'bebidas'];
const DEFAULT_SETTINGS: Record<string, string> = {
  discount_popup_enabled: '0',
  module_congelados: '0',
  module_almacen: '0',
  module_delivery: '1',
  module_salon: '0',
  kds_sound_enabled: '1',
};

async function main() {
  const [slug, name, address, adminUsername] = process.argv.slice(2);
  if (!slug || !name) {
    console.error('Uso: npm run onboard:tenant -- <slug> "<Nombre del restaurante>" "<direccion opcional>" [usuario-admin]');
    process.exit(1);
  }

  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) throw new Error(`Ya existe un tenant con slug "${slug}".`);

  const username = adminUsername || `${slug}-admin`;
  const usernameTaken = await prisma.user.findUnique({ where: { username } });
  if (usernameTaken) throw new Error(`El usuario "${username}" ya existe — pasá un 4to argumento con otro nombre.`);

  const tenant = await prisma.tenant.create({
    data: { slug, name, status: 'active' },
  });

  const branch = await prisma.branch.create({
    data: { tenantId: tenant.id, name: 'Sucursal Central', address: address || null, isDefault: true },
  });

  for (const [i, catName] of DEFAULT_CATEGORIES.entries()) {
    await prisma.category.create({
      data: { tenantId: tenant.id, name: catName, sortOrder: i },
    });
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.tenantSetting.create({ data: { tenantId: tenant.id, key, value } });
  }

  await prisma.deliveryZone.create({
    data: { tenantId: tenant.id, branchId: branch.id, name: 'Zona única', type: 'radius', radiusKm: 3, cost: 0 },
  });

  const devPassword = process.env.ONBOARD_ADMIN_PASSWORD ?? 'changeme123';
  const passwordHash = await bcrypt.hash(devPassword, 10);
  await prisma.user.create({
    data: { tenantId: tenant.id, branchId: branch.id, username, passwordHash, role: 'ADMIN' },
  });

  console.log(`Tenant "${slug}" (${name}) creado. Login: usuario "${username}", contraseña "${devPassword}".`);
  console.log(`Sucursal: ${branch.name}. Categorías base: ${DEFAULT_CATEGORIES.join(', ')}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
