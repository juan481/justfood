// ETL one-shot: PizzaZeka's real production data.sqlite → JustFood's Postgres,
// scoped under the `pizzazeka` tenant. Re-runnable (upserts by legacy id) —
// safe to run again after fixing a mapping bug.
//
// IMPORTANT: reads from scripts/data/pizzazeka-snapshot.sqlite, a COPY taken
// with `cp` — this script never opens ../../PizzaZeka/data.sqlite directly.
// Before the real cutover, re-copy a fresh snapshot right before running this
// for the last time (see plan section 8, Fase 1 "plan de corte").
//
// items_json is NOT real JSON despite the column name — it's a human-readable
// formatted string (bullet + "NxProduct – $Price" per line, built for the
// WhatsApp confirmation message). Parsing is best-effort: unparseable lines
// (seen in real data: a literal "[]", and a malformed "- .000" price from a
// mercadopago-channel order) are preserved verbatim in the migrated order's
// notes instead of silently dropped, per the plan's migration guidance.

import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { PrismaClient, OrderChannel, OrderStatus } from '@prisma/client';
import { encryptSecret } from '../src/lib/crypto';

const prisma = new PrismaClient();
const SNAPSHOT_PATH = path.join(__dirname, 'data', 'pizzazeka-snapshot.sqlite');
const TENANT_SLUG = 'pizzazeka';

// Loose, low-structure settings ported verbatim into TenantSetting (key kept
// identical to the old `config` table so it's recognizable) — payment/POS
// keys are handled separately below since they get their own typed tables.
const TENANT_SETTING_KEYS = [
  'whatsapp_number',
  'report_email',
  'discount_popup_enabled',
  'discount_code',
  'discount_percent',
  'business_type',
  'business_name',
  'module_congelados',
  'module_almacen',
  'module_delivery',
  'module_salon',
  'kds_sound_enabled',
];

const CHANNEL_MAP: Record<string, OrderChannel> = {
  web: OrderChannel.WEB,
  whatsapp_bot: OrderChannel.WHATSAPP,
  whatsapp: OrderChannel.WHATSAPP,
  mostrador: OrderChannel.MOSTRADOR,
};

// `despacho` renamed to `REPARTO` to match the KDS mockup's actual column
// label ("En Reparto") — a deliberate naming fix made while porting anyway.
const STATUS_MAP: Record<string, OrderStatus> = {
  nuevo: OrderStatus.NUEVO,
  cocina: OrderStatus.COCINA,
  despacho: OrderStatus.REPARTO,
  reparto: OrderStatus.REPARTO,
  entregado: OrderStatus.ENTREGADO,
  cancelado: OrderStatus.CANCELADO,
};

interface ParsedLine {
  quantity: number;
  name: string;
  price: number;
}

// Price group requires a leading digit — rejects the real malformed data
// seen in the source app (e.g. "- .000", "- .500": a display bug that
// truncated the leading digit off the price) instead of silently accepting
// a bogus $0/low price. Those lines fall through to unparsedLines instead.
const ITEM_LINE_RE = /^\s*•\s*(\d+)x\s+(.+?)\s*[–-]\s*\$?\s*(\d[\d.]*)\s*$/;
const SHIPPING_LINE_RE = /env[ií]o|costo de env[ií]o/i;

function parseItemsJson(raw: string): { items: ParsedLine[]; unparsedLines: string[] } {
  const items: ParsedLine[] = [];
  const unparsedLines: string[] = [];

  if (!raw || raw.trim() === '[]') {
    if (raw && raw.trim() !== '') unparsedLines.push(raw);
    return { items, unparsedLines };
  }

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (SHIPPING_LINE_RE.test(trimmed)) continue; // delivery fee, already inside total_amount

    const match = trimmed.match(ITEM_LINE_RE);
    if (match) {
      const [, qtyStr, name, priceStr] = match;
      // Argentine thousands-separator formatting ("20.000" -> 20000)
      const price = parseInt(priceStr.replace(/\./g, ''), 10);
      if (!Number.isNaN(price)) {
        items.push({ quantity: parseInt(qtyStr, 10), name: name.trim(), price });
        continue;
      }
    }
    // Doesn't match cleanly (e.g. "• 2x Mamma Mía" with no price, or the
    // malformed "- .000" mercadopago-channel bug) — preserve, don't drop.
    unparsedLines.push(trimmed);
  }

  return { items, unparsedLines };
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/^pizza\s+/, '') // items_json sometimes prefixes "Pizza " that the catalog name doesn't have
    .trim();
}

