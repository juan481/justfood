import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/admin-session';

// "Cliente frecuente" lookup — matched by phone within the tenant. Used by
// the order detail drawer and the new-order modal to show "Cliente
// frecuente (N pedidos)" instead of guessing from a single order.
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const phone = new URL(req.url).searchParams.get('phone')?.trim();
  if (!phone) return NextResponse.json({ ok: true, orderCount: 0, lastOrder: null });

  const [orderCount, orders] = await Promise.all([
    prisma.order.count({ where: { tenantId: session.user.tenantId, customerPhone: phone } }),
    prisma.order.findMany({
      where: { tenantId: session.user.tenantId, customerPhone: phone },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, orderCode: true, address: true, locality: true, createdAt: true, customerName: true },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    orderCount,
    lastOrder: orders[0] ?? null,
    lastAddress: orders.find((o) => o.address)?.address ?? null,
    knownName: orders[0]?.customerName ?? null,
  });
}
