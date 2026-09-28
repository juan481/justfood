// Usage: npm run generate:api-key -- <tenantSlug> "<label>"
import { PrismaClient } from '@prisma/client';
import { generateTenantApiKey } from '../src/lib/api-auth';

const prisma = new PrismaClient();

async function main() {
  const [tenantSlug, label] = process.argv.slice(2);
  if (!tenantSlug) {
    console.error('Uso: npm run generate:api-key -- <tenantSlug> "<label>"');
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant "${tenantSlug}" no existe.`);

  const rawKey = await generateTenantApiKey(tenant.id, label || 'sitio web');
  console.log(`API key generada para "${tenantSlug}" (guardala ahora, no se puede volver a ver):`);
  console.log(rawKey);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
