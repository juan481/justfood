import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/admin-session';
import { startOfTodayAR } from '@/lib/timezone';
import { OrderStatus } from '@prisma/client';

// Port of PizzaZeka's GET /api/admin/kds/orders — deliberately excludes
// EN_ESPERA_PAGO (plan section 6: transfer orders awaiting the "Pagos por
// Revisar" human review never appear on the kitchen board).
//
// ENTREGADO is scoped to today only — active orders (NUEVO/COCINA/REPARTO)
// show regardless of date, but once there's weeks of delivered-order history
// (demo data, or just normal operation) the board would otherwise fill up
// with old deliveries instead of showing today's shift.
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  // Fixed UTC-3 (Argentina doesn't observe DST) — not the server OS's local
  // time, which is UTC by default on the VPS this eventually deploys to.
  const startOfToday = startOfTodayAR();

  const orders = await prisma.order.findMany({
    where: {
      tenantId: session.user.tenantId,
      OR: [
        { status: { in: [OrderStatus.NUEVO, OrderStatus.COCINA, OrderStatus.REPARTO] } },
        { status: OrderStatus.ENTREGADO, updatedAt: { gte: startOfToday } },
      ],
    },
    include: { items: true },
    orderBy: { createdAt: 'asc' },
    take: 300,
  });

  return NextResponse.json({ ok: true, orders });
}
