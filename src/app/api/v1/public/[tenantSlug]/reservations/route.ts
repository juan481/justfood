import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveTenant, resolveDefaultBranch } from '@/lib/tenant';

// Port of PizzaZeka's POST /api/reservations. The prototype's
// check-then-insert had a real race window (plan section 7) — this wraps
// the capacity check and insert in one transaction with a row lock.
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) {
    return NextResponse.json({ ok: false, error: 'Tenant no encontrado' }, { status: 404 });
  }
  const branch = await resolveDefaultBranch(tenant.id);
  if (!branch) {
    return NextResponse.json({ ok: false, error: 'Tenant sin sucursal configurada' }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.reservation_date || !body?.time_slot || !body?.people_count || !body?.customer_name) {
    return NextResponse.json({ ok: false, error: 'Faltan campos requeridos' }, { status: 400 });
  }

  const peopleCount = Number(body.people_count);

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      const tables = await tx.$queryRaw<{ id: string; capacity: number; quantity: number }[]>`
        SELECT id, capacity, quantity FROM tables_inventory
        WHERE "tenantId" = ${tenant.id} AND "branchId" = ${branch.id} AND capacity >= ${peopleCount}
        ORDER BY capacity ASC
        FOR UPDATE
      `;

      const existingReservations = await tx.reservation.count({
        where: {
          tenantId: tenant.id,
          reservationDate: body.reservation_date,
          timeSlot: body.time_slot,
          status: { not: 'cancelada' },
        },
      });

      const totalCapacity = tables.reduce((sum, t) => sum + t.quantity, 0);
      if (existingReservations >= totalCapacity) {
        throw new Error('SIN_DISPONIBILIDAD');
      }

      return tx.reservation.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          customerName: body.customer_name,
          customerPhone: body.customer_phone ?? null,
          reservationDate: body.reservation_date,
          timeSlot: body.time_slot,
          peopleCount,
          tableCapacityUsed: tables[0]?.capacity ?? peopleCount,
          notes: body.notes ?? null,
        },
      });
    });

    return NextResponse.json({ ok: true, reservation }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === 'SIN_DISPONIBILIDAD') {
      return NextResponse.json({ ok: false, error: 'Sin disponibilidad para ese horario' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
