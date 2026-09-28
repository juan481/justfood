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

  const existing = await prisma.reservation.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, error: 'Reserva no encontrada' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const reservation = await prisma.reservation.update({
    where: { id },
    data: { status: body.status ?? undefined },
  });

  return NextResponse.json({ ok: true, reservation });
}
