import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';
import { encryptSecret } from '@/lib/crypto';

// Payment config screen — mirrors what scripts/set-payment-config.ts already
// does from the terminal, now reachable from Ajustes/Pagos y Envíos without
// needing SSH/CLI access. The MP token is never sent back to the client
// (write-only field) — only whether one is currently configured.
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const config = await prisma.paymentConfig.findUnique({ where: { tenantId: session.user.tenantId } });
  return NextResponse.json({
    ok: true,
    paymentAlias: config?.paymentAlias ?? '',
    paymentTitular: config?.paymentTitular ?? '',
    paymentCvu: config?.paymentCvu ?? '',
    mpEnabled: config?.mpEnabled ?? false,
    hasMpToken: !!config?.mpAccessTokenEncrypted,
  });
}

export async function PUT(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN'])) return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const mpToken = typeof body.mpAccessToken === 'string' && body.mpAccessToken.trim() ? body.mpAccessToken.trim() : undefined;

  await prisma.paymentConfig.upsert({
    where: { tenantId: session.user.tenantId },
    update: {
      paymentAlias: body.paymentAlias ?? undefined,
      paymentTitular: body.paymentTitular ?? undefined,
      paymentCvu: body.paymentCvu ?? undefined,
      ...(mpToken ? { mpAccessTokenEncrypted: encryptSecret(mpToken), mpEnabled: true } : {}),
    },
    create: {
      tenantId: session.user.tenantId,
      paymentAlias: body.paymentAlias ?? null,
      paymentTitular: body.paymentTitular ?? null,
      paymentCvu: body.paymentCvu ?? null,
      mpAccessTokenEncrypted: mpToken ? encryptSecret(mpToken) : null,
      mpEnabled: !!mpToken,
    },
  });

  return NextResponse.json({ ok: true });
}
