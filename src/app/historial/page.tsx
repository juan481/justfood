'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AppHeader } from '@/components/AppHeader';
import { Footer } from '@/components/Footer';
import { GuideCard } from '@/components/GuideCard';
import { formatPesos } from '@/lib/format';
import type { Order } from '@/types/order';

const STATUS_META: Record<string, { label: string; className: string }> = {
  EN_ESPERA_PAGO: { label: 'Esperando pago', className: 'bg-amber-100 text-amber-700' },
  NUEVO: { label: 'Nuevo', className: 'bg-amber-100 text-amber-700' },
  COCINA: { label: 'En cocina', className: 'bg-orange-100 text-orange-700' },
  REPARTO: { label: 'En reparto', className: 'bg-blue-100 text-blue-700' },
  ENTREGADO: { label: 'Entregado', className: 'bg-emerald-100 text-emerald-700' },
  CANCELADO: { label: 'Cancelado', className: 'bg-red-100 text-red-700' },
};
const DELIVERY_LABEL: Record<string, string> = { delivery: 'Delivery', mostrador: 'Retiro en local', salon: 'Mesa / Salón' };
const CHANNEL_LABEL: Record<string, string> = { WEB: 'Web', MOSTRADOR: 'Mostrador', WHATSAPP: 'WhatsApp' };

export default function HistorialPage() {
  const { data: session } = useSession();
  const [query, setQuery] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/v1/admin/orders/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setOrders(d.orders);
          setLoading(false);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <AppHeader tenantName={session?.user?.tenantSlug ?? ''} activeNav="historial" />

      <main className="flex-1 max-w-[1000px] w-full mx-auto px-6 sm:px-8 py-6 space-y-4 animate-in fade-in duration-300">
        <GuideCard
          question="¿Cómo funciona el historial?"
          tips={[
            { icon: 'search', title: 'Buscá lo que sea', body: 'Número de comanda, nombre o teléfono — no importa la fecha ni si ya está entregado o cancelado.' },
            { icon: 'expand_more', title: 'Detalle completo', body: 'Tocá una fila para ver qué se pidió, quién lo mandó y dónde se consumió (delivery, retiro o mesa).' },
            { icon: 'verified', title: 'Registro permanente', body: 'Nunca se borra — es tu respaldo ante un reclamo de "yo no pedí esto".' },
          ]}
        />

        <div>
          <h1 className="text-xl font-bold text-command-950">Historial de Pedidos</h1>
          <p className="text-xs text-slate-500">Buscá por número de comanda, cliente o teléfono — sin importar la fecha o el estado.</p>
        </div>

        <div className="relative">
          <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ej: JF-00042, Martín Gómez, 1122334455..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-command-800 transition-shadow shadow-sm"
          />
        </div>

        <div className="space-y-2">
          {loading && <p className="text-sm text-slate-400 text-center py-6">Buscando...</p>}
          {!loading && orders.length === 0 && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
              <p className="text-slate-500 font-medium">Sin resultados.</p>
            </div>
          )}
          {!loading &&
            orders.map((o) => {
              const status = STATUS_META[o.status] ?? STATUS_META.NUEVO;
              const expanded = expandedId === o.id;
              return (
                <div
                  key={o.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden animate-in fade-in"
                >
                  <button
                    onClick={() => setExpandedId(expanded ? null : o.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-mono text-sm font-bold text-command-800 w-24 shrink-0">
                      #{o.orderCode.replace(/^\D+-?0*/, '')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">{o.customerName || 'Cliente sin nombre'}</div>
                      <div className="text-xs text-slate-400">
                        {new Date(o.createdAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} ·{' '}
                        {CHANNEL_LABEL[o.channel]} · {DELIVERY_LABEL[o.deliveryType] ?? o.deliveryType}
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${status.className}`}>{status.label}</span>
                    <span className="font-mono text-sm font-bold text-slate-700 w-20 text-right shrink-0">{formatPesos(o.totalAmount)}</span>
                    <span className="material-symbols-rounded text-slate-400 shrink-0 transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}>
                      expand_more
                    </span>
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-2 animate-in fade-in slide-in-from-top-1">
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                        <div>
                          <span className="font-semibold text-slate-600">Consumido en: </span>
                          {DELIVERY_LABEL[o.deliveryType] ?? o.deliveryType}
                          {o.address ? ` — ${o.address}${o.locality ? ', ' + o.locality : ''}` : ''}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-600">Enviado por: </span>
                          {CHANNEL_LABEL[o.channel]} {o.customerPhone ? `· ${o.customerPhone}` : ''}
                        </div>
                      </div>
                      <ul className="space-y-1 text-sm">
                        {o.items.map((item) => (
                          <li key={item.id} className="flex justify-between">
                            <span>
                              {item.quantity}x {item.productNameSnapshot}
                              {item.notes && <span className="text-amber-700 text-xs"> · {item.notes}</span>}
                            </span>
                            <span className="font-mono text-slate-500">{formatPesos(item.unitPriceSnapshot * item.quantity)}</span>
                          </li>
                        ))}
                        {o.items.length === 0 && <li className="text-xs text-slate-400 italic">Pedido migrado sin items estructurados.</li>}
                      </ul>
                      {o.notes && <p className="text-xs bg-amber-50 text-amber-800 rounded-lg px-2 py-1.5">{o.notes}</p>}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
