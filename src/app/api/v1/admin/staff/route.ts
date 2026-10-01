import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/admin-session';

// Usuarios activos del tenant — alimenta el selector de "mozo" al abrir una
// mesa (Fase 2 Salón). Cualquier rol puede figurar como mozo asignado, no
// hay un rol "mozo" separado (decisión de producto).
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const staff = await prisma.user.findMany({
    where: { tenantId: session.user.tenantId, isActive: true },
    select: { id: true, username: true, role: true },
    orderBy: { username: 'asc' },
  });

  return NextResponse.json({ ok: true, staff });
}
