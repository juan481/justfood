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
  deliveryFee?: number;
  idempotencyKey?: string;
  createdByUserId?: string;
}

export class DuplicateOrderError extends Error {
  constructor(public readonly existingOrderId: string) {
    super('Ya existe un pedido con esa idempotency key.');
  }
}

async function nextOrderCode(tenantId: string): Promise<string> {
  const count = await prisma.order.count({ where: { tenantId } });
  return `JF-${String(count + 1).padStart(5, '0')}`;
}

export async function createOrder(input: CreateOrderInput) {
  if (input.idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey } },
    });
    if (existing) throw new DuplicateOrderError(existing.id);
  }

  const { items, subtotal } = await priceCart(input.tenantId, input.items);
  const deliveryFee = Math.max(0, Math.round(input.deliveryFee ?? 0));
  const totalAmount = subtotal + deliveryFee;

  const initialStatus = GATED_PAYMENT_METHODS.has(input.paymentMethod ?? 'efectivo')
    ? OrderStatus.EN_ESPERA_PAGO
    : OrderStatus.NUEVO;

  const orderCode = await nextOrderCode(input.tenantId);

  const order = await prisma.$transaction(async (tx) => {
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
