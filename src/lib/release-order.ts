import { prisma } from '@/lib/prisma';
import { emitOrderEvent } from '@/lib/socket';
import { dispatchOrderToFudo } from '@/lib/fudo';
import { OrderStatus } from '@prisma/client';

// Shared by two callers that both promote an order out of EN_ESPERA_PAGO:
// a human approving a comprobante in "Pagos por Revisar" (Fase 2d), and the
// Mercado Pago webhook confirming a digital payment (Fase 4) — same
// real-time path either way, same Fudo dispatch trigger point.
export async function releaseOrderToKitchen(
  orderId: string,
  tenantId: string,
  paymentStatus: string,
  changedByUserId?: string
) {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.NUEVO, paymentStatus, version: { increment: 1 } },
    include: { items: true },
  });

  await prisma.orderStatusEvent.create({
    data: {
      orderId,
      fromStatus: OrderStatus.EN_ESPERA_PAGO,
      toStatus: OrderStatus.NUEVO,
      changedByUserId: changedByUserId ?? null,
    },
  });

  emitOrderEvent(tenantId, 'order:new', order);
  dispatchOrderToFudo(order).catch(() => {
    // dispatchOrderToFudo already logs its own errors — never let a POS
    // sync hiccup block the order from reaching the kitchen.
  });

  return order;
}
