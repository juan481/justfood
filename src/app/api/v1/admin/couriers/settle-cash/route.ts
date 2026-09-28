import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';

// "Recibir y Cerrar Rendición Parcial" — marks every unsettled cash
// delivery as turned in to the register. Optionally scoped to one courier
// (courierId in body) or all of them at once.
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN', 'MOSTRADOR'])) {
    return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const courierId = typeof body.courierId === 'string' ? body.courierId : undefined;

  const result = await prisma.order.updateMany({
    where: {
      tenantId: session.user.tenantId,
      courierId: courierId ?? { not: null },
      paymentMethod: 'efectivo',
      status: 'ENTREGADO',
      cashSettledAt: null,
    },
    data: { cashSettledAt: new Date() },
  });

  return NextResponse.json({ ok: true, settledCount: result.count });
}
