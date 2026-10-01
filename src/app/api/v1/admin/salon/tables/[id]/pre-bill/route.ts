import { NextRequest, NextResponse } from 'next/server';
import { requireSession, hasRole } from '@/lib/admin-session';
import { preBillTable, TableSessionError } from '@/lib/table-session';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN', 'MOSTRADOR'])) {
    return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });
  }

  try {
    const table = await preBillTable(session.user.tenantId, id);
    return NextResponse.json({ ok: true, table });
  } catch (err) {
    if (err instanceof TableSessionError) {
      return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
