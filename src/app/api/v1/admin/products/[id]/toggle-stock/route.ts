import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';

// Port of PizzaZeka's PATCH /api/admin/products/:id/toggle-stock.
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN', 'MOSTRADOR'])) {
    return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });
  }

  const existing = await prisma.product.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, error: 'Producto no encontrado' }, { status: 404 });

  const product = await prisma.product.update({ where: { id }, data: { isActive: !existing.isActive } });
  return NextResponse.json({ ok: true, product });
}
