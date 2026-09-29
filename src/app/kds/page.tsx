'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { AppHeader } from '@/components/AppHeader';
import { Footer } from '@/components/Footer';
import { OrderCard } from '@/components/kds/OrderCard';
import { KdsColumn } from '@/components/kds/KdsColumn';
import { TurnSummary, CompletedOrderRow } from '@/components/kds/TurnSummary';
import { OrderDetailDrawer } from '@/components/kds/OrderDetailDrawer';
import { NewOrderModal } from '@/components/kds/NewOrderModal';
import { useTenantSocket } from '@/hooks/useTenantSocket';
import { playNewOrderChime } from '@/lib/notification-sound';
import { formatPesos } from '@/lib/format';
import type { Order, OrderStatus } from '@/types/order';

const COLUMNS: { status: OrderStatus; label: string; shortLabel: string; dot: string; tint: string }[] = [
  { status: 'NUEVO', label: '1. Nuevos / Recibidos', shortLabel: '1. Nuevos', dot: 'bg-amber-500', tint: 'bg-amber-50/70' },
  { status: 'COCINA', label: '2. En Cocina / Horno', shortLabel: '2. En Cocina', dot: 'bg-orange-500', tint: 'bg-orange-50/70' },
  { status: 'REPARTO', label: '3. En Reparto / Viaje', shortLabel: '3. Reparto', dot: 'bg-blue-500', tint: 'bg-blue-50/70' },
];

type ChannelFilter = 'all' | 'delivery' | 'mostrador';
const DELIVERY_LABEL: Record<string, string> = { WEB: 'Web', MOSTRADOR: 'Mostrador', WHATSAPP: 'WhatsApp' };

