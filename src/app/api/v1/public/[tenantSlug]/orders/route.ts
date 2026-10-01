import { NextRequest, NextResponse } from 'next/server';
import { OrderChannel } from '@prisma/client';
import { resolveTenant, resolveDefaultBranch } from '@/lib/tenant';
import { verifyTenantApiKey } from '@/lib/api-auth';
import { createOrder, DuplicateOrderError, OrderPriceChangedError } from '@/lib/create-order';
import { OrderPricingError } from '@/lib/order-pricing';

// Port of PizzaZeka's POST /api/track/order (web checkout). Unlike the
// prototype, this recomputes the total server-side from product IDs and
// requires an Idempotency-Key header — see plan section 3/7.
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) {
    return NextResponse.json({ ok: false, error: 'Tenant no encontrado' }, { status: 404 });
  }

  const authorized = await verifyTenantApiKey(tenant.id, req.headers.get('authorization'));
  if (!authorized) {
    return NextResponse.json({ ok: false, error: 'API key inválida o ausente' }, { status: 401 });
  }

  const branch = await resolveDefaultBranch(tenant.id);
  if (!branch) {
    return NextResponse.json({ ok: false, error: 'Tenant sin sucursal configurada' }, { status: 500 });
  }

  const idempotencyKey = req.headers.get('idempotency-key');
  if (!idempotencyKey || idempotencyKey.length > 128) {
    return NextResponse.json({ ok: false, error: 'Header Idempotency-Key requerido' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json({ ok: false, error: 'Body inválido: se espera { items: [...] }' }, { status: 400 });
  }

  try {
    const order = await createOrder({
      tenantId: tenant.id,
      branchId: branch.id,
      channel: OrderChannel.WEB,
      items: body.items,
      customerName: body.customer_name,
      customerPhone: body.customer_phone,
      address: body.address,
      locality: body.locality,
      notes: body.notes,
      deliveryType: body.delivery_type,
      paymentMethod: body.payment_method,
      // Never supplied by the browser or the legacy web site — createOrder()
      // resolves the right DeliveryZone (STANDARD vs FROZEN) from the cart.
      expectedTotal: body.expected_total,
      idempotencyKey,
    });
    return NextResponse.json({ ok: true, order }, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateOrderError) {
      return NextResponse.json({ ok: true, orderId: err.existingOrderId, duplicate: true });
    }
    if (err instanceof OrderPricingError) {
      return NextResponse.json({ ok: false, error: err.message, code: err.code, productId: err.productId }, { status: 409 });
    }
    if (err instanceof OrderPriceChangedError) {
      return NextResponse.json({ ok: false, error: err.message, code: 'PRICE_CHANGED', currentTotal: err.currentTotal }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
