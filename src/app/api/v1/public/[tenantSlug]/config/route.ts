import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveTenant } from '@/lib/tenant';
import { getPublicDeliveryZones, flattenDeliveryZone } from '@/lib/delivery-zones';

// Port of PizzaZeka's GET /api/config/public — same payload as /menu's
// `config` block, kept as its own endpoint for callers that only need
// business config (delivery cost, WhatsApp number, etc.) without the catalog.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) {
    return NextResponse.json({ ok: false, error: 'Tenant no encontrado' }, { status: 404 });
  }

  const [settings, deliveryZones, paymentConfig, branch] = await Promise.all([
    prisma.tenantSetting.findMany({ where: { tenantId: tenant.id } }),
    getPublicDeliveryZones(tenant.id),
    prisma.paymentConfig.findUnique({ where: { tenantId: tenant.id } }),
    prisma.branch.findFirst({ where: { tenantId: tenant.id, isDefault: true } }),
  ]);
  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  return NextResponse.json({
    ok: true,
    whatsapp_number: settingsMap.whatsapp_number ?? null,
    business_name: settingsMap.business_name ?? tenant.name,
    logo_url: tenant.logoUrl ?? null,
    address: branch?.address ?? null,
    business_hours: settingsMap.business_hours ? JSON.parse(settingsMap.business_hours) : null,
    // Per-scope zones (STANDARD vs FROZEN radius/cost) for storefronts that
    // show different coverage per product type; delivery_cost/radius_km below
    // stay for older callers that only know about one flat zone.
    delivery_zones: deliveryZones,
    ...flattenDeliveryZone(deliveryZones),
    payment_alias: paymentConfig?.paymentAlias ?? null,
    payment_titular: paymentConfig?.paymentTitular ?? null,
    payment_cvu: paymentConfig?.paymentCvu ?? null,
    mp_enabled: paymentConfig?.mpEnabled ?? false,
  });
}
