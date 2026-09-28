import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

// Write endpoints on the public API (POST /orders, /webhook/order, etc.)
// require a per-tenant API key — read endpoints (menu/config) stay
// key-free since a public menu needs to be publicly fetchable (plan
// section 3). Keys are stored hashed, never in plaintext.

function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export async function generateTenantApiKey(tenantId: string, label: string) {
  const rawKey = `jf_${randomBytes(24).toString('hex')}`;
  await prisma.tenantApiKey.create({
    data: { tenantId, keyHash: hashKey(rawKey), label },
  });
  // Only ever returned once, at generation time — the DB only ever holds the hash.
  return rawKey;
}

export async function verifyTenantApiKey(tenantId: string, authHeader: string | null): Promise<boolean> {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) return false;

  const match = await prisma.tenantApiKey.findFirst({
    where: { tenantId, keyHash: hashKey(rawKey), revokedAt: null },
  });
  if (!match) return false;

  await prisma.tenantApiKey.update({ where: { id: match.id }, data: { lastUsedAt: new Date() } });
  return true;
}
