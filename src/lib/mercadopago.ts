import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/crypto';
import type { Order, OrderItem } from '@prisma/client';

// Mercado Pago Checkout Pro — createPreference() ports the shape PizzaZeka's
// prototype already used (POST /api/payment/create-preference), reading the
// token from PaymentConfig (encrypted) instead of the plaintext config row.
// getPayment() is NEW: the prototype created preferences but never verified
// what MP actually did with them — this is the missing webhook-confirmation
// half of the loop (plan section 8, Fase 4).
//
// NOT LIVE-TESTED: no real/sandbox MP access token was available while
// building this — the request/response shapes follow MP's public Checkout
// Pro + Payments API docs, but verify against a real (even sandbox) token
// before trusting it with real money.

export class MercadoPagoNotConfiguredError extends Error {
  constructor() {
    super('Mercado Pago no está configurado para este tenant.');
  }
}

async function getAccessToken(tenantId: string): Promise<string> {
  const config = await prisma.paymentConfig.findUnique({ where: { tenantId } });
  if (!config?.mpEnabled || !config.mpAccessTokenEncrypted) throw new MercadoPagoNotConfiguredError();
  return decryptSecret(config.mpAccessTokenEncrypted);
}

export async function createPreference(
  tenantId: string,
  order: Order & { items: OrderItem[] },
  backUrls: { success: string; pending: string; failure: string },
  notificationUrl: string
) {
  const accessToken = await getAccessToken(tenantId);

  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      items: order.items.map((i) => ({
        title: i.productNameSnapshot,
        quantity: i.quantity,
        unit_price: i.unitPriceSnapshot,
        currency_id: 'ARS',
      })),
      external_reference: order.id,
      back_urls: backUrls,
      auto_return: 'approved',
      notification_url: notificationUrl,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Mercado Pago rechazó la preferencia (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { id: string; init_point: string };
  return { preferenceId: data.id, initPoint: data.init_point };
}

export async function getPayment(tenantId: string, paymentId: string) {
  const accessToken = await getAccessToken(tenantId);

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`No se pudo consultar el pago ${paymentId} (${res.status})`);

  return (await res.json()) as { status: string; external_reference: string; transaction_amount: number };
}
