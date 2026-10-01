import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';
import { OrderChannel, OrderStatus } from '@prisma/client';

// Pedidos de mesa abiertos, con los ítems filtrados SERVER-SIDE a solo los
// de estación Barra y todavía no marcados listos — Barra nunca debe recibir
// ni ver comida en la respuesta (no es un filtro de cliente que se pueda
// saltear).
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN', 'BARRA'])) {
    return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });
  }

  const orders = await prisma.order.findMany({
    where: {
      tenantId: session.user.tenantId,
      channel: OrderChannel.DINE_IN,
      status: OrderStatus.NUEVO,
      items: { some: { prepAreaSnapshot: 'BARRA', preparedAt: null } },
    },
    include: {
      table: { select: { number: true } },
      items: { where: { prepAreaSnapshot: 'BARRA', preparedAt: null }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ ok: true, orders });
}
