import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/admin-session';

// Single-order lookup — used by the comanda print view (Fase 3) so it can
// be opened standalone in a new tab/window without re-fetching the whole
// KDS list.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const order = await prisma.order.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: { items: true },
  });
  if (!order) return NextResponse.json({ ok: false, error: 'Pedido no encontrado' }, { status: 404 });

  return NextResponse.json({ ok: true, order });
}
