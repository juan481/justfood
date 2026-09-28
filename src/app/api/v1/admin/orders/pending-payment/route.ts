import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/admin-session';

// Orders sitting in EN_ESPERA_PAGO with no receipt attached yet — the
// "esperando comprobante" section of the Pagos por Revisar screen, distinct
// from receipts already submitted and awaiting human approval.
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const orders = await prisma.order.findMany({
    where: {
      tenantId: session.user.tenantId,
      status: 'EN_ESPERA_PAGO',
      paymentReceipts: { none: { finalStatus: 'PENDING' } },
    },
    include: { items: true },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ ok: true, orders });
}
