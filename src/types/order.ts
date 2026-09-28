export type OrderStatus = 'EN_ESPERA_PAGO' | 'NUEVO' | 'COCINA' | 'REPARTO' | 'ENTREGADO' | 'CANCELADO';
export type OrderChannel = 'WEB' | 'MOSTRADOR' | 'WHATSAPP';

export interface OrderItem {
  id: string;
  productId: string | null;
  productNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  notes: string | null;
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
}
