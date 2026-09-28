import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';

// Rejecting does NOT cancel the order — it stays in EN_ESPERA_PAGO so the
// customer can be asked (by the bot, once Fase 2b/2d are wired up; by hand
// today) to resend a corrected comprobante and a new PaymentReceipt gets
// attached to the same order (plan section 6.4).
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

  const updated = await prisma.paymentReceipt.update({
    where: { id },
    data: { finalStatus: 'REJECTED', reviewedByUserId: session.user.id, reviewedAt: new Date() },
  });

  return NextResponse.json({ ok: true, receipt: updated });
}
