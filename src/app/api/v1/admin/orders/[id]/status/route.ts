import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';
import { emitOrderEvent } from '@/lib/socket';
import { OrderStatus } from '@prisma/client';

// Port of PizzaZeka's PATCH /api/admin/orders/:id/status. Adds the
// optimistic-concurrency guard the prototype didn't have (plan section 7):
// requires the client's last-known `version`, rejects with 409 on a stale
// write instead of silently overwriting a status set by another station.
// Forward transitions plus the "volver un paso atrás" Juan asked for —
// staff can undo a wrong tap without cancelling the whole order. Terminal
// states (ENTREGADO/CANCELADO) still can't be walked back from here; use
// Historial/refund flows for those instead of a status flip.
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  EN_ESPERA_PAGO: [OrderStatus.NUEVO, OrderStatus.CANCELADO],
  NUEVO: [OrderStatus.COCINA, OrderStatus.CANCELADO],
  COCINA: [OrderStatus.REPARTO, OrderStatus.NUEVO, OrderStatus.CANCELADO],
  REPARTO: [OrderStatus.ENTREGADO, OrderStatus.COCINA, OrderStatus.CANCELADO],
  ENTREGADO: [OrderStatus.REPARTO],
  CANCELADO: [],
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN', 'COCINA', 'CADETE', 'MOSTRADOR'])) {
    return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const toStatus = body.status as OrderStatus;
  const expectedVersion = body.version as number | undefined;
  const courierId = typeof body.courierId === 'string' ? body.courierId : undefined;

  if (!toStatus || !(toStatus in VALID_TRANSITIONS)) {
    return NextResponse.json({ ok: false, error: 'status inválido' }, { status: 400 });
  }

  const existing = await prisma.order.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, error: 'Pedido no encontrado' }, { status: 404 });

  if (typeof expectedVersion === 'number' && existing.version !== expectedVersion) {
    return NextResponse.json(
      { ok: false, error: 'El pedido cambió desde que lo cargaste — refrescá e intentá de nuevo.', current: existing },
      { status: 409 }
    );
  }

  if (!VALID_TRANSITIONS[existing.status].includes(toStatus)) {
    return NextResponse.json(
      { ok: false, error: `No se puede pasar de ${existing.status} a ${toStatus}` },
      { status: 409 }
    );
  }

  let courierName: string | undefined;
  if (courierId) {
    const courier = await prisma.courier.findFirst({ where: { id: courierId, tenantId: session.user.tenantId } });
    if (courier) courierName = `${courier.firstName} ${courier.lastName}`;
  }

  // Reassigning to a different courier mid-REPARTO used to leave the old one
  // stuck EN_VIAJE forever — the ENTREGADO branch below only ever freed
  // `existing.courierId`, never the newly-picked one, and a swap-then-deliver
  // in the same call never touched the old courier at all.
  const previousCourierId = existing.courierId;
  const swapped = Boolean(previousCourierId && courierId && previousCourierId !== courierId);
  const finalCourierId = courierId ?? previousCourierId ?? undefined;

  const [order] = await prisma.$transaction([
    prisma.order.update({
      where: { id },
      data: {
        status: toStatus,
        version: { increment: 1 },
        courierId: courierId ?? undefined,
        courierName: courierName ?? undefined,
      },
      include: { items: true },
    }),
    prisma.orderStatusEvent.create({
      data: {
        orderId: id,
        fromStatus: existing.status,
        toStatus,
        changedByUserId: session.user.id,
      },
    }),
    // A courier moving into REPARTO is now "on a trip"; landing on
    // ENTREGADO frees the one actually on the order (not necessarily the
    // one from before, if it was swapped in this same call) — both
    // reflected live on the Cadetes screen and the KDS courier-count badge.
    ...(swapped ? [prisma.courier.update({ where: { id: previousCourierId! }, data: { status: 'DISPONIBLE' } })] : []),
    ...(finalCourierId && toStatus === 'REPARTO'
      ? [prisma.courier.update({ where: { id: finalCourierId }, data: { status: 'EN_VIAJE' } })]
      : []),
    ...(finalCourierId && toStatus === 'ENTREGADO'
      ? [prisma.courier.update({ where: { id: finalCourierId }, data: { status: 'DISPONIBLE' } })]
      : []),
  ]);

  emitOrderEvent(session.user.tenantId, 'order:status-changed', order);

  return NextResponse.json({ ok: true, order });
}
