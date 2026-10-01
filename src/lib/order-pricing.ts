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

  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { tenantId, id: { in: productIds } },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const pricedItems: PricedItem[] = [];
  let subtotal = 0;

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
    // This endpoint is public: TypeScript types do not validate hostile JSON.
    // Bound quantities to a realistic order size so Infinity/NaN or an abusive
    // payload cannot turn into a database error or an accidental huge order.
    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) {
      throw new OrderPricingError('Cantidad inválida (debe ser un entero entre 1 y 100).', 'INVALID_QUANTITY', item.productId);
    }
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
