import { prisma } from '@/lib/prisma';

export async function resolveTenant(tenantSlug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant || tenant.status !== 'active') return null;
  return tenant;
}

export async function resolveDefaultBranch(tenantId: string) {
  return prisma.branch.findFirst({ where: { tenantId, isDefault: true } });
}
