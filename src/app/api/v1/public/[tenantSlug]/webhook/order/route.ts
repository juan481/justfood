import { NextRequest, NextResponse } from 'next/server';
import { OrderChannel } from '@prisma/client';
import { resolveTenant, resolveDefaultBranch } from '@/lib/tenant';
import { verifyTenantApiKey } from '@/lib/api-auth';
import { createOrder, DuplicateOrderError, OrderPriceChangedError } from '@/lib/create-order';
import { OrderPricingError } from '@/lib/order-pricing';

// Evolution of PizzaZeka's POST /api/webhook/order — that endpoint had zero
// auth in the prototype (fine for a single-tenant local app, not for a
// public multi-tenant one). Reserved for external automation (the WhatsApp
// bot from Fase 2b+); nothing calls this yet in Fase 1, but the contract
// exists now so that integration has a stable target.
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
      channel: body.channel === 'whatsapp' ? OrderChannel.WHATSAPP : OrderChannel.WEB,
      items: body.items,
      customerName: body.customer_name,
      customerPhone: body.customer_phone,
      address: body.address,
      locality: body.locality,
      notes: body.notes,
      deliveryType: body.delivery_type,
      paymentMethod: body.payment_method,
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
