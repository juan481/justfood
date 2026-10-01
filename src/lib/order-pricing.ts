import { prisma } from '@/lib/prisma';
import { PrepArea } from '@prisma/client';

// Recomputes an order's total server-side from current catalog prices —
// this is the direct fix for the PizzaZeka prototype's trust bug (it
// accepted whatever `total_amount` the client sent, unconditionally).
// Every order-creation path (web checkout, mostrador, and later the
// WhatsApp bot) must go through this, never accept a client-supplied total.

export interface CartItemInput {
  productId: string;
  // A half-and-half pizza is priced as the more expensive half. The second
  // product is still validated against the same tenant catalog; its price
  // never comes from the browser.
  halfProductId?: string;
  quantity: number;
  notes?: string;
}

export interface PricedItem {
  productId: string;
  productNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  notes: string | null;
  // A dónde se imprime/rutea este ítem (Fase 2 Salón) — congelado al
  // momento del pedido, igual criterio que el resto de los *Snapshot:
  // editar la categoría después nunca reescribe un ticket ya impreso.
  prepAreaSnapshot: PrepArea;
}

export class OrderPricingError extends Error {
  constructor(
    message: string,
    public readonly code: 'PRODUCT_NOT_FOUND' | 'PRODUCT_UNAVAILABLE' | 'EMPTY_CART' | 'INVALID_QUANTITY',
    public readonly productId?: string
  ) {
    super(message);
  }
}

export async function priceCart(tenantId: string, items: CartItemInput[]) {
  if (!items.length) {
    throw new OrderPricingError('El carrito está vacío.', 'EMPTY_CART');
  }

  const productIds = items.flatMap((i) => [i.productId, ...(i.halfProductId ? [i.halfProductId] : [])]);
  const products = await prisma.product.findMany({
    where: { tenantId, id: { in: productIds } },
    include: { category: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const pricedItems: PricedItem[] = [];
  let subtotal = 0;
  // Drives which DeliveryZone scope(s) apply to this order (STANDARD vs
  // FROZEN radios/costs — see resolveDeliveryFee in create-order.ts). A
  // half-and-half pizza is never frozen, so only the main product counts.
  let hasStandardItem = false;
  let hasFrozenItem = false;

  for (const item of items) {
    if (typeof item.productId !== 'string' || !item.productId) {
      throw new OrderPricingError('Producto inválido.', 'PRODUCT_NOT_FOUND');
    }
    const product = productById.get(item.productId);
    if (!product) {
      throw new OrderPricingError(`Producto no encontrado: ${item.productId}`, 'PRODUCT_NOT_FOUND', item.productId);
    }
    if (!product.isActive) {
      throw new OrderPricingError(`"${product.name}" ya no está disponible.`, 'PRODUCT_UNAVAILABLE', item.productId);
    }

    const halfProduct = item.halfProductId ? productById.get(item.halfProductId) : null;
    if (item.halfProductId && !halfProduct) {
      throw new OrderPricingError('La segunda mitad no existe.', 'PRODUCT_NOT_FOUND', item.halfProductId);
    }
    if (halfProduct && !halfProduct.isActive) {
      throw new OrderPricingError(`"${halfProduct.name}" ya no está disponible.`, 'PRODUCT_UNAVAILABLE', item.halfProductId);
    }
    // This endpoint is public: TypeScript types do not validate hostile JSON.
    // Bound quantities to a realistic order size so Infinity/NaN or an abusive
    // payload cannot turn into a database error or an accidental huge order.
    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) {
      throw new OrderPricingError('Cantidad inválida (debe ser un entero entre 1 y 100).', 'INVALID_QUANTITY', item.productId);
    }
    const unitPrice = halfProduct ? Math.max(product.price, halfProduct.price) : product.price;
    const productName = halfProduct
      ? `Media y media: ½ ${product.name} + ½ ${halfProduct.name}`
      : product.name;
    pricedItems.push({
      productId: product.id,
      productNameSnapshot: productName,
      unitPriceSnapshot: unitPrice,
      quantity,
      notes: item.notes ?? null,
      prepAreaSnapshot: product.prepAreaOverride ?? product.category?.prepArea ?? PrepArea.COCINA,
    });
    subtotal += unitPrice * quantity;
    if (product.isFrozen) hasFrozenItem = true;
    else hasStandardItem = true;
  }

  return { items: pricedItems, subtotal, hasStandardItem, hasFrozenItem };
}
