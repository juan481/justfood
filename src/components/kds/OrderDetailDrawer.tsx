'use client';

import { useEffect, useState } from 'react';
import { formatPesos } from '@/lib/format';
import type { Order, OrderStatus } from '@/types/order';

const NEXT_STATUS: Partial<Record<OrderStatus, { label: string; status: OrderStatus }>> = {
  NUEVO: { label: 'Pasar a en Cocina / Horno', status: 'COCINA' },
  COCINA: { label: 'Listo p/ Despacho', status: 'REPARTO' },
  REPARTO: { label: 'Marcar Entregado', status: 'ENTREGADO' },
};
const PREV_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  COCINA: 'NUEVO',
  REPARTO: 'COCINA',
  ENTREGADO: 'REPARTO',
};
const CHANNEL_LABEL: Record<Order['channel'], string> = { WEB: 'Web', MOSTRADOR: 'Mostrador', WHATSAPP: 'WhatsApp' };
const DELIVERY_LABEL: Record<string, string> = { delivery: 'Delivery', mostrador: 'Retiro', salon: 'Mesa/Salón' };

interface CourierOption {
  id: string;
  firstName: string;
  lastName: string;
  vehicle: string | null;
  status: string;
}

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

interface Props {
  order: Order | null;
  onClose: () => void;
  onAdvance: (order: Order, status: OrderStatus, courierId?: string) => void;
  onCancel: (order: Order) => void;
}

