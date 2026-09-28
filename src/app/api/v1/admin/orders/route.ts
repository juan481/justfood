import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { OrderChannel } from '@prisma/client';
import { requireSession, hasRole } from '@/lib/admin-session';
import { createOrder, DuplicateOrderError } from '@/lib/create-order';
import { OrderPricingError } from '@/lib/order-pricing';

// Mostrador quick-entry: staff types in what a walk-in or phone/WhatsApp
// customer ordered. Same shared createOrder() pricing/idempotency path as
// the public web checkout — one authoritative pricing code path for every
// channel (plan section 1).
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN', 'MOSTRADOR'])) {
    return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });
  }
  if (!session.user.branchId) {
    return NextResponse.json({ ok: false, error: 'Usuario sin sucursal asignada' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ ok: false, error: 'Body inválido: se espera { items: [...] }' }, { status: 400 });
  }

  const channel: OrderChannel = body.channel === 'WHATSAPP' ? OrderChannel.WHATSAPP : OrderChannel.MOSTRADOR;

  try {
    const order = await createOrder({
      tenantId: session.user.tenantId,
      branchId: session.user.branchId,
      channel,
      items: body.items,
      customerName: body.customer_name,
      customerPhone: body.customer_phone,
      address: body.address,
      locality: body.locality,
      notes: body.notes,
      deliveryType: body.delivery_type ?? 'mostrador',
      paymentMethod: body.payment_method,
      paymentStatus: body.payment_status,
      deliveryFee: body.delivery_fee,
      idempotencyKey: body.idempotency_key ?? randomUUID(),
      createdByUserId: session.user.id,
    });
    return NextResponse.json({ ok: true, order }, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateOrderError) {
      return NextResponse.json({ ok: true, orderId: err.existingOrderId, duplicate: true });
    }
    if (err instanceof OrderPricingError) {
      return NextResponse.json({ ok: false, error: err.message, code: err.code, productId: err.productId }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
