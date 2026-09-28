'use client';

import { formatPesos } from '@/lib/format';
import type { Order } from '@/types/order';

// The dark stats card at the top of "Entregados (Hoy)" + a condensed list
// below it — matches the reference design's "FACTURADO EN TURNO" panel.
export function TurnSummary({ deliveredToday }: { deliveredToday: Order[] }) {
  const total = deliveredToday.reduce((sum, o) => sum + o.totalAmount, 0);
  const onTimeCount = deliveredToday.filter((o) => {
    const minutes = (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / 60000;
    return minutes <= 30;
  }).length;
  const onTimePct = deliveredToday.length ? Math.round((onTimeCount / deliveredToday.length) * 100) : 100;

  return (
    <div className="bg-gradient-to-br from-command-900 to-command-950 text-white rounded-2xl p-4 shadow-sm space-y-1">
      <p className="text-[10px] uppercase font-semibold text-limeaccent tracking-wider">Facturado en Turno</p>
      <div className="flex items-end justify-between">
        <span className="font-mono font-bold text-xl">{formatPesos(total)}</span>
        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-limeaccent text-command-950">
          {onTimePct}% a tiempo
        </span>
      </div>
      <p className="text-[11px] text-white/60">{deliveredToday.length} comandas hoy</p>
    </div>
  );
}

export function CompletedOrderRow({ order, onOpenDetail }: { order: Order; onOpenDetail: () => void }) {
  const time = new Date(order.updatedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return (
    <button
      onClick={onOpenDetail}
      className="w-full flex items-center gap-2.5 bg-white rounded-xl border border-slate-100 px-3 py-2.5 hover:border-emerald-200 hover:bg-emerald-50/40 transition-colors text-left animate-in fade-in"
    >
      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
        <span className="material-symbols-rounded text-sm">check</span>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-semibold text-slate-700 truncate">
          #{order.orderCode.replace(/^\D+-?0*/, '')} {order.customerName || 'Cliente'}
        </span>
        <span className="block text-[10px] text-slate-400">
          {time} hs · {order.deliveryType === 'delivery' ? 'Delivery' : 'Retiro en local'}
        </span>
      </span>
      <span className="font-mono text-xs text-slate-500 shrink-0">{formatPesos(order.totalAmount)}</span>
    </button>
  );
}
