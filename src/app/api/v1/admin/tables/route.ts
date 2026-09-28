import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';
import { resolveDefaultBranch } from '@/lib/tenant';

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN'])) return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });

  const branch = await resolveDefaultBranch(session.user.tenantId);
  if (!branch) return NextResponse.json({ ok: false, error: 'Sin sucursal configurada' }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const capacity = Number(body.capacity);
  if (!Number.isFinite(capacity) || capacity < 1) {
    return NextResponse.json({ ok: false, error: 'capacity inválida' }, { status: 400 });
  }

  const table = await prisma.tableInventory.create({
    data: {
      tenantId: session.user.tenantId,
      branchId: branch.id,
      capacity,
      quantity: Number(body.quantity) || 0,
      label: body.label || `Mesas para ${capacity}`,
    },
  });

  return NextResponse.json({ ok: true, table }, { status: 201 });
}
