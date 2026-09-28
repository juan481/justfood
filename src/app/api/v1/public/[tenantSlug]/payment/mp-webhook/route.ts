import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveTenant } from '@/lib/tenant';
import { getPayment } from '@/lib/mercadopago';
import { releaseOrderToKitchen } from '@/lib/release-order';
import { OrderStatus } from '@prisma/client';

// The webhook the PizzaZeka prototype never had (plan section 8, Fase 4:
// "closing a loop the prototype never closed"). MP calls this on every
// payment event; we always re-fetch the payment from MP's API rather than
// trusting the webhook body itself (MP's own recommended pattern — webhook
// payloads are a "something changed, go check" ping, not a source of truth).
//
// No live MP account to test this against — the query-param parsing
// follows MP's documented webhook formats (both the older `topic`/`id` and
// newer `type`/`data.id` shapes), but verify against a real sandbox
// notification before relying on it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) return NextResponse.json({ ok: false, error: 'Tenant no encontrado' }, { status: 404 });

  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const topic = url.searchParams.get('topic') || body.type;
  const paymentId = url.searchParams.get('id') || body.data?.id;

  // MP also pings for non-payment topics (merchant_order, etc.) — ack and
  // ignore anything that isn't a payment event.
  if (topic !== 'payment' || !paymentId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const payment = await getPayment(tenant.id, paymentId);
    const order = await prisma.order.findFirst({
      where: { id: payment.external_reference, tenantId: tenant.id },
    });
    if (!order) return NextResponse.json({ ok: true, note: 'Pedido no encontrado para esta referencia' });

    if (payment.status === 'approved') {
      if (order.status === OrderStatus.EN_ESPERA_PAGO) {
        await releaseOrderToKitchen(order.id, tenant.id, 'pagado');
      }
    } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
      await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: payment.status } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[MP webhook]', err);
    // 200 anyway — MP retries aggressively on non-2xx, and a transient
    // error here shouldn't turn into a notification storm.
    return NextResponse.json({ ok: false, error: 'Error interno' });
  }
}
