import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'pizzazeka' },
    update: {},
    create: {
      slug: 'pizzazeka',
      name: 'Pizza Zeka',
      timezone: 'America/Argentina/Buenos_Aires',
    },
  });

  const branch = await prisma.branch.upsert({
    where: { id: `${tenant.id}-default-branch` },
    update: {},
    create: {
      id: `${tenant.id}-default-branch`,
      tenantId: tenant.id,
      name: 'Sucursal Central',
      address: 'Salvador Soreda 6140, Wilde',
      isDefault: true,
    },
  });

  // Dev-only seed password — change immediately in any shared/staging environment.
  const devPassword = process.env.SEED_ADMIN_PASSWORD ?? 'changeme123';
  const passwordHash = await bcrypt.hash(devPassword, 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      username: 'admin',
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log(`Seeded tenant "${tenant.slug}" with admin user (password: ${devPassword}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
