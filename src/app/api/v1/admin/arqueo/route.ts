import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/admin-session';
import { dayRangeAR, toDateKeyAR } from '@/lib/timezone';

// Cash-reconciliation totals for a given date, grouped by payment method —
// a real "arqueo de caja" needs a shift/drawer-session model (open/close,
// counted-vs-expected cash) that doesn't exist yet; this gives the
// itemized totals a real reconciliation starts from.
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  // Fixed UTC-3 (plan/timezone.ts) — the default date and the day's
  // boundaries are both computed in Argentina time, not server-local time.
  const dateParam = new URL(req.url).searchParams.get('date') ?? toDateKeyAR(new Date());
  const [start, end] = dayRangeAR(dateParam);

  const orders = await prisma.order.findMany({
    where: {
      tenantId: session.user.tenantId,
      status: { in: ['ENTREGADO', 'REPARTO', 'COCINA', 'NUEVO'] },
      createdAt: { gte: start, lte: end },
    },
  });

  const byMethod: Record<string, { count: number; total: number }> = {};
  for (const o of orders) {
    byMethod[o.paymentMethod] ??= { count: 0, total: 0 };
    byMethod[o.paymentMethod].count++;
    byMethod[o.paymentMethod].total += o.totalAmount;
  }

  const grandTotal = orders.reduce((sum, o) => sum + o.totalAmount, 0);

  return NextResponse.json({ ok: true, date: dateParam, byMethod, grandTotal, orderCount: orders.length });
}
