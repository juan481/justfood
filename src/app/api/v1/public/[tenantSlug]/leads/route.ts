import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveTenant } from '@/lib/tenant';

// Port of PizzaZeka's POST /api/leads.
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) {
    return NextResponse.json({ ok: false, error: 'Tenant no encontrado' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) {
    return NextResponse.json({ ok: false, error: 'Email requerido' }, { status: 400 });
  }

  const lead = await prisma.lead.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: { code: body.code ?? undefined },
    create: { tenantId: tenant.id, email, code: body.code ?? null },
  });

  return NextResponse.json({ ok: true, lead });
}
