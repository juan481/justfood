import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';
import { resolveDefaultBranch } from '@/lib/tenant';

// Single flat delivery zone per tenant (plan section 7: "PizzaZeka starts
// with one flat-radius zone matching its current config"). Used by the
// NewOrderModal to prefill the delivery cost instead of defaulting to 0.
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const zone = await prisma.deliveryZone.findFirst({ where: { tenantId: session.user.tenantId, isActive: true } });
  return NextResponse.json({ ok: true, cost: zone?.cost ?? 0, radiusKm: zone?.radiusKm ?? null });
}

export async function PUT(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN'])) return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const cost = Number(body.cost);
  if (!Number.isFinite(cost) || cost < 0) {
    return NextResponse.json({ ok: false, error: 'cost inválido' }, { status: 400 });
  }

  // `body.radiusKm ?? undefined` would silently no-op on an explicit `null`
  // (clearing the field) — `??` treats null and undefined the same, so a
  // staff member clearing the radius input never actually persisted it.
  const radiusKm = body.radiusKm === undefined ? undefined : body.radiusKm;

  const existing = await prisma.deliveryZone.findFirst({ where: { tenantId: session.user.tenantId, isActive: true } });
  if (existing) {
    const zone = await prisma.deliveryZone.update({
      where: { id: existing.id },
      data: { cost: Math.round(cost), radiusKm },
    });
    return NextResponse.json({ ok: true, cost: zone.cost, radiusKm: zone.radiusKm });
  }

  const branch = await resolveDefaultBranch(session.user.tenantId);
  if (!branch) return NextResponse.json({ ok: false, error: 'Sin sucursal configurada' }, { status: 500 });
  const zone = await prisma.deliveryZone.create({
    data: { tenantId: session.user.tenantId, branchId: branch.id, name: 'Zona única', type: 'radius', cost: Math.round(cost), radiusKm: body.radiusKm ?? null },
  });
  return NextResponse.json({ ok: true, cost: zone.cost, radiusKm: zone.radiusKm });
}
