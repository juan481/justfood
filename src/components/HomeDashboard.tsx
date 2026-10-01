'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AppHeader } from '@/components/AppHeader';
import { Footer } from '@/components/Footer';
import { useTenantSocket } from '@/hooks/useTenantSocket';
import { OpenTableModal } from '@/components/salon/OpenTableModal';
import { TableDrawer } from '@/components/salon/TableDrawer';
import { TableOrderModal } from '@/components/salon/TableOrderModal';
import { CloseTableModal } from '@/components/salon/CloseTableModal';

interface HomeSummary {
  tenantName: string;
  activeOrders: number;
  pendingPaymentReviews: number;
  todaysOrdersCount: number;
  todaysRevenue: number;
}

interface TableSummary {
  id: string;
  number: number;
  capacity: number;
  status: 'LIBRE' | 'OCUPADA' | 'ESPERANDO_PAGO';
  currentOrder: {
    id: string;
    orderCode: string;
    guestCount: number | null;
    waiterName: string | null;
    totalAmount: number;
    createdAt: string;
    items: { id: string }[];
  } | null;
}

const STATUS_META: Record<TableSummary['status'], { label: string; dot: string; card: string }> = {
  LIBRE: { label: 'Libre', dot: 'bg-emerald-500', card: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400' },
  OCUPADA: { label: 'Ocupada', dot: 'bg-red-500', card: 'bg-red-50 border-red-200 hover:border-red-400' },
  ESPERANDO_PAGO: { label: 'Esperando pago', dot: 'bg-blue-500', card: 'bg-blue-50 border-blue-200 hover:border-blue-400' },
};

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

export function HomeDashboard() {
  const { data: session } = useSession();
  const tenantId = session?.user?.tenantId;
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [openingTable, setOpeningTable] = useState<TableSummary | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [addingItemsTableId, setAddingItemsTableId] = useState<string | null>(null);
  const [closingTableId, setClosingTableId] = useState<string | null>(null);

  const loadTables = useCallback(async () => {
    const res = await fetch('/api/v1/admin/salon/tables');
    const data = await res.json();
    if (data.ok) setTables(data.tables);
  }, []);

  const { socket } = useTenantSocket(tenantId, loadTables);

  useEffect(() => {
    fetch('/api/v1/admin/home-summary').then((r) => r.json()).then((d) => d.ok && setSummary(d)).catch(() => {});
  }, []);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  useEffect(() => {
    const interval = setInterval(loadTables, 20000);
    return () => clearInterval(interval);
  }, [loadTables]);

  useEffect(() => {
    if (!socket) return;
    function handleTableChanged() {
      // El payload trae la mesa suelta — más simple (y menos propenso a
      // desincronizarse si dos mesas cambian casi juntas) recargar la
      // grilla entera que tratar de mergear un objeto parcial a mano.
      loadTables();
    }
    function handleOrderEvent() {
      loadTables();
    }
    socket.on('table:state-changed', handleTableChanged);
    socket.on('order:new', handleOrderEvent);
    socket.on('order:status-changed', handleOrderEvent);
    return () => {
      socket.off('table:state-changed', handleTableChanged);
      socket.off('order:new', handleOrderEvent);
      socket.off('order:status-changed', handleOrderEvent);
    };
  }, [socket, loadTables]);

  const money = (value: number) => '$' + value.toLocaleString('es-AR');
  const freeTables = tables.filter((t) => t.status === 'LIBRE').map((t) => ({ id: t.id, number: t.number }));
  const closingTable = tables.find((t) => t.id === closingTableId) ?? null;
  const addingItemsTable = tables.find((t) => t.id === addingItemsTableId) ?? null;

  async function openTable(tableId: string, input: { guestCount: number; waiterUserId: string; customerName?: string; notes?: string }) {
    const res = await fetch(`/api/v1/admin/salon/tables/${tableId}/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    return { ok: data.ok, error: data.error };
  }

  async function closeTable(tableId: string, paymentMethod: string) {
    const res = await fetch(`/api/v1/admin/salon/tables/${tableId}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod }),
    });
    const data = await res.json();
    return { ok: data.ok, error: data.error, pendingVerification: data.pendingVerification };
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <AppHeader tenantName={session?.user?.tenantSlug ?? ''} activeNav="home" />
      <main className="mx-auto w-full max-w-[1200px] flex-1 space-y-6 px-6 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">Salón{summary?.tenantName ? ' — ' + summary.tenantName : ''}</h1>
            <p className="text-sm text-slate-500">Tocá una mesa libre para abrirla, o una ocupada para ver el pedido.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon="receipt_long" label="Pedidos activos" value={summary ? String(summary.activeOrders) : '—'} tone="text-command-800" />
          <Stat icon="fact_check" label="Pagos por revisar" value={summary ? String(summary.pendingPaymentReviews) : '—'} tone="text-amber-600" />
          <Stat icon="today" label="Ventas de hoy" value={summary ? String(summary.todaysOrdersCount) + ' pedidos' : '—'} tone="text-emerald-600" />
          <Stat icon="payments" label="Facturado hoy" value={summary ? money(summary.todaysRevenue) : '—'} tone="text-sky-600" />
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          {(Object.keys(STATUS_META) as TableSummary['status'][]).map((status) => (
            <span key={status} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${STATUS_META[status].dot}`} />
              {STATUS_META[status].label}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {tables.map((table) => {
            const meta = STATUS_META[table.status];
            const itemCount = table.currentOrder?.items.length ?? 0;
            return (
              <button
                key={table.id}
                onClick={() => (table.status === 'LIBRE' ? setOpeningTable(table) : setSelectedTableId(table.id))}
                className={`relative aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all hover:-translate-y-0.5 hover:shadow-md ${meta.card}`}
              >
                <span className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                <span className="text-2xl font-extrabold text-slate-800">{table.number}</span>
                {table.status !== 'LIBRE' && table.currentOrder && (
                  <span className="text-[10px] text-slate-500 text-center leading-tight">
                    {table.currentOrder.guestCount != null ? `${table.currentOrder.guestCount}p · ` : ''}
                    {minutesSince(table.currentOrder.createdAt)}m
                    {itemCount > 0 && ` · ${itemCount} items`}
                  </span>
                )}
              </button>
            );
          })}
          {tables.length === 0 && (
            <p className="col-span-full text-center text-sm text-slate-400 py-10">
              Todavía no hay mesas cargadas — avisale a un administrador.
            </p>
          )}
        </div>
      </main>
      <Footer />

      {openingTable && (
        <OpenTableModal
          tableNumber={openingTable.number}
          onClose={() => setOpeningTable(null)}
          open={(input) => openTable(openingTable.id, input)}
          onOpened={() => {
            setOpeningTable(null);
            loadTables();
          }}
        />
      )}

      {selectedTableId && !addingItemsTableId && !closingTableId && (
        <TableDrawer
          tableId={selectedTableId}
          freeTables={freeTables}
          onClose={() => setSelectedTableId(null)}
          onAddItems={() => setAddingItemsTableId(selectedTableId)}
          onCloseTable={() => setClosingTableId(selectedTableId)}
          onChanged={loadTables}
        />
      )}

      {addingItemsTable && (
        <TableOrderModal
          tableId={addingItemsTable.id}
          tableNumber={addingItemsTable.number}
          onClose={() => setAddingItemsTableId(null)}
          onConfirmed={(orderId, itemsByStation) => {
            // Una ventana de ticket por estación que realmente tenga ítems
            // nuevos — SIN_IMPRESION nunca llega acá porque el endpoint ya
            // lo excluye de los grupos.
            Object.entries(itemsByStation).forEach(([station, items]) => {
              if (station === 'SIN_IMPRESION' || items.length === 0) return;
              const ids = items.map((i) => i.id).join(',');
              window.open(`/kds/print/${orderId}?station=${station}&items=${ids}`, '_blank', 'width=380,height=600');
            });
            setAddingItemsTableId(null);
            loadTables();
          }}
        />
      )}

      {closingTable && (
        <CloseTableModal
          tableNumber={closingTable.number}
          total={closingTable.currentOrder?.totalAmount ?? 0}
          onClose={() => setClosingTableId(null)}
          closeTable={(paymentMethod) => closeTable(closingTable.id, paymentMethod)}
          onClosed={() => {
            setClosingTableId(null);
            setSelectedTableId(null);
            loadTables();
          }}
        />
      )}
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={'material-symbols-rounded flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 ' + tone}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className={'text-lg font-extrabold ' + tone}>{value}</p>
      </div>
    </div>
  );
}
