import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveTenant } from '@/lib/tenant';
import { verifyTenantApiKey } from '@/lib/api-auth';
import { createPreference, MercadoPagoNotConfiguredError } from '@/lib/mercadopago';

// Called by the tenant's checkout right after POST .../orders returns an
// order with payment_method=mercadopago (which now starts in
// EN_ESPERA_PAGO — see create-order.ts). The client redirects the customer
// to the returned init_point; MP confirms via the webhook route, not via
// this response, so this endpoint never marks anything as paid itself.
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) return NextResponse.json({ ok: false, error: 'Tenant no encontrado' }, { status: 404 });

  const authorized = await verifyTenantApiKey(tenant.id, req.headers.get('authorization'));
  if (!authorized) return NextResponse.json({ ok: false, error: 'API key inválida o ausente' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.orderId) {
    return NextResponse.json({ ok: false, error: 'orderId requerido' }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id: body.orderId, tenantId: tenant.id },
    include: { items: true },
  });
  if (!order) return NextResponse.json({ ok: false, error: 'Pedido no encontrado' }, { status: 404 });

  const origin = req.headers.get('origin') || new URL(req.url).origin;
  const notificationUrl = `${new URL(req.url).origin}/api/v1/public/${tenantSlug}/payment/mp-webhook`;

  try {
    const { initPoint, preferenceId } = await createPreference(
      tenant.id,
      order,
      {
        success: `${origin}/pago-exitoso?order=${order.orderCode}`,
        pending: `${origin}/pago-pendiente?order=${order.orderCode}`,
        failure: `${origin}/pago-fallido?order=${order.orderCode}`,
      },
      notificationUrl
    );
    return NextResponse.json({ ok: true, initPoint, preferenceId });
  } catch (err) {
    if (err instanceof MercadoPagoNotConfiguredError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ ok: false, error: 'Error creando la preferencia de pago' }, { status: 502 });
  }
}
