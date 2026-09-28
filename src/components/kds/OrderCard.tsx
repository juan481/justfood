'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { formatPesos } from '@/lib/format';
import type { Order, OrderStatus } from '@/types/order';

const CHANNEL_META: Record<Order['channel'], { icon: string; label: string; className: string }> = {
  WEB: { icon: 'public', label: 'Web', className: 'bg-blue-50 text-blue-700' },
  MOSTRADOR: { icon: 'storefront', label: 'Mostrador', className: 'bg-slate-100 text-slate-600' },
  WHATSAPP: { icon: 'chat', label: 'WhatsApp', className: 'bg-emerald-50 text-emerald-700' },
};

const DELIVERY_META: Record<string, { icon: string; label: string; className: string }> = {
  delivery: { icon: 'two_wheeler', label: 'Delivery', className: 'bg-orange-50 text-orange-700' },
  mostrador: { icon: 'storefront', label: 'Retiro', className: 'bg-purple-50 text-purple-700' },
};

const NEXT_ACTION: Partial<Record<OrderStatus, { label: string; status: OrderStatus; icon: string; className: string }>> = {
  NUEVO: {
    label: 'Pasar a Cocina / Horno',
    status: 'COCINA',
    icon: 'local_fire_department',
    className: 'bg-orange-500 hover:bg-orange-600',
  },
  COCINA: {
    label: 'Listo p/ Despacho',
    status: 'REPARTO',
    icon: 'done_all',
    className: 'bg-orange-500 hover:bg-orange-600',
  },
  REPARTO: {
    label: 'Marcar Entregado',
    status: 'ENTREGADO',
    icon: 'task_alt',
    className: 'bg-command-800 hover:bg-command-900',
  },
};

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  order: Order;
  onOpenDetail: () => void;
  onAdvance: (order: Order, status: OrderStatus, courierId?: string) => void;
}

export function OrderCard({ order, onOpenDetail, onAdvance }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    data: { order },
  });

  const channel = CHANNEL_META[order.channel];
  const delivery = DELIVERY_META[order.deliveryType] ?? DELIVERY_META.mostrador;
  const elapsedMin = minutesSince(order.createdAt);
  const isLate = elapsedMin > 25 && order.status !== 'ENTREGADO' && order.status !== 'CANCELADO';
  const isCashOnDelivery = order.paymentMethod === 'efectivo';
  const next = NEXT_ACTION[order.status];

  function handleAdvanceClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!next) return;
    if (next.status === 'REPARTO' && order.deliveryType === 'delivery' && !order.courierId) {
      // Assigning a real cadete needs the picker in the detail drawer, not
      // a free-text prompt — open that instead of guessing.
      onOpenDetail();
      return;
    }
    onAdvance(order, next.status, order.courierId ?? undefined);
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      onClick={onOpenDetail}
      className={`group w-full text-left bg-white rounded-2xl border shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden animate-in fade-in slide-in-from-bottom-1 touch-none ${
        isDragging ? 'opacity-40 rotate-1 scale-95 z-50 shadow-2xl' : 'opacity-100'
      } ${isLate ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200'}`}
      {...attributes}
      {...listeners}
    >
      <div className="p-4 space-y-3">
        {/* Header row: order code, channel/delivery badges, time/late */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-sm font-bold text-command-950">#{order.orderCode.replace(/^\D+-?0*/, '')}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${channel.className}`}>
              <span className="material-symbols-rounded text-[13px]">{channel.icon}</span>
              {channel.label}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${delivery.className}`}>
              <span className="material-symbols-rounded text-[13px]">{delivery.icon}</span>
              {delivery.label}
            </span>
          </div>
          {isLate ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-red-500 text-white shrink-0 animate-pulse">
              <span className="material-symbols-rounded text-xs">warning</span>+{elapsedMin - 25}m Demorado
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 shrink-0">Hace {elapsedMin} min</span>
          )}
        </div>

        {/* Customer + logistics info */}
        <div className="space-y-0.5">
          <div className="font-bold text-sm text-slate-800">{order.customerName || 'Cliente sin nombre'}</div>
          {order.deliveryType === 'delivery' && order.address && (
            <div className="flex items-start gap-1 text-xs text-slate-500">
              <span className="material-symbols-rounded text-sm shrink-0">location_on</span>
              <span>
                {order.address}
                {order.locality ? `, ${order.locality}` : ''}
              </span>
            </div>
          )}
          {order.deliveryType === 'mostrador' && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <span className="material-symbols-rounded text-sm">schedule</span>
              Retira aprox. {formatClock(new Date(new Date(order.createdAt).getTime() + 20 * 60000))} hs
            </div>
          )}
          {order.status === 'REPARTO' && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg px-2 py-1 w-fit mt-1">
              <span className="material-symbols-rounded text-sm">two_wheeler</span>
              {order.courierName || 'Repartidor sin asignar'} · en viaje {elapsedMin}m
            </div>
          )}
        </div>

        {/* Items */}
        <ul className="space-y-1 text-xs">
          {order.items.slice(0, 4).map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-2">
              <span className="flex items-start gap-1.5">
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-md bg-command-800/10 text-command-800 font-bold text-[10px] shrink-0">
                  {item.quantity}x
                </span>
                <span className="text-slate-600">{item.productNameSnapshot}</span>
              </span>
              <span className="font-mono text-slate-400 shrink-0">{formatPesos(item.unitPriceSnapshot * item.quantity)}</span>
            </li>
          ))}
          {order.items.length === 0 && <li className="text-slate-400 italic">Pedido migrado sin items estructurados</li>}
          {order.items.length > 4 && <li className="text-slate-400">+{order.items.length - 4} más</li>}
        </ul>

        {/* Notes callout */}
        {order.notes && (
          <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-2 text-[11px] text-amber-800">
            <span className="material-symbols-rounded text-sm shrink-0">sticky_note_2</span>
            <span className="line-clamp-2">{order.notes}</span>
          </div>
        )}

        {/* Payment status */}
        <div className="flex items-center justify-between pt-1">
          {isCashOnDelivery ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700">
              <span className="material-symbols-rounded text-sm">payments</span>
              Cobrar {order.deliveryType === 'delivery' ? 'en destino' : 'al retirar'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
              <span className="material-symbols-rounded text-sm">check_circle</span>
              Pagado ({order.paymentMethod})
            </span>
          )}
          <span className="font-mono font-bold text-command-950 text-sm">{formatPesos(order.totalAmount)}</span>
        </div>
      </div>

      {/* Big CTA */}
      {next && (
        <button
          onClick={handleAdvanceClick}
          className={`w-full py-3 text-white font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-colors ${next.className}`}
        >
          <span className="material-symbols-rounded text-base">{next.icon}</span>
          {next.label}
        </button>
      )}
    </div>
  );
}
