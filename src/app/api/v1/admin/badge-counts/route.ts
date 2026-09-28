import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/admin-session';
import { OrderStatus } from '@prisma/client';

// Powers the little notification badges in the header nav (Comandero,
// Pagos por Revisar) — fetched by AppHeader itself on every screen, not
// just the KDS, so "how many pedidos are waiting" is visible everywhere,
// not just when you happen to be looking at the board.
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const [activeOrders, pendingPaymentReviews] = await Promise.all([
    prisma.order.count({
      where: {
        tenantId: session.user.tenantId,
        status: { in: [OrderStatus.NUEVO, OrderStatus.COCINA, OrderStatus.REPARTO] },
      },
    }),
    prisma.paymentReceipt.count({
      where: { tenantId: session.user.tenantId, finalStatus: 'PENDING' },
    }),
  ]);

  return NextResponse.json({ ok: true, activeOrders, pendingPaymentReviews });
}
