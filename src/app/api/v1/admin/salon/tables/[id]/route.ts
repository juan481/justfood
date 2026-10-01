import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/admin-session';

// Mesa completa + pedido actual + ítems — alimenta el panel lateral
// (TableDrawer) cuando se hace clic en una mesa ocupada/en pre-cuenta.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const table = await prisma.table.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      currentOrder: {
        include: { items: { orderBy: { createdAt: 'asc' } } },
      },
    },
  });
  if (!table) return NextResponse.json({ ok: false, error: 'Mesa no encontrada' }, { status: 404 });

  return NextResponse.json({ ok: true, table });
}
