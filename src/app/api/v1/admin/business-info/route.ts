import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';
import { resolveDefaultBranch } from '@/lib/tenant';

// "Datos del Local" — address + business hours. The delivery radius in
// Pagos y Envíos is measured FROM this address (informational for now: real
// geocoding/enforcement is Fase 2c, gated on a Google Geocoding API key —
// but the UI should already reflect what the tenant configures here instead
// of a hardcoded placeholder).
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const [branch, hoursSetting] = await Promise.all([
    resolveDefaultBranch(session.user.tenantId),
    prisma.tenantSetting.findUnique({ where: { tenantId_key: { tenantId: session.user.tenantId, key: 'business_hours' } } }),
  ]);

  return NextResponse.json({
    ok: true,
    address: branch?.address ?? '',
    lat: branch?.lat ?? null,
    lng: branch?.lng ?? null,
    businessHours: hoursSetting?.value ? JSON.parse(hoursSetting.value) : null,
  });
}

export async function PUT(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN'])) return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });

  const branch = await resolveDefaultBranch(session.user.tenantId);
  if (!branch) return NextResponse.json({ ok: false, error: 'Sin sucursal configurada' }, { status: 500 });

  const body = await req.json().catch(() => ({}));

  await Promise.all([
    prisma.branch.update({
      where: { id: branch.id },
      data: {
        address: typeof body.address === 'string' ? body.address : undefined,
        lat: typeof body.lat === 'number' ? body.lat : undefined,
        lng: typeof body.lng === 'number' ? body.lng : undefined,
      },
    }),
    body.businessHours
      ? prisma.tenantSetting.upsert({
          where: { tenantId_key: { tenantId: session.user.tenantId, key: 'business_hours' } },
          update: { value: JSON.stringify(body.businessHours) },
          create: { tenantId: session.user.tenantId, key: 'business_hours', value: JSON.stringify(body.businessHours) },
        })
      : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true });
}
