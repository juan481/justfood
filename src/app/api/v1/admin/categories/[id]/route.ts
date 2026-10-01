import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, hasRole } from '@/lib/admin-session';
import { PrepArea } from '@prisma/client';

// No existía ningún endpoint de edición de categoría (solo se crean por
// script) — hace falta uno chico para poder asignarles la estación de
// preparación (Fase 2 Salón) desde /menu.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  if (!hasRole(session, ['ADMIN'])) return NextResponse.json({ ok: false, error: 'Rol insuficiente' }, { status: 403 });

  const existing = await prisma.category.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, error: 'Categoría no encontrada' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (body.prepArea !== undefined && !Object.values(PrepArea).includes(body.prepArea)) {
    return NextResponse.json({ ok: false, error: 'prepArea inválido' }, { status: 400 });
  }

  const category = await prisma.category.update({
    where: { id },
    data: { prepArea: body.prepArea ?? undefined },
  });

  return NextResponse.json({ ok: true, category });
}
