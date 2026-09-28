import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';
import { resolveDefaultBranch } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const from = new URL(req.url).searchParams.get('from');

  const [reservations, tables] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(from ? { reservationDate: { gte: from } } : {}),
      },
      orderBy: [{ reservationDate: 'asc' }, { timeSlot: 'asc' }],
    }),
    prisma.tableInventory.findMany({ where: { tenantId: session.user.tenantId } }),
  ]);

  return NextResponse.json({ ok: true, reservations, tables });
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN', 'MOSTRADOR'])) {
    return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });
  }

  const branch = await resolveDefaultBranch(session.user.tenantId);
  if (!branch) return NextResponse.json({ ok: false, error: 'Sin sucursal configurada' }, { status: 500 });

  const body = await req.json().catch(() => null);
  if (!body?.customer_name || !body?.reservation_date || !body?.time_slot || !body?.people_count) {
    return NextResponse.json({ ok: false, error: 'Faltan campos requeridos' }, { status: 400 });
  }

  const reservation = await prisma.reservation.create({
    data: {
      tenantId: session.user.tenantId,
      branchId: branch.id,
      customerName: body.customer_name,
      customerPhone: body.customer_phone ?? null,
      reservationDate: body.reservation_date,
      timeSlot: body.time_slot,
      peopleCount: Number(body.people_count),
      tableCapacityUsed: Number(body.people_count),
      notes: body.notes ?? null,
    },
  });

  return NextResponse.json({ ok: true, reservation }, { status: 201 });
}
