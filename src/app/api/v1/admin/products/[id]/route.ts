import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';

async function assertOwnedProduct(tenantId: string, id: string) {
  const product = await prisma.product.findFirst({ where: { id, tenantId } });
  return product;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN'])) return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });

  const existing = await assertOwnedProduct(session.user.tenantId, id);
  if (!existing) return NextResponse.json({ ok: false, error: 'Producto no encontrado' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  // `?? undefined` would silently no-op on an explicit `null` (clearing the
  // field) since `??` treats null and undefined the same — description and
  // categoryId both need to be clearable, so they check `=== undefined`.
  const product = await prisma.product.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      description: body.description === undefined ? undefined : body.description,
      price: typeof body.price === 'number' ? Math.round(body.price) : undefined,
      categoryId: body.categoryId === undefined ? undefined : body.categoryId,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
      isFrozen: typeof body.isFrozen === 'boolean' ? body.isFrozen : undefined,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
    },
    // The admin UI merges this response straight into its product list —
    // without `category` the nested object would be dropped from local
    // state until the next full reload, showing "—" for a just-edited row.
    include: { category: true },
  });

  return NextResponse.json({ ok: true, product });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN'])) return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });

  const existing = await assertOwnedProduct(session.user.tenantId, id);
  if (!existing) return NextResponse.json({ ok: false, error: 'Producto no encontrado' }, { status: 404 });

  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
