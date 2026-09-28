// Carga datos de prueba realistas para poder navegar TODO el producto:
// Comandero (pedidos de los últimos días, en distintos estados), Estadísticas
// (con volumen para que los gráficos digan algo), Salón & Mesas (reservas de
// esta semana y la próxima), Menú QR (algunos leads), Arqueo (variedad de
// métodos de pago). Pensado para pizzazeka, reusa su catálogo real ya migrado.
//
// Re-corrible: agrega datos nuevos cada vez que se corre (no es un ETL
// idempotente como migrate-pizzazeka-sqlite.ts) — pensado para correr una
// o dos veces mientras se prueba, no en cada arranque.
import { PrismaClient, OrderChannel, OrderStatus } from '@prisma/client';
import { priceCart } from '../src/lib/order-pricing';

const prisma = new PrismaClient();

const FIRST_NAMES = [
  'Martín', 'Valentín', 'Carolina', 'Luciana', 'Santiago', 'Florencia', 'Juan', 'Sofía', 'Nicolás', 'Camila',
  'Tomás', 'Agustina', 'Lucas', 'Mora', 'Franco', 'Julieta', 'Bruno', 'Pilar', 'Ignacio', 'Delfina',
];
const LAST_NAMES = [
  'Gómez', 'Rossi', 'Méndez', 'Fernández', 'Peralta', 'López', 'Díaz', 'Acosta', 'Romero', 'Suárez',
  'Herrera', 'Molina', 'Vega', 'Castro', 'Ibáñez',
];
const STREETS = [
  'Salvador Soreda', 'Av. Mitre', 'Las Flores', 'Belgrano', 'San Martín', 'Rivadavia', 'Alsina', 'Yrigoyen',
];
const NOTES = [
  'Tocar timbre fuerte, 2B',
  'Masa bien crocante por favor',
  'Sin cebolla',
  'Dejar en portería',
  'Llamar al llegar',
  'Piso 3, sin ascensor',
  null,
  null,
  null,
];
const COURIERS = ['Lucas Vera (Moto Honda)', 'Emiliano Ríos (Moto Zanella)', 'Brian Soto (Bici)'];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomPhone(): string {
  return `11${randomInt(20000000, 69999999)}`;
}
function randomName(): string {
  return `${randomFrom(FIRST_NAMES)} ${randomFrom(LAST_NAMES)}`;
}

