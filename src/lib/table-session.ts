import { prisma } from '@/lib/prisma';
import { emitOrderEvent } from '@/lib/socket';
import { priceCart, OrderPricingError, type CartItemInput } from '@/lib/order-pricing';
import { nextOrderCode } from '@/lib/create-order';
import { OrderChannel, OrderStatus, TableStatus } from '@prisma/client';

// Ciclo de vida completo de una mesa de Salón (Fase 2). Todo lo que toca
// precio pasa por priceCart() (mismo camino que web/mostrador/whatsapp) —
// nunca un cálculo de precio paralelo. Pagos en efectivo/débito/crédito se
// confían de inmediato (mismo criterio que GATED_PAYMENT_METHODS en
// create-order.ts); Mercado Pago/transferencia dejan la mesa en azul
// (ESPERANDO_PAGO) hasta que un operador aprueba el comprobante en /pagos
// — ver releaseOrderToKitchen() en release-order.ts, que es quien la libera.

export class TableSessionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'TABLE_NOT_FOUND'
      | 'TABLE_NOT_FREE'
      | 'TABLE_NOT_OPEN'
      | 'TABLE_NOT_REOPENABLE'
      | 'TABLE_LOCKED_PENDING_PAYMENT'
      | 'WAITER_NOT_FOUND'
      | 'TARGET_TABLE_NOT_FREE'
      | 'NO_CURRENT_ORDER'
  ) {
    super(message);
  }
}

const GATED_PAYMENT_METHODS = new Set(['mercadopago', 'transferencia']);

async function requireTable(tenantId: string, tableId: string) {
  const table = await prisma.table.findFirst({ where: { id: tableId, tenantId } });
  if (!table) throw new TableSessionError('Mesa no encontrada.', 'TABLE_NOT_FOUND');
  return table;
}

function nowAR(): string {
  return new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' });
}

export interface OpenTableInput {
  guestCount: number;
  waiterUserId: string;
  customerName?: string;
  notes?: string;
  createdByUserId?: string;
}

export async function openTable(tenantId: string, tableId: string, input: OpenTableInput) {
  const table = await requireTable(tenantId, tableId);
  if (table.status !== TableStatus.LIBRE) {
    throw new TableSessionError('La mesa no está libre.', 'TABLE_NOT_FREE');
  }
  const waiter = await prisma.user.findFirst({ where: { id: input.waiterUserId, tenantId, isActive: true } });
  if (!waiter) throw new TableSessionError('Mozo no encontrado.', 'WAITER_NOT_FOUND');

  const { order, updatedTable } = await prisma.$transaction(async (tx) => {
    const orderCode = await nextOrderCode(tx, tenantId);
    const order = await tx.order.create({
      data: {
        tenantId,
        branchId: table.branchId,
        orderCode,
        channel: OrderChannel.DINE_IN,
        status: OrderStatus.NUEVO,
        deliveryType: 'salon',
        customerName: input.customerName ?? null,
        notes: input.notes ?? null,
        paymentMethod: 'efectivo',
        paymentStatus: 'pendiente',
        totalAmount: 0,
        tableId,
        guestCount: input.guestCount,
        waiterUserId: input.waiterUserId,
        waiterName: waiter.username,
        createdByUserId: input.createdByUserId,
      },
      include: { items: true },
    });
    await tx.orderStatusEvent.create({
      data: { orderId: order.id, fromStatus: null, toStatus: OrderStatus.NUEVO, changedByUserId: input.createdByUserId ?? null },
    });
    const updatedTable = await tx.table.update({
      where: { id: tableId },
      data: { status: TableStatus.OCUPADA, currentOrderId: order.id },
    });
    return { order, updatedTable };
  });

  emitOrderEvent(tenantId, 'table:state-changed', updatedTable);
  return { order, table: updatedTable };
}

export async function addItemsToTable(tenantId: string, tableId: string, items: CartItemInput[]) {
  const table = await requireTable(tenantId, tableId);
  if (table.status !== TableStatus.OCUPADA || !table.currentOrderId) {
    throw new TableSessionError(
      'La mesa no tiene un pedido activo para sumarle ítems — si está en pre-cuenta, reabrila primero.',
      'TABLE_NOT_OPEN'
    );
  }

  const { items: pricedItems, subtotal } = await priceCart(tenantId, items);

  const { order, createdItems } = await prisma.$transaction(async (tx) => {
    const createdItems = await tx.orderItem.createManyAndReturn({
      data: pricedItems.map((item) => ({ ...item, orderId: table.currentOrderId! })),
    });
    const order = await tx.order.update({
      where: { id: table.currentOrderId! },
      data: { totalAmount: { increment: subtotal } },
      include: { items: true },
    });
    return { order, createdItems };
  });

  emitOrderEvent(tenantId, 'order:new', order);

  // Agrupados por estación para que el caller (la ruta de la API) sepa qué
  // ventanas de ticket abrir — ver kds/print/[id]?station=.
  const newItemsByStation = new Map<string, typeof createdItems>();
  for (const item of createdItems) {
    const key = item.prepAreaSnapshot ?? 'COCINA';
    if (!newItemsByStation.has(key)) newItemsByStation.set(key, []);
    newItemsByStation.get(key)!.push(item);
  }

  return { order, newItemsByStation: Object.fromEntries(newItemsByStation) };
}

