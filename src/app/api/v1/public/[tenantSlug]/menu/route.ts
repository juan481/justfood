import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveTenant } from '@/lib/tenant';

// Direct port of PizzaZeka's GET /api/menu — read endpoint, no API key
// required (a public menu has to be publicly fetchable), short-cacheable.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) {
    return NextResponse.json({ ok: false, error: 'Tenant no encontrado' }, { status: 404 });
  }

  const [categories, products, settings, deliveryZone, paymentConfig, branch] = await Promise.all([
    prisma.category.findMany({ where: { tenantId: tenant.id, isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.product.findMany({ where: { tenantId: tenant.id, isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.tenantSetting.findMany({ where: { tenantId: tenant.id } }),
    prisma.deliveryZone.findFirst({ where: { tenantId: tenant.id, isActive: true } }),
    prisma.paymentConfig.findUnique({ where: { tenantId: tenant.id } }),
    prisma.branch.findFirst({ where: { tenantId: tenant.id, isDefault: true } }),
  ]);

  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  return NextResponse.json({
    ok: true,
    categories,
    products,
    config: {
      whatsapp_number: settingsMap.whatsapp_number ?? null,
      business_name: settingsMap.business_name ?? tenant.name,
      business_type: settingsMap.business_type ?? null,
      address: branch?.address ?? null,
      business_hours: settingsMap.business_hours ? JSON.parse(settingsMap.business_hours) : null,
      delivery_cost: deliveryZone?.cost ?? null,
      delivery_radius_km: deliveryZone?.radiusKm ?? null,
      // El checkout de la web del cliente necesita esto para mostrarle el
      // alias/CVU al que transferir — sin esto, el cliente no tiene forma
      // de saber a dónde pagar.
      payment_alias: paymentConfig?.paymentAlias ?? null,
      payment_titular: paymentConfig?.paymentTitular ?? null,
      payment_cvu: paymentConfig?.paymentCvu ?? null,
      mp_enabled: paymentConfig?.mpEnabled ?? false,
      discount_popup_enabled: settingsMap.discount_popup_enabled === '1',
      discount_code: settingsMap.discount_code ?? null,
      discount_percent: settingsMap.discount_percent ? Number(settingsMap.discount_percent) : null,
      module_congelados: settingsMap.module_congelados !== '0',
      module_almacen: settingsMap.module_almacen !== '0',
      module_delivery: settingsMap.module_delivery !== '0',
      module_salon: settingsMap.module_salon !== '0',
    },
  });
}
