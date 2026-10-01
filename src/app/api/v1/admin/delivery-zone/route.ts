import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';
import { resolveDefaultBranch } from '@/lib/tenant';
import { DeliveryZoneScope } from '@prisma/client';

const EDITABLE_SCOPES: DeliveryZoneScope[] = ['STANDARD', 'FROZEN'];

// Up to one zone per scope per tenant (STANDARD covers pizzas/bebidas/etc.,
// FROZEN covers Product.isFrozen — see resolveDeliveryFee in create-order.ts).
// A tenant that never configured a zone for a scope just has it missing from
// the array; the order-pricing fallback uses ALL (or $0) in that case.
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const zones = await prisma.deliveryZone.findMany({ where: { tenantId: session.user.tenantId, isActive: true } });
  const byScope = Object.fromEntries(zones.map((z) => [z.scope, { cost: z.cost, radiusKm: z.radiusKm }]));
  return NextResponse.json({ ok: true, zones: byScope });
}

export async function PUT(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN'])) return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const zonesInput = body.zones;
  if (!zonesInput || typeof zonesInput !== 'object') {
    return NextResponse.json({ ok: false, error: 'Body inválido: se espera { zones: { STANDARD: {...}, FROZEN: {...} } }' }, { status: 400 });
  }

  const branch = await resolveDefaultBranch(session.user.tenantId);
  if (!branch) return NextResponse.json({ ok: false, error: 'Sin sucursal configurada' }, { status: 500 });

  const results: Record<string, { cost: number; radiusKm: number | null }> = {};

  for (const scope of EDITABLE_SCOPES) {
    const entry = zonesInput[scope];
    if (!entry) continue;

    const cost = Number(entry.cost);
    if (!Number.isFinite(cost) || cost < 0) {
      return NextResponse.json({ ok: false, error: `cost inválido para ${scope}` }, { status: 400 });
    }
    // `entry.radiusKm ?? undefined` would silently no-op on an explicit
    // `null` (clearing the field) — `??` treats null and undefined the same.
    const radiusKm = entry.radiusKm === undefined ? undefined : entry.radiusKm;

    const zone = await prisma.deliveryZone.upsert({
      where: { tenantId_scope: { tenantId: session.user.tenantId, scope } },
      update: { cost: Math.round(cost), radiusKm },
      create: {
        tenantId: session.user.tenantId,
        branchId: branch.id,
        name: scope === 'FROZEN' ? 'Congelados' : 'Estándar',
        type: 'radius',
        scope,
        cost: Math.round(cost),
        radiusKm: entry.radiusKm ?? null,
      },
    });
    results[scope] = { cost: zone.cost, radiusKm: zone.radiusKm };
  }

  return NextResponse.json({ ok: true, zones: results });
}