export async function preBillTable(tenantId: string, tableId: string) {
  const table = await requireTable(tenantId, tableId);
  if (table.status !== TableStatus.OCUPADA) {
    throw new TableSessionError('Solo se puede pasar a pre-cuenta una mesa ocupada.', 'TABLE_NOT_OPEN');
  }
  const updated = await prisma.table.update({ where: { id: tableId }, data: { status: TableStatus.ESPERANDO_PAGO } });
  emitOrderEvent(tenantId, 'table:state-changed', updated);
  return updated;
}

export async function reopenTable(tenantId: string, tableId: string) {
  const table = await requireTable(tenantId, tableId);
  if (table.status !== TableStatus.ESPERANDO_PAGO || !table.currentOrderId) {
    throw new TableSessionError('Esta mesa no está en pre-cuenta.', 'TABLE_NOT_REOPENABLE');
  }
  const order = await prisma.order.findUnique({ where: { id: table.currentOrderId } });
  // Si el pedido ya está EN_ESPERA_PAGO es porque la mesa se cerró con
  // Mercado Pago/transferencia y está esperando que se apruebe el
  // comprobante — no es una pre-cuenta reversible, es un cierre pendiente
  // de verificación. Reabrirla no tiene sentido de negocio acá.
  if (order?.status === OrderStatus.EN_ESPERA_PAGO) {
    throw new TableSessionError(
      'Esta mesa está cerrada, esperando que se verifique el pago — no se puede reabrir.',
      'TABLE_LOCKED_PENDING_PAYMENT'
    );
  }
  const updated = await prisma.table.update({ where: { id: tableId }, data: { status: TableStatus.OCUPADA } });
  emitOrderEvent(tenantId, 'table:state-changed', updated);
  return updated;
}

export async function moveTable(tenantId: string, sourceTableId: string, targetTableId: string) {
  const [source, target] = await Promise.all([
    requireTable(tenantId, sourceTableId),
    requireTable(tenantId, targetTableId),
  ]);
  if (source.status === TableStatus.LIBRE || !source.currentOrderId) {
    throw new TableSessionError('La mesa de origen no tiene un pedido para mover.', 'NO_CURRENT_ORDER');
  }
  if (target.status !== TableStatus.LIBRE) {
    throw new TableSessionError('La mesa de destino no está libre.', 'TARGET_TABLE_NOT_FREE');
  }

  const breadcrumb = `Trasladado de Mesa ${source.number} a Mesa ${target.number}, ${nowAR()}`;

  const [updatedSource, updatedTarget] = await prisma.$transaction([
    prisma.table.update({ where: { id: sourceTableId }, data: { currentOrderId: null, status: TableStatus.LIBRE } }),
    prisma.table.update({ where: { id: targetTableId }, data: { currentOrderId: source.currentOrderId, status: source.status } }),
    prisma.order.update({
      where: { id: source.currentOrderId },
      data: { tableId: targetTableId, notes: breadcrumb },
    }),
  ]);

  emitOrderEvent(tenantId, 'table:state-changed', updatedSource);
  emitOrderEvent(tenantId, 'table:state-changed', updatedTarget);
  return { source: updatedSource, target: updatedTarget };
}

export async function closeTable(tenantId: string, tableId: string, paymentMethod: string) {
  const table = await requireTable(tenantId, tableId);
  if (table.status === TableStatus.LIBRE || !table.currentOrderId) {
    throw new TableSessionError('La mesa no tiene un pedido para cerrar.', 'NO_CURRENT_ORDER');
  }

  const orderId = table.currentOrderId;
  const isGated = GATED_PAYMENT_METHODS.has(paymentMethod);

  if (isGated) {
    // Se queda en azul — la libera releaseOrderToKitchen() cuando se
    // aprueba el comprobante en /pagos, no acá.
    const [order, updatedTable] = await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.EN_ESPERA_PAGO, paymentMethod, paymentStatus: 'por_verificar', version: { increment: 1 } },
        include: { items: true },
      }),
      prisma.table.update({ where: { id: tableId }, data: { status: TableStatus.ESPERANDO_PAGO } }),
      prisma.orderStatusEvent.create({
        data: { orderId, fromStatus: OrderStatus.NUEVO, toStatus: OrderStatus.EN_ESPERA_PAGO },
      }),
    ]);
    emitOrderEvent(tenantId, 'table:state-changed', updatedTable);
    emitOrderEvent(tenantId, 'order:status-changed', order);
    return { order, table: updatedTable, pendingVerification: true };
  }

  const [order, updatedTable] = await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.ENTREGADO, paymentMethod, paymentStatus: 'pagado', version: { increment: 1 } },
      include: { items: true },
    }),
    prisma.table.update({ where: { id: tableId }, data: { status: TableStatus.LIBRE, currentOrderId: null } }),
    prisma.orderStatusEvent.create({
      data: { orderId, fromStatus: OrderStatus.NUEVO, toStatus: OrderStatus.ENTREGADO },
    }),
  ]);

  emitOrderEvent(tenantId, 'table:state-changed', updatedTable);
  emitOrderEvent(tenantId, 'order:status-changed', order);
  return { order, table: updatedTable, pendingVerification: false };
}

export { OrderPricingError };
