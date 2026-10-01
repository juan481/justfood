'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AppHeader } from '@/components/AppHeader';
import { Footer } from '@/components/Footer';
import { useTenantSocket } from '@/hooks/useTenantSocket';
import { playNewOrderChime } from '@/lib/notification-sound';
import type { Order } from '@/types/order';

// Estructuralmente igual a /kds (AppHeader, alerta+sonido, useTenantSocket)
// pero a una sola columna, alimentada por /api/v1/admin/barra/orders — ese
// endpoint YA filtra server-side a solo los ítems de estación Barra sin
// preparar, Barra nunca recibe comida en la respuesta.
export default function BarraPage() {
  const { data: session } = useSession();
  const tenantId = session?.user?.tenantId;
  const [orders, setOrders] = useState<Order[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const loadOrders = useCallback(async () => {
    const res = await fetch('/api/v1/admin/barra/orders');
    const data = await res.json();
    if (data.ok) setOrders(data.orders);
  }, []);

  const { socket, connected } = useTenantSocket(tenantId, loadOrders);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const interval = setInterval(loadOrders, 20000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  useEffect(() => {
    if (!socket) return;
    function handleEvent() {
      loadOrders();
      if (soundEnabled) playNewOrderChime();
    }
    socket.on('order:new', handleEvent);
    socket.on('order:status-changed', handleEvent);
    return () => {
      socket.off('order:new', handleEvent);
      socket.off('order:status-changed', handleEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, soundEnabled]);

  async function markPrepared(itemId: string) {
    await fetch(`/api/v1/admin/barra/items/${itemId}/prepared`, { method: 'PATCH' });
    loadOrders();
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <AppHeader
        tenantName={session?.user?.tenantSlug ?? ''}
        activeNav="barra"
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((v) => !v)}
        live={connected}
      />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8 sm:px-8 space-y-3">
        <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
          <span className="material-symbols-rounded text-sky-600">local_bar</span>
          Barra
        </h1>
        {orders.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-10 bg-white rounded-2xl border border-slate-200">
            Sin tragos/bebidas pendientes.
          </p>
        )}
        {orders.map((order) => (
          <div key={order.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">Mesa {order.table?.number ?? '—'}</span>
              <span className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <ul className="space-y-1.5">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="font-bold mr-1.5">{item.quantity}x</span>
                    {item.productNameSnapshot}
                    {item.notes && <span className="block text-[11px] text-amber-700">* {item.notes}</span>}
                  </span>
                  <button
                    onClick={() => markPrepared(item.id)}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors"
                  >
                    Listo
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </main>
      <Footer />
    </div>
  );
}