async function main() {
  const db = new DatabaseSync(SNAPSHOT_PATH, { readOnly: true });

  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    throw new Error(
      `Tenant "${TENANT_SLUG}" no existe — correr "npm run db:seed" primero (Fase 0).`
    );
  }
  const branch = await prisma.branch.findFirst({ where: { tenantId: tenant.id, isDefault: true } });
  if (!branch) throw new Error(`No hay sucursal default para el tenant "${TENANT_SLUG}".`);

  console.log(`Migrando hacia tenant "${tenant.slug}" (${tenant.id}), sucursal "${branch.name}"...`);

  // ── Categorías + productos ────────────────────────────────────────────
  const categoryCache = new Map<string, string>(); // name -> id
  const products = db.prepare('SELECT * FROM products ORDER BY sort_order ASC, id ASC').all() as any[];

  let productsCreated = 0;
  for (const p of products) {
    let categoryId = categoryCache.get(p.category);
    if (!categoryId) {
      const category = await prisma.category.upsert({
        where: { id: `${tenant.id}-cat-${p.category}` },
        update: {},
        create: { id: `${tenant.id}-cat-${p.category}`, tenantId: tenant.id, name: p.category },
      });
      categoryId = category.id;
      categoryCache.set(p.category, categoryId);
    }

    await prisma.product.upsert({
      where: { tenantId_legacyProductId: { tenantId: tenant.id, legacyProductId: p.id } },
      update: {
        name: p.name,
        description: p.description,
        price: p.price,
        isActive: !!p.is_active,
        isFrozen: !!p.is_frozen,
        sortOrder: p.sort_order,
        categoryId,
      },
      create: {
        tenantId: tenant.id,
        legacyProductId: p.id,
        categoryId,
        name: p.name,
        description: p.description,
        price: p.price,
        isActive: !!p.is_active,
        isFrozen: !!p.is_frozen,
        sortOrder: p.sort_order,
      },
    });
    productsCreated++;
  }
  console.log(`  productos: ${productsCreated} migrados (${categoryCache.size} categorías)`);

  // Build a lookup for order-item -> product matching (best-effort, by name)
  const allProducts = await prisma.product.findMany({ where: { tenantId: tenant.id } });
  const productByNormalizedName = new Map(allProducts.map((p) => [normalizeName(p.name), p]));

  // ── Config → TenantSettings / PaymentConfig / POSIntegrationConfig / DeliveryZone ──
  const configRows = db.prepare('SELECT key, value FROM config').all() as { key: string; value: string }[];
  const config = Object.fromEntries(configRows.map((r) => [r.key, r.value]));

  for (const key of TENANT_SETTING_KEYS) {
    if (config[key] === undefined) continue;
    await prisma.tenantSetting.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      update: { value: config[key] },
      create: { tenantId: tenant.id, key, value: config[key] },
    });
  }
  console.log(`  tenant settings: ${TENANT_SETTING_KEYS.length} keys revisadas`);

  await prisma.paymentConfig.upsert({
    where: { tenantId: tenant.id },
    update: {
      paymentAlias: config.payment_alias || null,
      paymentTitular: config.payment_titular || null,
      paymentCvu: config.payment_cvu || null,
      mpAccessTokenEncrypted: config.mp_access_token ? encryptSecret(config.mp_access_token) : null,
      mpEnabled: !!(config.mp_access_token && config.mp_access_token.trim().length > 10),
    },
    create: {
      tenantId: tenant.id,
      paymentAlias: config.payment_alias || null,
      paymentTitular: config.payment_titular || null,
      paymentCvu: config.payment_cvu || null,
      mpAccessTokenEncrypted: config.mp_access_token ? encryptSecret(config.mp_access_token) : null,
      mpEnabled: !!(config.mp_access_token && config.mp_access_token.trim().length > 10),
    },
  });

  await prisma.pOSIntegrationConfig.upsert({
    where: { tenantId: tenant.id },
    update: {
      enabled: config.fudo_enabled === '1',
      apiTokenEncrypted: config.fudo_api_token ? encryptSecret(config.fudo_api_token) : null,
      businessId: config.fudo_business_id || null,
    },
    create: {
      tenantId: tenant.id,
      provider: 'fudo',
      enabled: config.fudo_enabled === '1',
      apiTokenEncrypted: config.fudo_api_token ? encryptSecret(config.fudo_api_token) : null,
      businessId: config.fudo_business_id || null,
    },
  });
  console.log('  payment config + POS (Fudo) config migrados (secretos encriptados)');

  if (config.admin_password) {
    console.log(
      '  NOTA: config.admin_password ("' +
        config.admin_password +
        '") era la contraseña compartida del prototipo — NO se migra. ' +
        'El usuario admin real ya existe desde la siembra de Fase 0, con su propio hash bcrypt.'
    );
  }

  const deliveryZoneId = `${tenant.id}-zone-default`;
  await prisma.deliveryZone.upsert({
    where: { id: deliveryZoneId },
    update: {
      radiusKm: config.delivery_radius_km ? parseFloat(config.delivery_radius_km) : null,
      cost: config.delivery_cost ? parseInt(config.delivery_cost, 10) : 0,
    },
    create: {
      id: deliveryZoneId,
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Zona única',
      type: 'radius',
      radiusKm: config.delivery_radius_km ? parseFloat(config.delivery_radius_km) : null,
      cost: config.delivery_cost ? parseInt(config.delivery_cost, 10) : 0,
    },
  });
  console.log('  zona de delivery (radio plano, igual al config actual) migrada');

  // ── Mesas ──────────────────────────────────────────────────────────────
  const tables = db.prepare('SELECT * FROM tables_inventory').all() as any[];
  for (const t of tables) {
    await prisma.tableInventory.upsert({
      where: { tenantId_legacyId: { tenantId: tenant.id, legacyId: t.id } },
      update: { capacity: t.capacity, quantity: t.quantity, label: t.label },
      create: {
        tenantId: tenant.id,
        branchId: branch.id,
        legacyId: t.id,
        capacity: t.capacity,
        quantity: t.quantity,
        label: t.label,
      },
    });
  }
  console.log(`  mesas: ${tables.length} migradas`);

  // ── Reservas ───────────────────────────────────────────────────────────
  const reservations = db.prepare('SELECT * FROM reservations').all() as any[];
  for (const r of reservations) {
    await prisma.reservation.upsert({
      where: { tenantId_legacyId: { tenantId: tenant.id, legacyId: r.id } },
      update: {},
      create: {
        tenantId: tenant.id,
        branchId: branch.id,
        legacyId: r.id,
        customerName: r.customer_name,
        customerPhone: r.customer_phone,
        reservationDate: r.reservation_date,
        timeSlot: r.time_slot,
        peopleCount: r.people_count,
        tableCapacityUsed: r.table_capacity_used,
        status: r.status,
        notes: r.notes,
        createdAt: new Date(r.created_at.replace(' ', 'T') + 'Z'),
      },
    });
  }
  console.log(`  reservas: ${reservations.length} migradas`);

  // ── Leads ──────────────────────────────────────────────────────────────
  const leads = db.prepare('SELECT * FROM leads').all() as any[];
  let leadsSkipped = 0;
  for (const l of leads) {
    try {
      await prisma.lead.upsert({
        where: { tenantId_email: { tenantId: tenant.id, email: l.email } },
        update: { code: l.code },
        create: {
          tenantId: tenant.id,
          email: l.email,
          code: l.code,
          createdAt: new Date(l.created_at.replace(' ', 'T') + 'Z'),
        },
      });
    } catch (e) {
      leadsSkipped++;
    }
  }
  console.log(`  leads: ${leads.length - leadsSkipped} migrados${leadsSkipped ? `, ${leadsSkipped} omitidos (duplicados)` : ''}`);

  // ── Page views ─────────────────────────────────────────────────────────
  // No natural unique key to upsert on (and none needed in the source) —
  // clear this tenant's previously-migrated rows first so re-running the
  // ETL doesn't duplicate them.
  const pageViews = db.prepare('SELECT * FROM page_views').all() as any[];
  await prisma.pageView.deleteMany({ where: { tenantId: tenant.id } });
  for (const pv of pageViews) {
    await prisma.pageView.create({
      data: {
        tenantId: tenant.id,
        path: pv.path,
        referrer: pv.referrer || null,
        userAgent: pv.user_agent || null,
        ipHash: pv.ip_hash || null,
        createdAt: new Date(pv.created_at.replace(' ', 'T') + 'Z'),
      },
    });
  }
  console.log(`  page views: ${pageViews.length} migradas`);

  // ── Pedidos (orders_log → Order + OrderItem + OrderStatusEvent) ────────
  const orders = db.prepare('SELECT * FROM orders_log ORDER BY id ASC').all() as any[];
  let ordersCreated = 0;
  let itemsCreated = 0;
  let itemsUnmatched = 0;

  for (const o of orders) {
    const channel = CHANNEL_MAP[o.channel] ?? OrderChannel.WEB;
    const status = STATUS_MAP[o.status] ?? OrderStatus.NUEVO;
    const { items, unparsedLines } = parseItemsJson(o.items_json);

    const notes = [o.notes, unparsedLines.length ? `[ETL: líneas no parseadas de items_json] ${unparsedLines.join(' | ')}` : null]
      .filter(Boolean)
      .join('\n');

    const order = await prisma.order.upsert({
      where: { tenantId_legacyOrderId: { tenantId: tenant.id, legacyOrderId: o.id } },
      update: {
        status,
        channel,
        deliveryType: o.delivery_type || 'delivery',
        customerName: o.customer_name,
        customerPhone: o.customer_phone,
        address: o.address,
        locality: o.locality,
        notes: notes || null,
        paymentMethod: o.payment_method || 'efectivo',
        paymentStatus: o.payment_status || 'pendiente',
        totalAmount: o.total_amount,
      },
      create: {
        tenantId: tenant.id,
        branchId: branch.id,
        legacyOrderId: o.id,
        orderCode: `PZK-${String(o.id).padStart(4, '0')}`,
        channel,
        status,
        deliveryType: o.delivery_type || 'delivery',
        customerName: o.customer_name,
        customerPhone: o.customer_phone,
        address: o.address,
        locality: o.locality,
        notes: notes || null,
        paymentMethod: o.payment_method || 'efectivo',
        paymentStatus: o.payment_status || 'pendiente',
        totalAmount: o.total_amount,
        createdAt: new Date(o.created_at.replace(' ', 'T') + 'Z'),
      },
    });
    ordersCreated++;

    // Delete + recreate items each run (rather than skip-if-any-exist) so
    // fixing a parsing bug and re-running actually corrects already-migrated
    // orders instead of freezing in whatever the first run produced.
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    for (const item of items) {
      const product = productByNormalizedName.get(normalizeName(item.name));
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: product?.id ?? null,
          productNameSnapshot: item.name,
          unitPriceSnapshot: item.price,
          quantity: item.quantity,
        },
      });
      itemsCreated++;
      if (!product) itemsUnmatched++;
    }

    const existingStatusEvent = await prisma.orderStatusEvent.findFirst({ where: { orderId: order.id } });
    if (!existingStatusEvent) {
      await prisma.orderStatusEvent.create({
        data: { orderId: order.id, fromStatus: null, toStatus: status },
      });
    }
  }
  console.log(
    `  pedidos: ${ordersCreated} migrados, ${itemsCreated} items (${itemsUnmatched} sin match de producto por nombre)`
  );

  db.close();
  console.log('\nMigración completa.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
