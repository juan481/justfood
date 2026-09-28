import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/admin-session';
import { startOfTodayAR } from '@/lib/timezone';

// Everything the Cadetes & Repartidores screen (and the KDS courier-count
// badge) needs in one call: today's delivery stats, the fleet list with
// live per-courier state, and how much cash each one is still holding
// from cobrar-en-destino deliveries (plan section 7's "arqueo" needs a
// real reconciliation source — this is the courier side of it).
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const startOfToday = startOfTodayAR();

  const [couriers, todaysDeliveries, unsettledCash] = await Promise.all([
    prisma.courier.findMany({ where: { tenantId: session.user.tenantId }, orderBy: { createdAt: 'asc' } }),
    prisma.order.findMany({
      where: {
        tenantId: session.user.tenantId,
        courierId: { not: null },
        createdAt: { gte: startOfToday },
        status: { in: ['ENTREGADO', 'CANCELADO'] },
      },
      select: { courierId: true, status: true, createdAt: true, updatedAt: true },
    }),
    prisma.order.findMany({
      where: {
        tenantId: session.user.tenantId,
        courierId: { not: null },
        paymentMethod: 'efectivo',
        status: 'ENTREGADO',
        cashSettledAt: null,
      },
      select: { courierId: true, totalAmount: true },
    }),
  ]);

  const cashByCourier = new Map<string, number>();
  for (const o of unsettledCash) {
    cashByCourier.set(o.courierId!, (cashByCourier.get(o.courierId!) ?? 0) + o.totalAmount);
  }

  const deliveredToday = todaysDeliveries.filter((o) => o.status === 'ENTREGADO');
  const avgDeliveryMin = deliveredToday.length
    ? Math.round(
        deliveredToday.reduce((sum, o) => sum + (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()), 0) /
          deliveredToday.length /
          60000
      )
    : 0;
  const effectivenessPct = todaysDeliveries.length
    ? Math.round((deliveredToday.length / todaysDeliveries.length) * 100)
    : 100;

  const deliveriesByCourier = new Map<string, number>();
  for (const o of deliveredToday) {
    deliveriesByCourier.set(o.courierId!, (deliveriesByCourier.get(o.courierId!) ?? 0) + 1);
  }

  const fleet = couriers.map((c) => {
    const deliveries = deliveriesByCourier.get(c.id) ?? 0;
    return {
      ...c,
      deliveriesToday: deliveries,
      earnedToday: deliveries * c.tariffPerDelivery,
      cashPending: cashByCourier.get(c.id) ?? 0,
    };
  });

  const connectedCount = couriers.filter((c) => c.isActiveToday && c.status !== 'INACTIVO').length;
  const totalCommissions = fleet.reduce((sum, c) => sum + c.earnedToday, 0);
  const totalCashPending = fleet.reduce((sum, c) => sum + c.cashPending, 0);

  return NextResponse.json({
    ok: true,
    fleet,
    stats: {
      connectedCount,
      totalCouriers: couriers.length,
      deliveriesToday: deliveredToday.length,
      avgDeliveryMin,
      effectivenessPct,
      totalCommissions,
      totalCashPending,
    },
  });
}