export function OrderDetailDrawer({ order, onClose, onAdvance, onCancel }: Props) {
  const [frequentInfo, setFrequentInfo] = useState<{ orderCount: number } | null>(null);
  const [courierId, setCourierId] = useState('');
  const [couriers, setCouriers] = useState<CourierOption[]>([]);

  useEffect(() => {
    setFrequentInfo(null);
    setCourierId(order?.courierId ?? '');
    if (!order?.customerPhone) return;
    fetch(`/api/v1/admin/customers/lookup?phone=${encodeURIComponent(order.customerPhone)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.orderCount > 1) setFrequentInfo({ orderCount: d.orderCount });
      });
  }, [order?.id, order?.customerPhone]);

  useEffect(() => {
    if (!order || order.deliveryType !== 'delivery') return;
    fetch('/api/v1/admin/couriers')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setCouriers(d.couriers.filter((c: CourierOption & { isActiveToday: boolean }) => c.isActiveToday));
      });
  }, [order?.id, order?.deliveryType]);

  if (!order) return null;
  const next = NEXT_STATUS[order.status];
  const prev = PREV_STATUS[order.status];
  const elapsedMin = minutesSince(order.createdAt);
  const isLate = elapsedMin > 25 && order.status !== 'ENTREGADO' && order.status !== 'CANCELADO';
  const subtotal = order.totalAmount - order.deliveryFee;
  const initials = (order.customerName || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-command-950/60 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="bg-gradient-to-r from-command-950 via-command-900 to-command-800 text-white p-5 space-y-1 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold">#{order.orderCode.replace(/^\D+-?0*/, '')}</span>
              <span className="px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-semibold">{CHANNEL_LABEL[order.channel]}</span>
              <span className="px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-semibold">{DELIVERY_LABEL[order.deliveryType] ?? order.deliveryType}</span>
              {isLate && (
                <span className="px-2 py-0.5 rounded-full bg-red-500 text-[10px] font-bold animate-pulse">Demorado {elapsedMin - 25}m</span>
              )}
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
              <span className="material-symbols-rounded">close</span>
            </button>
          </div>
          <p className="text-[11px] text-white/50">
            Ingresado hoy {new Date(order.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-command-800/10 text-command-800 font-bold flex items-center justify-center shrink-0">
              {initials}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-800">{order.customerName || 'Cliente sin nombre'}</div>
              {frequentInfo && <div className="text-xs text-emerald-600 font-medium">Cliente frecuente ({frequentInfo.orderCount} pedidos)</div>}
            </div>
            {order.customerPhone && (
              <a
                href={`https://wa.me/54${order.customerPhone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100 transition-colors shrink-0"
              >
                <span className="material-symbols-rounded text-sm">chat</span>
                WhatsApp
              </a>
            )}
          </div>

          {order.address && (
            <div className="text-sm text-slate-600 space-y-0.5">
              <div className="flex items-start gap-1.5">
                <span className="material-symbols-rounded text-base text-slate-400 shrink-0">location_on</span>
                <span>
                  {order.address}
                  {order.locality ? `, ${order.locality}` : ''}
                </span>
              </div>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(order.address + ' ' + (order.locality ?? ''))}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-command-700 hover:underline ml-5"
              >
                Abrir en Google Maps
              </a>
            </div>
          )}

          {order.notes && (
            <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
              <span className="material-symbols-rounded text-sm shrink-0">sticky_note_2</span>
              <span>{order.notes}</span>
            </div>
          )}

          <div>
            <div className="font-bold text-slate-800 mb-2 text-sm">Items del Pedido ({order.items.length})</div>
            <ul className="space-y-2">
              {order.items.map((item) => (
                <li key={item.id} className="flex flex-col gap-0.5">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1 rounded-md bg-command-800/10 text-command-800 font-bold text-[10px]">
                        {item.quantity}x
                      </span>
                      {item.productNameSnapshot}
                    </span>
                    <span className="font-mono">{formatPesos(item.unitPriceSnapshot * item.quantity)}</span>
                  </div>
                  {item.notes && (
                    <span className="text-[11px] text-amber-700 ml-8 flex items-center gap-1">
                      <span className="material-symbols-rounded text-xs">edit_note</span>
                      Nota de Cocina: {item.notes}
                    </span>
                  )}
                </li>
              ))}
              {order.items.length === 0 && <li className="text-xs text-slate-400">Sin items estructurados (pedido migrado).</li>}
            </ul>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal productos</span>
              <span className="font-mono">{formatPesos(subtotal)}</span>
            </div>
            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Costo de envío</span>
                <span className="font-mono">{formatPesos(order.deliveryFee)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-200">
              <span className="font-bold text-slate-800 text-sm">Total Comanda</span>
              <span className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    order.paymentMethod === 'efectivo' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {order.paymentMethod === 'efectivo' ? 'Cobrar' : 'Pagado'} ({order.paymentMethod})
                </span>
                <span className="font-mono font-bold text-command-950">{formatPesos(order.totalAmount)}</span>
              </span>
            </div>
          </div>

          {order.deliveryType === 'delivery' && (order.status === 'COCINA' || order.status === 'REPARTO') && (
            <div>
              <label className="text-xs font-semibold text-slate-500 flex items-center gap-1 mb-1">
                <span className="material-symbols-rounded text-sm">two_wheeler</span>
                Asignar Repartidor / Cadete
              </label>
              <select
                value={courierId}
                onChange={(e) => setCourierId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-command-800"
              >
                <option value="">Sin asignar</option>
                {couriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                    {c.vehicle ? ` (${c.vehicle})` : ''}
                    {c.status === 'EN_VIAJE' ? ' — en viaje' : ''}
                  </option>
                ))}
                {couriers.length === 0 && <option disabled>Sin cadetes activos — dalos de alta en Cadetes & Repartidores</option>}
              </select>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-200 space-y-2 sticky bottom-0 bg-white shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => window.open(`/kds/print/${order.id}`, '_blank', 'width=380,height=600')}
              className="py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-rounded text-base">print</span>
              Reimprimir
            </button>
            {prev ? (
              <button
                onClick={() => onAdvance(order, prev)}
                className="py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-rounded text-base">undo</span>
                Volver un paso
              </button>
            ) : (
              <span />
            )}
          </div>

          {next && (
            <button
              onClick={() => onAdvance(order, next.status, courierId || undefined)}
              className="w-full py-3 rounded-xl bg-command-800 hover:bg-command-900 text-white font-semibold text-sm uppercase tracking-wide transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
            >
              <span className="material-symbols-rounded text-base">local_fire_department</span>
              {next.label}
            </button>
          )}
          {order.status !== 'ENTREGADO' && order.status !== 'CANCELADO' && (
            <button
              onClick={() => onCancel(order)}
              className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-xs uppercase tracking-wide transition-colors"
            >
              Cancelar / Reembolso
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
