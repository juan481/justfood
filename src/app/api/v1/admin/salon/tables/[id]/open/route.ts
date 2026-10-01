import { NextRequest, NextResponse } from 'next/server';
import { requireSession, hasRole } from '@/lib/admin-session';
import { openTable, TableSessionError } from '@/lib/table-session';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN', 'MOSTRADOR'])) {
    return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const guestCount = Number(body.guestCount);
  if (!Number.isSafeInteger(guestCount) || guestCount < 1) {
    return NextResponse.json({ ok: false, error: 'guestCount inválido' }, { status: 400 });
  }
  if (typeof body.waiterUserId !== 'string' || !body.waiterUserId) {
    return NextResponse.json({ ok: false, error: 'waiterUserId es requerido' }, { status: 400 });
  }

  try {
    const result = await openTable(session.user.tenantId, id, {
      guestCount,
      waiterUserId: body.waiterUserId,
      customerName: typeof body.customerName === 'string' ? body.customerName : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      createdByUserId: session.user.id,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof TableSessionError) {
      return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
