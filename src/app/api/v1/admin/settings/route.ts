import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';

// Thin GET/PUT over TenantSetting's flexible KV store (plan section 2) —
// no dedicated settings screen exists yet (backlog), but a couple of
// screens (Menú QR) need to read/write one or two keys.
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const keysParam = new URL(req.url).searchParams.get('keys');
  const keys = keysParam ? keysParam.split(',') : undefined;

  const settings = await prisma.tenantSetting.findMany({
    where: { tenantId: session.user.tenantId, ...(keys ? { key: { in: keys } } : {}) },
  });

  return NextResponse.json({ ok: true, settings: Object.fromEntries(settings.map((s) => [s.key, s.value])) });
}

export async function PUT(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN'])) return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const entries = Object.entries(body) as [string, string][];

  await Promise.all(
    entries.map(([key, value]) =>
      prisma.tenantSetting.upsert({
        where: { tenantId_key: { tenantId: session.user.tenantId, key } },
        update: { value },
        create: { tenantId: session.user.tenantId, key, value },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