export default function KdsPage() {
  const { data: session } = useSession();
  const tenantId = session?.user?.tenantId;

  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alertOrder, setAlertOrder] = useState<Order | null>(null);
  const [courierStats, setCourierStats] = useState({ connectedCount: 0, totalCouriers: 0 });
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [activeDragOrder, setActiveDragOrder] = useState<Order | null>(null);
  const [mobileColumn, setMobileColumn] = useState<OrderStatus>('NUEVO');
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const loadOrders = useCallback(async () => {
    const res = await fetch('/api/v1/admin/kds/orders');
    const data = await res.json();
    if (data.ok) setOrders(data.orders);

    const courierRes = await fetch('/api/v1/admin/couriers/summary');
    const courierData = await courierRes.json();
    if (courierData.ok) setCourierStats(courierData.stats);
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
    function handleNew(order: Order) {
      setOrders((prev) => [order, ...prev]);
      setAlertOrder(order);
      if (soundEnabledRef.current) playNewOrderChime();
      setTimeout(() => setAlertOrder((current) => (current?.id === order.id ? null : current)), 8000);
    }
    function handleStatusChanged(order: Order) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)));
      setSelectedOrder((prev) => (prev?.id === order.id ? order : prev));
    }
    socket.on('order:new', handleNew);
    socket.on('order:status-changed', handleStatusChanged);
    return () => {
      socket.off('order:new', handleNew);
      socket.off('order:status-changed', handleStatusChanged);
    };
  }, [socket]);

  async function advanceStatus(order: Order, status: OrderStatus, courierId?: string) {
    const res = await fetch(`/api/v1/admin/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, version: order.version, courierId: courierId ?? order.courierId ?? undefined }),
    });
    const data = await res.json();
    if (data.ok) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? data.order : o)));
      setSelectedOrder((prev) => (prev?.id === order.id ? data.order : prev));
    } else if (res.status === 409) {
      alert(data.error);
      loadOrders();
    } else {
      alert(data.error || 'No se pudo actualizar el pedido');
    }
  }

  async function cancelOrder(order: Order) {
    if (!confirm(`¿Cancelar el pedido #${order.orderCode}?`)) return;
    await advanceStatus(order, 'CANCELADO');
    setSelectedOrder(null);
  }

  function acceptFromAlert(order: Order) {
    setAlertOrder(null);
    advanceStatus(order, 'COCINA');
  }

  function handleDragStart(event: DragStartEvent) {
    const order = event.active.data.current?.order as Order | undefined;
    setActiveDragOrder(order ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragOrder(null);
    const order = event.active.data.current?.order as Order | undefined;
    const targetStatus = event.over?.id as OrderStatus | undefined;
    if (!order || !targetStatus || targetStatus === order.status) return;
    // Don't re-validate the transition graph here — the backend already
    // enforces VALID_TRANSITIONS (forward *and* the "volver un paso atrás"
    // backward moves) and answers with a 409 + alert() via advanceStatus
    // for anything illegal. Duplicating a narrower forward-only check here
    // was silently swallowing every backward drag before a request was
    // even sent.
    advanceStatus(order, targetStatus);
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (channelFilter === 'delivery' && o.deliveryType !== 'delivery') return false;
      if (channelFilter === 'mostrador' && o.deliveryType !== 'mostrador') return false;
      if (search) {
        const q = search.toLowerCase();
        const matches =
          o.orderCode.toLowerCase().includes(q) ||
          (o.customerName ?? '').toLowerCase().includes(q) ||
          o.items.some((i) => i.productNameSnapshot.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [orders, channelFilter, search]);

  const activeOrders = filteredOrders.filter((o) => o.status !== 'ENTREGADO' && o.status !== 'CANCELADO');
  const deliveredToday = filteredOrders.filter((o) => o.status === 'ENTREGADO');
  const lateCount = activeOrders.filter((o) => Date.now() - new Date(o.createdAt).getTime() > 25 * 60000).length;
  const avgDispatchMin =
    deliveredToday.length > 0
      ? Math.round(
          deliveredToday.reduce((sum, o) => sum + (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()), 0) /
            deliveredToday.length /
            60000
        )
      : 0;
  const deliveryCount = orders.filter((o) => o.deliveryType === 'delivery').length;
  const mostradorCount = orders.filter((o) => o.deliveryType !== 'delivery').length;

  const emptyBoard = orders.length === 0;

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <AppHeader
        tenantName={session?.user?.tenantSlug ?? ''}
        activeNav="kds"
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((s) => !s)}
        live={connected}
      />

      {/* New-order alert banner */}
      {alertOrder && (
        <div className="sticky top-0 z-40 px-4 pt-3">
          <div className="max-w-[1400px] mx-auto bg-white border-2 border-emerald-300 rounded-2xl shadow-2xl p-3 flex items-center gap-3 flex-wrap animate-in fade-in slide-in-from-top-3 duration-300">
            <span className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 animate-pulse">
              <span className="material-symbols-rounded text-white text-xl">notifications_active</span>
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm text-red-600">🔔 ¡NUEVO PEDIDO ENTRANTE!</span>
                <span className="font-mono text-xs font-bold text-command-800">#{alertOrder.orderCode.replace(/^\D+-?0*/, '')}</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                  {DELIVERY_LABEL[alertOrder.channel]} {alertOrder.deliveryType === 'delivery' ? 'Delivery' : 'Retiro'}
                </span>
                {soundEnabled && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold flex items-center gap-1">
                    <span className="material-symbols-rounded text-xs">volume_up</span>
                    Sonido: Ding Dong sonando...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate">
                {alertOrder.customerName || 'Cliente'} {alertOrder.address ? `· ${alertOrder.address}` : ''} ·{' '}
                <span className="font-mono font-semibold text-slate-700">{formatPesos(alertOrder.totalAmount)}</span> (
                {alertOrder.paymentMethod === 'efectivo' ? 'Cobrar' : 'Pagado'} {alertOrder.paymentMethod}) —{' '}
                {alertOrder.items.map((i) => `${i.quantity}x ${i.productNameSnapshot}`).join(', ')}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setSelectedOrder(alertOrder)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors"
              >
                Ver Comanda
              </button>
              <button
                onClick={() => acceptFromAlert(alertOrder)}
                className="px-4 py-2 rounded-xl bg-command-800 hover:bg-command-900 text-white text-xs font-semibold flex items-center gap-1.5 transition-all hover:scale-105"
              >
                <span className="material-symbols-rounded text-sm">check_circle</span>
                Aceptar e Ingresar a Cocina
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: search + stats + filters */}
      <div className="bg-white border-b border-slate-100 px-4 sm:px-6 py-3 space-y-3">
        <div className="max-w-[1920px] mx-auto space-y-3">
          <div className="relative">
            <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por # comanda, cliente o ítem..."
              className="w-full pl-10 pr-4 py-2 bg-slate-100 hover:bg-slate-50 focus:bg-white border-0 ring-1 ring-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-command-800 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <div className="bg-slate-50 sm:bg-slate-100 rounded-xl px-3 py-2 sm:py-1.5 flex sm:inline-flex flex-col sm:flex-row items-center sm:items-center gap-0.5 sm:gap-1.5 text-slate-600">
              <span className="material-symbols-rounded text-base sm:text-sm">receipt_long</span>
              <span className="font-bold text-sm sm:text-xs">{activeOrders.length}</span>
              <span className="text-[10px] sm:text-xs font-semibold text-center sm:text-left">Comandas Activas</span>
            </div>
            <div className="bg-blue-50 rounded-xl px-3 py-2 sm:py-1.5 flex sm:inline-flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 text-blue-700">
              <span className="material-symbols-rounded text-base sm:text-sm">schedule</span>
              <span className="font-bold text-sm sm:text-xs">{avgDispatchMin}m</span>
              <span className="text-[10px] sm:text-xs font-semibold text-center sm:text-left">Despacho prom.</span>
            </div>
            <div className={`rounded-xl px-3 py-2 sm:py-1.5 flex sm:inline-flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 ${lateCount > 0 ? 'bg-red-50 text-red-700 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
              <span className="material-symbols-rounded text-base sm:text-sm">warning</span>
              <span className="font-bold text-sm sm:text-xs">{lateCount}</span>
              <span className="text-[10px] sm:text-xs font-semibold text-center sm:text-left">Demorada{lateCount !== 1 ? 's' : ''}</span>
            </div>
            <a
              href="/cadetes"
              className="bg-emerald-50 hover:bg-emerald-100 transition-colors rounded-xl px-3 py-2 sm:py-1.5 flex sm:inline-flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 text-emerald-700"
            >
              <span className="material-symbols-rounded text-base sm:text-sm">moped</span>
              <span className="font-bold text-sm sm:text-xs">
                {courierStats.connectedCount}/{courierStats.totalCouriers}
              </span>
              <span className="text-[10px] sm:text-xs font-semibold text-center sm:text-left">Cadetes</span>
            </a>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1 w-fit">
            {([
              ['all', `Todos (${orders.length})`],
              ['delivery', `🛵 Delivery (${deliveryCount})`],
              ['mostrador', `🏬 Retiro (${mostradorCount})`],
            ] as [ChannelFilter, string][]).map(([f, label]) => (
              <button
                key={f}
                onClick={() => setChannelFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  channelFilter === f ? 'bg-white text-command-950 shadow-sm scale-[1.02]' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile column tabs */}
      <div className="md:hidden bg-white border-b border-slate-100 px-4 py-2 flex items-center gap-2 overflow-x-auto custom-scrollbar">
        {COLUMNS.map((col) => {
          const count = filteredOrders.filter((o) => o.status === col.status).length;
          return (
            <button
              key={col.status}
              onClick={() => setMobileColumn(col.status)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mobileColumn === col.status ? 'bg-command-800 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${col.dot}`} />
              {col.shortLabel}
              <span className="px-1.5 rounded-full bg-black/10 text-[10px]">{count}</span>
            </button>
          );
        })}
        <button
          onClick={() => setMobileColumn('ENTREGADO')}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mobileColumn === 'ENTREGADO' ? 'bg-command-800 text-white' : 'bg-slate-100 text-slate-500'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          4. Entregados
          <span className="px-1.5 rounded-full bg-black/10 text-[10px]">{deliveredToday.length}</span>
        </button>
      </div>

      <main className="flex-1 max-w-[1920px] w-full mx-auto px-4 sm:px-6 py-6">
        {emptyBoard ? (
          <div className="mt-16 flex flex-col items-center text-center gap-3 animate-in fade-in">
            <div className="w-16 h-16 rounded-2xl bg-white border-2 border-dashed border-slate-200 flex items-center justify-center">
              <span className="material-symbols-rounded text-3xl text-slate-300">restaurant</span>
            </div>
            <p className="text-slate-500 font-medium">Cocina al día y en orden</p>
            <p className="text-xs text-slate-400">Los pedidos nuevos van a aparecer acá en tiempo real.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
              {COLUMNS.map((col) => {
                const columnOrders = filteredOrders.filter((o) => o.status === col.status);
                return (
                  <div key={col.status} className={mobileColumn === col.status ? 'block' : 'hidden md:block'}>
                    <KdsColumn status={col.status} label={col.label} count={columnOrders.length} dot={col.dot} tint={col.tint}>
                      {columnOrders.map((order) => (
                        <OrderCard key={order.id} order={order} onOpenDetail={() => setSelectedOrder(order)} onAdvance={advanceStatus} />
                      ))}
                    </KdsColumn>
                  </div>
                );
              })}

              <div className={`rounded-2xl p-3 space-y-3 bg-emerald-50/50 min-h-[200px] ${mobileColumn === 'ENTREGADO' ? 'block' : 'hidden md:block'}`}>
                <div className="flex items-center gap-2 px-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <h2 className="font-bold text-sm text-slate-700">4. Entregados (Hoy)</h2>
                  <span className="px-2 py-0.5 rounded-full bg-white/70 text-slate-600 text-xs font-semibold">
                    {deliveredToday.length}
                  </span>
                </div>
                <TurnSummary deliveredToday={deliveredToday} />
                <div className="space-y-2">
                  {deliveredToday
                    .slice()
                    .reverse()
                    .map((order) => (
                      <CompletedOrderRow key={order.id} order={order} onOpenDetail={() => setSelectedOrder(order)} />
                    ))}
                  {deliveredToday.length === 0 && (
                    <p className="text-center text-xs text-slate-400 py-6">Comandas completadas pasan automáticamente acá</p>
                  )}
                </div>
              </div>
            </div>

            <DragOverlay>
              {activeDragOrder && (
                <div className="rotate-2 scale-105 shadow-2xl rounded-2xl">
                  <OrderCard order={activeDragOrder} onOpenDetail={() => {}} onAdvance={() => {}} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </main>
      <Footer />

      <button
        onClick={() => setShowNewOrderModal(true)}
        className="fixed bottom-8 right-8 z-40 inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-command-700 hover:bg-command-800 text-white font-semibold text-sm shadow-xl hover:shadow-2xl border border-white/20 transition-all active:scale-[0.98] hover:scale-105"
        style={{ boxShadow: '0 10px 25px -5px rgba(6, 56, 26, 0.4)' }}
      >
        <span className="material-symbols-rounded text-xl text-limeaccent">add_circle</span>
        Nuevo Pedido
      </button>

      <OrderDetailDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} onAdvance={advanceStatus} onCancel={cancelOrder} />

      {showNewOrderModal && (
        <NewOrderModal
          onClose={() => setShowNewOrderModal(false)}
          onCreated={(orderId, autoprint) => {
            setShowNewOrderModal(false);
            loadOrders();
            if (autoprint) {
              window.open(`/kds/print/${orderId}`, '_blank', 'width=380,height=600');
            }
          }}
        />
      )}
    </div>
  );
}
