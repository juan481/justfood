import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';
import { releaseOrderToKitchen } from '@/lib/release-order';

// The one human checkpoint in the whole WhatsApp payment flow (plan section
// 6.4/6.1): approving here is what promotes EN_ESPERA_PAGO -> NUEVO and
// puts the order on the KDS board for the first time, via the exact same
// real-time path as any other new order (same alert banner + sound).
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN', 'MOSTRADOR'])) {
    return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });
  }

  const receipt = await prisma.paymentReceipt.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!receipt) return NextResponse.json({ ok: false, error: 'Comprobante no encontrado' }, { status: 404 });
  if (receipt.finalStatus !== 'PENDING') {
    return NextResponse.json({ ok: false, error: 'Este comprobante ya fue revisado' }, { status: 409 });
  }

  await prisma.paymentReceipt.update({
    where: { id },
    data: { finalStatus: 'APPROVED', reviewedByUserId: session.user.id, reviewedAt: new Date() },
  });

  const order = await releaseOrderToKitchen(receipt.orderId, session.user.tenantId, 'pagado', session.user.id);

  return NextResponse.json({ ok: true, order });
}
