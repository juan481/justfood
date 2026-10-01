import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';
import { resolveDefaultBranch } from '@/lib/tenant';

// Fase 2 (Salón) — mesas en vivo, distinto de /api/v1/admin/tables (que
// sigue sirviendo TableInventory, el contador de capacidad para reservas).
// GET alimenta la grilla: liviano, un resumen del pedido actual por mesa.
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const tables = await prisma.table.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { number: 'asc' },
    include: {
      currentOrder: {
        select: { id: true, orderCode: true, guestCount: true, waiterName: true, totalAmount: true, createdAt: true, items: { select: { id: true } } },
      },
    },
  });

  return NextResponse.json({ ok: true, tables });
}

// Alta de una mesa nueva (ej. agregar una 25ª) — el alta masiva inicial se
// hace con scripts/seed-tables.ts, esto es para el día a día.
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN'])) return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });

  const branch = await resolveDefaultBranch(session.user.tenantId);
  if (!branch) return NextResponse.json({ ok: false, error: 'Sin sucursal configurada' }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const number = Number(body.number);
  if (!Number.isSafeInteger(number) || number < 1) {
    return NextResponse.json({ ok: false, error: 'number inválido' }, { status: 400 });
  }
  const capacity = Number.isFinite(Number(body.capacity)) ? Number(body.capacity) : 4;

  const existing = await prisma.table.findFirst({ where: { tenantId: session.user.tenantId, branchId: branch.id, number } });
  if (existing) return NextResponse.json({ ok: false, error: `Ya existe la Mesa ${number}.` }, { status: 409 });

  const table = await prisma.table.create({
    data: { tenantId: session.user.tenantId, branchId: branch.id, number, capacity },
  });

  return NextResponse.json({ ok: true, table }, { status: 201 });
}
