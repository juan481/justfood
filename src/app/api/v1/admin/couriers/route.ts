import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';
import { resolveDefaultBranch } from '@/lib/tenant';

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const couriers = await prisma.courier.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ ok: true, couriers });
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
  if (!body?.firstName || !body?.lastName) {
    return NextResponse.json({ ok: false, error: 'Nombre y apellido requeridos' }, { status: 400 });
  }

  const courier = await prisma.courier.create({
    data: {
      tenantId: session.user.tenantId,
      branchId: branch.id,
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone || null,
      vehicle: body.vehicle || null,
      plate: body.plate || null,
      tariffPerDelivery: Number(body.tariffPerDelivery) || 0,
      isActiveToday: body.isActiveToday ?? true,
    },
  });

  return NextResponse.json({ ok: true, courier }, { status: 201 });
}
