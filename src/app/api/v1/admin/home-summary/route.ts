import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/admin-session';
import { startOfTodayAR } from '@/lib/timezone';
import { OrderStatus } from '@prisma/client';

// Powers the Home dashboard — a snapshot of "what's happening right now"
// (kitchen load, payments waiting on a human, today's sales) so the first
// screen after login is a real cockpit, not just a redirect to the KDS.
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const startOfToday = startOfTodayAR();
  const tenantId = session.user.tenantId;

  const [tenant, activeOrders, pendingPaymentReviews, todaysOrders, connectedCouriers] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.order.count({
      where: { tenantId, status: { in: [OrderStatus.NUEVO, OrderStatus.COCINA, OrderStatus.REPARTO] } },
    }),
    prisma.paymentReceipt.count({ where: { tenantId, finalStatus: 'PENDING' } }),
    prisma.order.findMany({
      where: { tenantId, createdAt: { gte: startOfToday }, status: { not: OrderStatus.CANCELADO } },
      select: { totalAmount: true },
    }),
    prisma.courier.count({ where: { tenantId, isActiveToday: true, status: { not: 'INACTIVO' } } }),
  ]);

  const todaysRevenue = todaysOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  return NextResponse.json({
    ok: true,
    tenantName: tenant?.name ?? '',
    activeOrders,
    pendingPaymentReviews,
    todaysOrdersCount: todaysOrders.length,
    todaysRevenue,
    connectedCouriers,
  });
}
