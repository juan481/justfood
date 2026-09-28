import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN'])) return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });

  const existing = await prisma.tableInventory.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, error: 'No encontrada' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const table = await prisma.tableInventory.update({
    where: { id },
    data: {
      quantity: typeof body.quantity === 'number' ? Math.max(0, body.quantity) : undefined,
      label: body.label ?? undefined,
    },
  });

  return NextResponse.json({ ok: true, table });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN'])) return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });

  const existing = await prisma.tableInventory.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, error: 'No encontrada' }, { status: 404 });

  await prisma.tableInventory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
