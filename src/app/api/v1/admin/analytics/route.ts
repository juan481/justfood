import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/admin-session';
import { startOfTodayAR, toDateKeyAR } from '@/lib/timezone';

// Aggregates for the Estadísticas screen — computed on read from Order/
// OrderItem rather than a separate rollup table (fine at this data volume;
// revisit with a materialized rollup only if this ever gets slow).
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const days = Number(new URL(req.url).searchParams.get('days') ?? '7');
  // Fixed UTC-3 (Argentina doesn't observe DST) — see src/lib/timezone.ts.
  const since = new Date(startOfTodayAR().getTime() - (days - 1) * 24 * 3600_000);

  const orders = await prisma.order.findMany({
    where: {
      tenantId: session.user.tenantId,
      status: 'ENTREGADO',
      createdAt: { gte: since },
    },
    include: { items: true },
  });

  const revenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const orderCount = orders.length;
  const avgTicket = orderCount ? Math.round(revenue / orderCount) : 0;

  const byChannel: Record<string, { count: number; revenue: number }> = {};
  const byDay: Record<string, { count: number; revenue: number }> = {};
  const productTotals = new Map<string, { name: string; quantity: number; revenue: number }>();

  for (const o of orders) {
    byChannel[o.channel] ??= { count: 0, revenue: 0 };
    byChannel[o.channel].count++;
    byChannel[o.channel].revenue += o.totalAmount;

    const dayKey = toDateKeyAR(o.createdAt);
    byDay[dayKey] ??= { count: 0, revenue: 0 };
    byDay[dayKey].count++;
    byDay[dayKey].revenue += o.totalAmount;

    for (const item of o.items) {
      const key = item.productId ?? item.productNameSnapshot;
      const existing = productTotals.get(key) ?? { name: item.productNameSnapshot, quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += item.unitPriceSnapshot * item.quantity;
      productTotals.set(key, existing);
    }
  }

  const topProducts = [...productTotals.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 8);

  const totalCustomers = await prisma.order.findMany({
    where: { tenantId: session.user.tenantId, createdAt: { gte: since }, customerPhone: { not: null } },
    select: { customerPhone: true },
    distinct: ['customerPhone'],
  });

  // Month-to-date + visit tracking, for the top stat cards — separate from
  // the `days` window above (that one drives the chart/top-products, this
  // one is always "this calendar month" regardless of the chart's range).
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 3 * 3600_000);

  const [visitsToday, visitsThisMonth, ordersThisMonth, allOrdersForRanking] = await Promise.all([
    prisma.pageView.count({ where: { tenantId: session.user.tenantId, createdAt: { gte: startOfTodayAR() } } }),
    prisma.pageView.count({ where: { tenantId: session.user.tenantId, createdAt: { gte: startOfMonth } } }),
    // `not: 'CANCELADO'` alone still counts EN_ESPERA_PAGO — a transferencia/MP
    // order sitting in the Pagos por Revisar queue, not yet confirmed as an
    // actual sale (it might get rejected). Counting it here would overstate
    // this month's revenue and a customer's real spend with unconfirmed money.
    prisma.order.findMany({
      where: {
        tenantId: session.user.tenantId,
        createdAt: { gte: startOfMonth },
        status: { notIn: ['CANCELADO', 'EN_ESPERA_PAGO'] },
      },
      select: { totalAmount: true },
    }),
    prisma.order.findMany({
      where: {
        tenantId: session.user.tenantId,
        customerPhone: { not: null },
        status: { notIn: ['CANCELADO', 'EN_ESPERA_PAGO'] },
      },
      select: { customerPhone: true, customerName: true, address: true, locality: true, totalAmount: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const revenueThisMonth = ordersThisMonth.reduce((sum, o) => sum + o.totalAmount, 0);
  const conversionPct = visitsThisMonth > 0 ? Math.round((ordersThisMonth.length / visitsThisMonth) * 1000) / 10 : 0;

  const customerAgg = new Map<
    string,
    { phone: string; name: string; lastAddress: string | null; orderCount: number; total: number }
  >();
  for (const o of allOrdersForRanking) {
    const phone = o.customerPhone!;
    const existing = customerAgg.get(phone) ?? { phone, name: o.customerName ?? phone, lastAddress: null, orderCount: 0, total: 0 };
    existing.orderCount++;
    existing.total += o.totalAmount;
    if (!existing.lastAddress && o.address) existing.lastAddress = `${o.address}${o.locality ? `, ${o.locality}` : ''}`;
    customerAgg.set(phone, existing);
  }
  const topCustomers = [...customerAgg.values()].sort((a, b) => b.orderCount - a.orderCount).slice(0, 5);

  const recentOrders = await prisma.order.findMany({
    where: { tenantId: session.user.tenantId, status: { not: 'CANCELADO' } },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });

  return NextResponse.json({
    ok: true,
    days,
    revenue,
    orderCount,
    avgTicket,
    uniqueCustomers: totalCustomers.length,
    byChannel,
    byDay,
    topProducts,
    visitsToday,
    visitsThisMonth,
    ordersThisMonth: ordersThisMonth.length,
    revenueThisMonth,
    conversionPct,
    topCustomers,
    recentOrders,
  });
}
