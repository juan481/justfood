import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';

// Port of PizzaZeka's GET/POST /api/admin/products, tenant-scoped from the
// session instead of trusting anything the client sends.
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { category: true },
    }),
    prisma.category.findMany({ where: { tenantId: session.user.tenantId }, orderBy: { sortOrder: 'asc' } }),
  ]);

  return NextResponse.json({ ok: true, products, categories });
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN'])) return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body?.name || typeof body.price !== 'number') {
    return NextResponse.json({ ok: false, error: 'name y price son requeridos' }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      tenantId: session.user.tenantId,
      categoryId: body.categoryId ?? null,
      name: body.name,
      description: body.description ?? null,
      price: Math.round(body.price),
      isActive: body.isActive ?? true,
      isFrozen: body.isFrozen ?? false,
    },
  });

  return NextResponse.json({ ok: true, product }, { status: 201 });
}
