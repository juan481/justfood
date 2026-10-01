import { prisma } from '@/lib/prisma';

export interface PublicDeliveryZone {
  scope: 'ALL' | 'STANDARD' | 'FROZEN';
  cost: number;
  radiusKm: number | null;
}

// Shared by the public /config and /menu endpoints — the legacy PizzaZeka
// frontend (and any future storefront) reads this instead of keeping its own
// copy of delivery cost/radius, so JustFood stays the single source of truth.
export async function getPublicDeliveryZones(tenantId: string): Promise<PublicDeliveryZone[]> {
  const zones = await prisma.deliveryZone.findMany({ where: { tenantId, isActive: true } });
  return zones.map((z) => ({ scope: z.scope, cost: z.cost, radiusKm: z.radiusKm }));
}

// Backward-compatible flat fields for callers that only know about a single
// zone: STANDARD (or ALL as fallback) is the right default since it's the
// tighter, more common case.
export function flattenDeliveryZone(zones: PublicDeliveryZone[]) {
  const zone = zones.find((z) => z.scope === 'STANDARD') ?? zones.find((z) => z.scope === 'ALL') ?? null;
  return { delivery_cost: zone?.cost ?? null, delivery_radius_km: zone?.radiusKm ?? null };
}
