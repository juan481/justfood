import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';
import { emitOrderEvent } from '@/lib/socket';

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN', 'BARRA'])) {
    return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });
  }

  // El ítem tiene que pertenecer a un pedido del tenant — OrderItem no
  // tiene tenantId propio, se verifica a través del Order.
  const item = await prisma.orderItem.findFirst({ where: { id, order: { tenantId: session.user.tenantId } } });
  if (!item) return NextResponse.json({ ok: false, error: 'Ítem no encontrado' }, { status: 404 });

  await prisma.orderItem.update({ where: { id }, data: { preparedAt: new Date() } });

  const order = await prisma.order.findUnique({ where: { id: item.orderId }, include: { items: true } });
  if (order) emitOrderEvent(session.user.tenantId, 'order:status-changed', order);

  return NextResponse.json({ ok: true });
}
