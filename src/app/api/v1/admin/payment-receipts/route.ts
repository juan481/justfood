import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';
import { autoValidateReceipt } from '@/lib/payment-receipt-validation';

// GET: the "Pagos por Revisar" queue — every receipt still pending human
// review, for orders sitting in EN_ESPERA_PAGO.
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const receipts = await prisma.paymentReceipt.findMany({
    where: { tenantId: session.user.tenantId, finalStatus: 'PENDING' },
    include: { order: { include: { items: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ ok: true, receipts });
}

// POST: attach a receipt to an order awaiting payment review. Today this is
// called from the manual "cargar comprobante" form in the order detail
// drawer (staff types in what they read off the transfer screenshot); once
// GEMINI_API_KEY is configured (Fase 2d), the same endpoint becomes the
// target for the Vision-based extraction pipeline — the auto-validation
// logic and the review queue don't change either way.
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN', 'MOSTRADOR'])) {
    return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.orderId) {
    return NextResponse.json({ ok: false, error: 'orderId requerido' }, { status: 400 });
  }

  const order = await prisma.order.findFirst({ where: { id: body.orderId, tenantId: session.user.tenantId } });
  if (!order) return NextResponse.json({ ok: false, error: 'Pedido no encontrado' }, { status: 404 });
  if (order.status !== 'EN_ESPERA_PAGO') {
    return NextResponse.json({ ok: false, error: 'Este pedido no está esperando revisión de pago' }, { status: 409 });
  }

  const extractedAmount = typeof body.extractedAmount === 'number' ? body.extractedAmount : null;
  const extractedAliasOrCvu = body.extractedAliasOrCvu || null;
  const extractedOperationNumber = body.extractedOperationNumber || null;

  const autoValidationStatus = await autoValidateReceipt(
    session.user.tenantId,
    order.totalAmount,
    extractedAmount,
    extractedAliasOrCvu,
    extractedOperationNumber
  );

  const receipt = await prisma.paymentReceipt.create({
    data: {
      tenantId: session.user.tenantId,
      orderId: order.id,
      imageUrl: body.imageUrl || 'about:blank',
      extractedAmount,
      extractedAliasOrCvu,
      extractedOperationNumber,
      extractedAt: extractedAmount || extractedAliasOrCvu || extractedOperationNumber ? new Date() : null,
      autoValidationStatus,
    },
  });

  return NextResponse.json({ ok: true, receipt }, { status: 201 });
}