async function main() {
  const tenantSlug = process.argv[2] ?? 'pizzazeka';
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant "${tenantSlug}" no existe.`);
  const branch = await prisma.branch.findFirst({ where: { tenantId: tenant.id, isDefault: true } });
  if (!branch) throw new Error('Sin sucursal default.');

  const products = await prisma.product.findMany({ where: { tenantId: tenant.id, isActive: true } });
  if (products.length === 0) throw new Error('El tenant no tiene productos activos — correr el ETL primero.');

  const channels: OrderChannel[] = [OrderChannel.WEB, OrderChannel.MOSTRADOR, OrderChannel.WHATSAPP];
  const paymentMethods = ['efectivo', 'efectivo', 'transferencia', 'mercadopago'];
  const deliveryTypes = ['delivery', 'delivery', 'mostrador'];

  let ordersCreated = 0;
  let existingCount = await prisma.order.count({ where: { tenantId: tenant.id } });

  // ── Pedidos de los últimos 6 días (para Estadísticas + Arqueo + Comandero) ──
  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const ordersToday = daysAgo === 0 ? randomInt(6, 9) : randomInt(8, 16);

    for (let i = 0; i < ordersToday; i++) {
      const itemCount = randomInt(1, 4);
      const cartItems = Array.from({ length: itemCount }, () => ({
        productId: randomFrom(products).id,
        quantity: randomInt(1, 3),
      }));

      // Colapsa duplicados de producto (misma lógica que priceCart espera: uno por línea está bien,
      // pero si se repite el mismo producto dos veces igual funciona, solo suma dos líneas).
      const { items, subtotal } = await priceCart(tenant.id, cartItems);

      const channel = randomFrom(channels);
      const deliveryType = randomFrom(deliveryTypes);
      const paymentMethod = randomFrom(paymentMethods);
      const isLastHours = daysAgo === 0 && i >= ordersToday - 3;

      // Distribución de estados: los días pasados están todos ENTREGADO
      // (turno cerrado); hoy hay una mezcla realista en todo el pipeline.
      let status: OrderStatus;
      if (daysAgo > 0) {
        status = OrderStatus.ENTREGADO;
      } else if (isLastHours) {
        status = randomFrom([OrderStatus.NUEVO, OrderStatus.NUEVO, OrderStatus.COCINA, OrderStatus.REPARTO]);
      } else {
        status = OrderStatus.ENTREGADO;
      }

      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - daysAgo);
      createdAt.setHours(randomInt(11, 22), randomInt(0, 59), 0, 0);

      const prepMinutes = status === OrderStatus.ENTREGADO ? randomInt(12, 40) : randomInt(0, 15);
      const updatedAt = new Date(createdAt.getTime() + prepMinutes * 60000);

      const address = deliveryType === 'delivery' ? `${randomFrom(STREETS)} ${randomInt(100, 6999)}` : null;
      const courierName = status === OrderStatus.REPARTO && deliveryType === 'delivery' ? randomFrom(COURIERS) : null;

      const order = await prisma.order.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          orderCode: `JF-${String(existingCount + ordersCreated + 1).padStart(5, '0')}`,
          channel,
          status,
          deliveryType,
          customerName: randomName(),
          customerPhone: randomPhone(),
          address,
          locality: address ? 'Wilde' : null,
          notes: randomFrom(NOTES),
          paymentMethod,
          paymentStatus: paymentMethod === 'efectivo' ? 'contra_entrega' : 'pagado',
          totalAmount: subtotal,
          courierName,
          createdAt,
          updatedAt,
          items: { create: items },
        },
      });

      await prisma.orderStatusEvent.create({
        data: { orderId: order.id, fromStatus: null, toStatus: status, createdAt },
      });

      ordersCreated++;
    }
  }
  console.log(`  pedidos de demo: ${ordersCreated} creados (${existingCount} ya existían)`);

  // ── Reservas: algunas de hoy/mañana + toda la semana próxima ──────────────
  const reservationNames = ['Juan Test', 'Familia Ibáñez', 'Cumpleaños Sofía', 'Reunión de trabajo', 'Aniversario'];
  const timeSlots = ['13:00', '13:30', '20:00', '20:30', '21:00', '21:30'];
  let reservationsCreated = 0;

  for (let daysAhead = 0; daysAhead <= 9; daysAhead++) {
    const count = daysAhead <= 1 ? randomInt(2, 4) : randomInt(0, 3);
    for (let i = 0; i < count; i++) {
      const date = new Date();
      date.setDate(date.getDate() + daysAhead);
      const dateStr = date.toISOString().slice(0, 10);

      await prisma.reservation.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          customerName: randomFrom(reservationNames.length > i ? reservationNames : [randomName()]),
          customerPhone: randomPhone(),
          reservationDate: dateStr,
          timeSlot: randomFrom(timeSlots),
          peopleCount: randomInt(2, 8),
          tableCapacityUsed: randomInt(2, 8),
          status: 'confirmada',
          notes: Math.random() > 0.6 ? randomFrom(NOTES) : null,
        },
      });
      reservationsCreated++;
    }
  }
  console.log(`  reservas de demo: ${reservationsCreated} creadas (hoy → próximos 9 días)`);

  // ── Leads adicionales para Menú QR ────────────────────────────────────────
  const leadEmails = ['carla.demo@gmail.com', 'nico.demo@hotmail.com', 'sole.demo@gmail.com', 'facu.demo@gmail.com'];
  let leadsCreated = 0;
  for (const email of leadEmails) {
    try {
      await prisma.lead.create({ data: { tenantId: tenant.id, email, code: 'ZEKA10' } });
      leadsCreated++;
    } catch {
      // ya existe, sigue
    }
  }
  console.log(`  leads de demo: ${leadsCreated} creados`);

  console.log('\nDatos de prueba cargados. Refrescá el navegador para verlos.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
