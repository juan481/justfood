import { NextRequest, NextResponse } from 'next/server';
import { requireSession, hasRole } from '@/lib/admin-session';
import { moveTable, TableSessionError } from '@/lib/table-session';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN', 'MOSTRADOR'])) {
    return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.targetTableId !== 'string' || !body.targetTableId) {
    return NextResponse.json({ ok: false, error: 'targetTableId es requerido' }, { status: 400 });
  }

  try {
    const result = await moveTable(session.user.tenantId, id, body.targetTableId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof TableSessionError) {
      return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
