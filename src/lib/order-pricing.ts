import { prisma } from '@/lib/prisma';

// Recomputes an order's total server-side from current catalog prices —
// this is the direct fix for the PizzaZeka prototype's trust bug (it
// accepted whatever `total_amount` the client sent, unconditionally).
// Every order-creation path (web checkout, mostrador, and later the
// WhatsApp bot) must go through this, never accept a client-supplied total.

export interface CartItemInput {
  productId: string;
  quantity: number;
  notes?: string;
}

export interface PricedItem {
  productId: string;
  productNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  notes: string | null;
}

export class OrderPricingError extends Error {
  constructor(
    message: string,
    public readonly code: 'PRODUCT_NOT_FOUND' | 'PRODUCT_UNAVAILABLE' | 'EMPTY_CART',
    public readonly productId?: string
  ) {
    super(message);
  }
}

export async function priceCart(tenantId: string, items: CartItemInput[]) {
  if (!items.length) {
    throw new OrderPricingError('El carrito está vacío.', 'EMPTY_CART');
  }

  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { tenantId, id: { in: productIds } },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const pricedItems: PricedItem[] = [];
  let subtotal = 0;

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) {
      throw new OrderPricingError(`Producto no encontrado: ${item.productId}`, 'PRODUCT_NOT_FOUND', item.productId);
    }
    if (!product.isActive) {
      throw new OrderPricingError(`"${product.name}" ya no está disponible.`, 'PRODUCT_UNAVAILABLE', item.productId);
    }
    const quantity = Math.max(1, Math.floor(item.quantity));
    pricedItems.push({
      productId: product.id,
      productNameSnapshot: product.name,
      unitPriceSnapshot: product.price,
      quantity,
      notes: item.notes ?? null,
    });
    subtotal += product.price * quantity;
  }

  return { items: pricedItems, subtotal };
}
