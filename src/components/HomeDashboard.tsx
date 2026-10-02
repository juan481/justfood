'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AppHeader } from '@/components/AppHeader';
import { Footer } from '@/components/Footer';
import { useTenantSocket } from '@/hooks/useTenantSocket';
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
      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-3 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-extrabold text-slate-800">Salón{summary?.tenantName ? ' — ' + summary.tenantName : ''}</h1>
            <div className="hidden items-center gap-3 text-[11px] text-slate-500 sm:flex">
              {(Object.keys(STATUS_META) as TableSummary['status'][]).map((status) => (
                <span key={status} className="flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${STATUS_META[status].dot}`} />
                  {STATUS_META[status].label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>
              Activos: <strong className="text-command-800">{summary ? summary.activeOrders : '—'}</strong>
            </span>
            <span>
              Por revisar: <strong className="text-amber-600">{summary ? summary.pendingPaymentReviews : '—'}</strong>
            </span>
            <span>
              Hoy: <strong className="text-emerald-600">{summary ? summary.todaysOrdersCount : '—'} pedidos</strong>
            </span>
            <span>
              Facturado: <strong className="text-sky-600">{summary ? money(summary.todaysRevenue) : '—'}</strong>
            </span>
          </div>
        </div>

        <div className="grid flex-1 content-start grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {tables.map((table) => {
            const meta = STATUS_META[table.status];
            const itemCount = table.currentOrder?.items.length ?? 0;
            return (
              <button
                key={table.id}
                onClick={() => setSelectedTableId(table.id)}
                className={`relative aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all hover:-translate-y-0.5 hover:shadow-md ${meta.card}`}
              >
                <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${meta.dot}`} />
                <span className="text-lg font-extrabold text-slate-800">{table.number}</span>
                {table.status !== 'LIBRE' && table.currentOrder && (
                  <span className="text-[9px] text-slate-500 text-center leading-tight">
                    {table.currentOrder.guestCount != null ? `${table.currentOrder.guestCount}p · ` : ''}
                    {minutesSince(table.currentOrder.createdAt)}m
                    {itemCount > 0 && ` · ${itemCount}i`}
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
