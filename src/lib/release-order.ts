import { prisma } from '@/lib/prisma';
import { emitOrderEvent } from '@/lib/socket';
import { dispatchOrderToFudo } from '@/lib/fudo';
import { OrderChannel, OrderStatus } from '@prisma/client';

// Shared by callers that all promote an order out of EN_ESPERA_PAGO: a human
// approving a comprobante in "Pagos por Revisar" (Fase 2d), the Mercado Pago
// webhook confirming a digital payment (Fase 4), and now a Salón table closed
// with MP/transferencia (Fase 2 Salón) — same real-time path either way.
export async function releaseOrderToKitchen(
  orderId: string,
  tenantId: string,
  paymentStatus: string,
  changedByUserId?: string,
  // Una mesa de Salón ya se consumió y se cerró — aprobar su comprobante no
  // tiene que mandarla "a cocina" de nuevo, va directo a ENTREGADO. Los
  // llamadores existentes (comprobante de WhatsApp) no pasan esto y siguen
  // yendo a NUEVO como siempre.
  targetStatus: OrderStatus = OrderStatus.NUEVO
) {
  // Both current callers already resolve orderId through a tenant-scoped
  // lookup before calling this, but `update` can't filter by tenantId
  // directly (id is the only unique key on Order) — this re-check keeps
  // the guarantee local to the function instead of relying on every future
  // caller remembering to pre-validate it themselves.
  const owned = await prisma.order.findFirst({ where: { id: orderId, tenantId } });
  if (!owned) throw new Error(`Pedido ${orderId} no pertenece al tenant ${tenantId}`);

  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status: targetStatus, paymentStatus, version: { increment: 1 } },
    include: { items: true },
  });

  await prisma.orderStatusEvent.create({
    data: {
      orderId,
      fromStatus: OrderStatus.EN_ESPERA_PAGO,
      toStatus: targetStatus,
      changedByUserId: changedByUserId ?? null,
    },
  });

  // Una mesa de Salón cerrada con MP/transferencia se queda en azul
  // (ESPERANDO_PAGO) hasta este momento — recién acá, con el comprobante ya
  // aprobado, se libera a verde. Ver table-session.ts closeTable().
  if (owned.tableId) {
    await prisma.table.updateMany({
      where: { id: owned.tableId, currentOrderId: orderId },
      data: { currentOrderId: null, status: 'LIBRE' },
    });
    emitOrderEvent(tenantId, 'table:state-changed', { id: owned.tableId, status: 'LIBRE', currentOrderId: null });
  }

  emitOrderEvent(tenantId, 'order:new', order);

  // Todo este módulo de Salón existe para reemplazar Fudo en las mesas —
  // nunca tiene sentido sincronizar un pedido de mesa hacia él.
  if (order.channel !== OrderChannel.DINE_IN) {
    dispatchOrderToFudo(order).catch(() => {
      // dispatchOrderToFudo already logs its own errors — never let a POS
      // sync hiccup block the order from reaching the kitchen.
    });
  }

  return order;
}
