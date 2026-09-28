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
  const product = await prisma.product.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      description: body.description ?? undefined,
      price: typeof body.price === 'number' ? Math.round(body.price) : undefined,
      categoryId: body.categoryId ?? undefined,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
      isFrozen: typeof body.isFrozen === 'boolean' ? body.isFrozen : undefined,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
    },
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
