import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';

// Port of PizzaZeka's PATCH /api/admin/products/:id/price — the
// inline-editable price cell in Menú y Precios calls this directly rather
// than the full PUT, so a quick price tweak doesn't need the whole form.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN'])) return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (typeof body.price !== 'number' || body.price < 0) {
    return NextResponse.json({ ok: false, error: 'price inválido' }, { status: 400 });
  }

  const existing = await prisma.product.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, error: 'Producto no encontrado' }, { status: 404 });

  // include: category — the admin UI replaces the whole row in local state
  // with this response; without it, the category column goes blank until
  // the next full reload even though nothing actually changed server-side.
  const product = await prisma.product.update({ where: { id }, data: { price: Math.round(body.price) }, include: { category: true } });
  return NextResponse.json({ ok: true, product });
}
