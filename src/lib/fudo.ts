import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/crypto';
import type { Order, OrderItem } from '@prisma/client';

// Direct port of PizzaZeka's sendOrderToFudo() (server.js) — same endpoint,
// same fire-and-forget/timeout behavior, same "disabled by default, never
// blocks the order" contract. The only real change is reading the token
// from POSIntegrationConfig (encrypted) instead of a plaintext config row.
//
// NOT LIVE-TESTED: no real Fudo account/sandbox was available while
// building this — the request shape matches the prototype's working code
// exactly, but verify against a real Fudo API token before relying on it.
export async function dispatchOrderToFudo(order: Order & { items: OrderItem[] }) {
  try {
    const posConfig = await prisma.pOSIntegrationConfig.findUnique({ where: { tenantId: order.tenantId } });
    if (!posConfig?.enabled || !posConfig.apiTokenEncrypted) return;

    const token = decryptSecret(posConfig.apiTokenEncrypted);
    if (!token.trim()) return;

    const payload = {
      source: 'justfood',
      business_id: posConfig.businessId || '',
      customer: {
        name: order.customerName,
        phone: order.customerPhone,
        address: order.address,
        locality: order.locality,
      },
      delivery_type: order.deliveryType,
      payment_method: order.paymentMethod,
      notes: order.notes,
      total: order.totalAmount,
      items: order.items.map((i) => ({ name: i.productNameSnapshot, quantity: i.quantity, price: i.unitPriceSnapshot })),
    };

    console.log(`[FUDO] Despachando comanda ${order.orderCode}...`);
    const res = await fetch('https://api.fu.do/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.trim()}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });

    await prisma.pOSIntegrationConfig.update({
      where: { tenantId: order.tenantId },
      data: { lastSyncAt: new Date(), lastSyncStatus: res.ok ? 'ok' : `error_${res.status}` },
    });
  } catch (err) {
    console.warn('[FUDO] Aviso al despachar comanda:', err instanceof Error ? err.message : err);
    await prisma.pOSIntegrationConfig
      .update({ where: { tenantId: order.tenantId }, data: { lastSyncStatus: 'error_network' } })
      .catch(() => {});
  }
}
