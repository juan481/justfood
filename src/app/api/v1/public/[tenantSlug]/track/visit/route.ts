import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveTenant } from '@/lib/tenant';

// Port of PizzaZeka's POST /api/track/visit.
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) {
    return NextResponse.json({ ok: false, error: 'Tenant no encontrado' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const path = typeof body.path === 'string' ? body.path : '/';
  const referrer = typeof body.referrer === 'string' ? body.referrer : '';
  const userAgent = req.headers.get('user-agent') ?? '';
  const ip = req.headers.get('x-forwarded-for') ?? '';
  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16);

  await prisma.pageView.create({
    data: { tenantId: tenant.id, path, referrer, userAgent, ipHash },
  });

  return NextResponse.json({ ok: true });
}
