import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/admin-session';

// Historial de Pedidos: unlike /kds/orders (today + active only), this
// searches EVERY order regardless of date or status — the point is being
// able to type in an order number and see exactly what was ordered, by
// whom, and how it was consumed, no matter how old it is.
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';

  const orders = await prisma.order.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(q
        ? {
            OR: [
              { orderCode: { contains: q, mode: 'insensitive' } },
              { customerName: { contains: q, mode: 'insensitive' } },
              { customerPhone: { contains: q } },
            ],
          }
        : {}),
    },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ ok: true, orders });
}
