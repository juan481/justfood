import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';
import { encryptSecret } from '@/lib/crypto';

// Fudo POS config — kept out of the main Pagos y Envíos screen per Juan
// ("puede ir a configuración") since it's an advanced/optional integration
// most tenants won't touch; lives in Ajustes as its own smaller card.
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const config = await prisma.pOSIntegrationConfig.findUnique({ where: { tenantId: session.user.tenantId } });
  return NextResponse.json({
    ok: true,
    enabled: config?.enabled ?? false,
    businessId: config?.businessId ?? '',
    hasApiToken: !!config?.apiTokenEncrypted,
    lastSyncAt: config?.lastSyncAt ?? null,
    lastSyncStatus: config?.lastSyncStatus ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN'])) return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const apiToken = typeof body.apiToken === 'string' && body.apiToken.trim() ? body.apiToken.trim() : undefined;

  await prisma.pOSIntegrationConfig.upsert({
    where: { tenantId: session.user.tenantId },
    update: {
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      businessId: body.businessId ?? undefined,
      ...(apiToken ? { apiTokenEncrypted: encryptSecret(apiToken) } : {}),
    },
    create: {
      tenantId: session.user.tenantId,
      provider: 'fudo',
      enabled: body.enabled ?? false,
      businessId: body.businessId ?? null,
      apiTokenEncrypted: apiToken ? encryptSecret(apiToken) : null,
    },
  });

  return NextResponse.json({ ok: true });
}
