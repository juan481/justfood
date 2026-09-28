import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN', 'MOSTRADOR'])) {
    return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });
  }

  const existing = await prisma.courier.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, error: 'Cadete no encontrado' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const courier = await prisma.courier.update({
    where: { id },
    data: {
      isActiveToday: typeof body.isActiveToday === 'boolean' ? body.isActiveToday : undefined,
      status: body.status ?? undefined,
      firstName: body.firstName ?? undefined,
      lastName: body.lastName ?? undefined,
      phone: body.phone ?? undefined,
      vehicle: body.vehicle ?? undefined,
      plate: body.plate ?? undefined,
      tariffPerDelivery: typeof body.tariffPerDelivery === 'number' ? body.tariffPerDelivery : undefined,
    },
  });

  return NextResponse.json({ ok: true, courier });
}
