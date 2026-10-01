import { prisma } from '@/lib/prisma';
import { emitOrderEvent } from '@/lib/socket';
import { priceCart, type CartItemInput } from '@/lib/order-pricing';
import { dispatchOrderToFudo } from '@/lib/fudo';
import { OrderChannel, OrderStatus } from '@prisma/client';

// Payment methods that need external confirmation before a kitchen ever
// sees the order: a bank transfer needs a human to check the comprobante
// (Fase 2d), a Mercado Pago order needs MP's webhook to confirm the charge
// actually went through (Fase 4) — cash and any other method are trusted
// immediately, same as the PizzaZeka prototype's behavior.
const GATED_PAYMENT_METHODS = new Set(['transferencia', 'mercadopago']);

export interface CreateOrderInput {
  tenantId: string;
  branchId: string;
  channel: OrderChannel;
  items: CartItemInput[];
  customerName?: string;
  customerPhone?: string;
  address?: string;
  locality?: string;
  notes?: string;
  deliveryType?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  // Mostrador/WhatsApp manual (Fase 2a) pass this explicitly — staff eyeballs
  // the distance themselves. Web checkout omits it and lets resolveDeliveryFee
  // below pick the right DeliveryZone from the cart's product mix.
  deliveryFee?: number;
  // Quote displayed to the customer immediately before checkout. It is never
  // used as the actual total: it only lets us reject a stale menu price.
  expectedTotal?: number;
  idempotencyKey?: string;
  createdByUserId?: string;
}

export class DuplicateOrderError extends Error {
  constructor(public readonly existingOrderId: string) {
    super('Ya existe un pedido con esa idempotency key.');
  }
}

export class OrderPriceChangedError extends Error {
  constructor(public readonly currentTotal: number) {
    super('El precio del pedido cambió. Actualizá el carrito antes de confirmar.');
  }
}

// Picks the delivery cost for a web/WhatsApp order from the cart's product
// mix: a STANDARD item (not Product.isFrozen — pizzas, bebidas, etc.) needs
// the tighter zone since it's what actually constrains how far the order can
// travel; FROZEN-only carts use the wider zone. `ALL` is the fallback for any
// tenant that never split its delivery zones by scope. Logs every branch so a
// misconfigured tenant (no zone at all) shows up in the server log instead of
// silently shipping a $0 delivery fee.
async function resolveDeliveryFee(
  tenantId: string,
  branchId: string,
  hasStandardItem: boolean,
  hasFrozenItem: boolean
): Promise<number> {
  const zones = await prisma.deliveryZone.findMany({
    where: { tenantId, branchId, isActive: true },
  });
  const zoneByScope = new Map(zones.map((z) => [z.scope, z]));
  const pick = (scope: 'STANDARD' | 'FROZEN') => zoneByScope.get(scope) ?? zoneByScope.get('ALL') ?? null;

  // A mixed cart (pizza + congelado) ships in a single delivery, so the
  // tighter STANDARD zone governs the cost — the frozen item just rides along.
  const zone = hasStandardItem ? pick('STANDARD') : hasFrozenItem ? pick('FROZEN') : null;
  if (!zone) {
    console.warn(`[delivery-zone] Tenant ${tenantId}/branch ${branchId} has no active DeliveryZone for this cart (standard=${hasStandardItem}, frozen=${hasFrozenItem}) — charging $0 delivery.`);
    return 0;
  }
  return zone.cost;
}

export async function createOrder(input: CreateOrderInput) {
  if (input.idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey } },
    });
    if (existing) throw new DuplicateOrderError(existing.id);
  }

  const { items, subtotal, hasStandardItem, hasFrozenItem } = await priceCart(input.tenantId, input.items);
  const isDelivery = (input.deliveryType ?? 'delivery') === 'delivery';
  const resolvedDeliveryFee = input.deliveryFee !== undefined
    ? input.deliveryFee
    : isDelivery
      ? await resolveDeliveryFee(input.tenantId, input.branchId, hasStandardItem, hasFrozenItem)
      : 0;
  const deliveryFee = Math.max(0, Math.round(resolvedDeliveryFee));
  const totalAmount = subtotal + deliveryFee;

  if (input.expectedTotal !== undefined) {
    if (!Number.isSafeInteger(input.expectedTotal) || input.expectedTotal < 0 || input.expectedTotal !== totalAmount) {
      throw new OrderPriceChangedError(totalAmount);
    }
  }

  const initialStatus = GATED_PAYMENT_METHODS.has(input.paymentMethod ?? 'efectivo')
    ? OrderStatus.EN_ESPERA_PAGO
    : OrderStatus.NUEVO;

  const order = await prisma.$transaction(async (tx) => {
    // `orderSeq` increment is a single row-locked UPDATE — two orders
    // created in the same instant (web + mostrador + WhatsApp can all fire
    // concurrently) still serialize on this row and get distinct codes,
    // unlike a separate COUNT(*) read which both could see identically.
    const tenant = await tx.tenant.update({
      where: { id: input.tenantId },
      data: { orderSeq: { increment: 1 } },
    });
    const orderCode = `JF-${String(tenant.orderSeq).padStart(5, '0')}`;

    const created = await tx.order.create({
      data: {
        tenantId: input.tenantId,
        branchId: input.branchId,
        orderCode,
        channel: input.channel,
        status: initialStatus,
        deliveryType: input.deliveryType ?? 'delivery',
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        address: input.address,
        locality: input.locality,
        notes: input.notes,
        paymentMethod: input.paymentMethod ?? 'efectivo',
        paymentStatus: input.paymentStatus ?? (input.paymentMethod === 'efectivo' ? 'contra_entrega' : 'por_verificar'),
        totalAmount,
        deliveryFee,
        idempotencyKey: input.idempotencyKey,
        createdByUserId: input.createdByUserId,
        items: { create: items },
      },
      include: { items: true },
    });

    await tx.orderStatusEvent.create({
      data: { orderId: created.id, fromStatus: null, toStatus: initialStatus, changedByUserId: input.createdByUserId },
    });

    return created;
  });

  // Orders waiting on payment confirmation don't hit the KDS feed at all —
  // the "Pagos por Revisar" queue (Fase 2d) or the MP webhook (Fase 4) is
  // what eventually releases those via releaseOrderToKitchen().
  if (order.status !== OrderStatus.EN_ESPERA_PAGO) {
    emitOrderEvent(input.tenantId, 'order:new', order);
    dispatchOrderToFudo(order).catch(() => {});
  }

  return order;
}
