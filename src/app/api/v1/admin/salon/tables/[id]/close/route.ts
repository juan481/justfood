import { NextRequest, NextResponse } from 'next/server';
import { requireSession, hasRole } from '@/lib/admin-session';
import { closeTable, TableSessionError } from '@/lib/table-session';

const VALID_PAYMENT_METHODS = new Set(['efectivo', 'debito', 'credito', 'mercadopago', 'transferencia']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN', 'MOSTRADOR'])) {
    return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const paymentMethod = body.paymentMethod;
  if (typeof paymentMethod !== 'string' || !VALID_PAYMENT_METHODS.has(paymentMethod)) {
    return NextResponse.json({ ok: false, error: 'paymentMethod inválido' }, { status: 400 });
  }

  try {
    const result = await closeTable(session.user.tenantId, id, paymentMethod);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof TableSessionError) {
      return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
