export type OrderStatus = 'EN_ESPERA_PAGO' | 'NUEVO' | 'COCINA' | 'REPARTO' | 'ENTREGADO' | 'CANCELADO';
export type OrderChannel = 'WEB' | 'MOSTRADOR' | 'WHATSAPP' | 'DINE_IN';
export type PrepArea = 'COCINA' | 'BARRA' | 'SIN_IMPRESION';

export interface OrderItem {
  id: string;
  productId: string | null;
  productNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  notes: string | null;
  createdAt: string;
  prepAreaSnapshot: PrepArea | null;
  preparedAt: string | null;
}

export interface Order {
  id: string;
  orderCode: string;
  channel: OrderChannel;
  status: OrderStatus;
  deliveryType: string;
  customerName: string | null;
  customerPhone: string | null;
  address: string | null;
  locality: string | null;
  notes: string | null;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: number;
  deliveryFee: number;
  courierName: string | null;
  courierId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  // Fase 2 (Salón) — solo tiene valor con channel=DINE_IN.
  tableId: string | null;
  guestCount: number | null;
  waiterUserId: string | null;
  waiterName: string | null;
  table?: { number: number } | null;
}
