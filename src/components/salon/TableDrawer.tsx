'use client';

import { useEffect, useState } from 'react';
import { formatPesos } from '@/lib/format';
import type { Order } from '@/types/order';

export interface TableWithOrder {
  id: string;
  number: number;
  capacity: number;
  status: 'LIBRE' | 'OCUPADA' | 'ESPERANDO_PAGO';
  currentOrder: Order | null;
}

interface Staff {
  id: string;
  username: string;
}

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

interface TableDrawerProps {
  tableId: string;
  freeTables: { id: string; number: number }[];
  onClose: () => void;
  onAddItems: () => void;
  onCloseTable: () => void;
  onChanged: () => void;
}

// Panel lateral único para CUALQUIER clic en una mesa — libre, ocupada o en
// pre-cuenta. Antes, una mesa libre abría un modal centrado (distinto al
// panel lateral de una mesa ocupada); UX pidió que sea siempre el mismo
// lugar/animación, nada de pop-up.
export function TableDrawer({ tableId, freeTables, onClose, onAddItems, onCloseTable, onChanged }: TableDrawerProps) {
  const [table, setTable] = useState<TableWithOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMovePicker, setShowMovePicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formulario de apertura (solo se usa si la mesa está LIBRE).
  const [staff, setStaff] = useState<Staff[]>([]);
  const [guestCount, setGuestCount] = useState('');
  const [waiterUserId, setWaiterUserId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [openNotes, setOpenNotes] = useState('');

  function load() {
    setLoading(true);
    fetch(`/api/v1/admin/salon/tables/${tableId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setTable(d.table);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
    fetch('/api/v1/admin/staff')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setStaff(d.staff);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  async function openTable() {
    const guests = parseInt(guestCount, 10);
    if (!Number.isSafeInteger(guests) || guests < 1) {
      setError('Ingresá la cantidad de comensales.');
      return;
    }
    if (!waiterUserId) {
      setError('Elegí quién atiende la mesa.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/v1/admin/salon/tables/${tableId}/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestCount: guests, waiterUserId, customerName: customerName || undefined, notes: openNotes || undefined }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) return setError(data.error);
    load();
    onChanged();
  }

  async function preBill() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/v1/admin/salon/tables/${tableId}/pre-bill`, { method: 'POST' });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) return setError(data.error);
    if (table?.currentOrder) {
      window.open(`/kds/print/${table.currentOrder.id}`, '_blank', 'width=380,height=600');
    }
    load();
    onChanged();
  }

  async function reopen() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/v1/admin/salon/tables/${tableId}/reopen`, { method: 'POST' });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) return setError(data.error);
    load();
    onChanged();
  }

  async function moveTo(targetTableId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/v1/admin/salon/tables/${tableId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetTableId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) return setError(data.error);
    onChanged();
    onClose();
  }

  if (loading || !table) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-command-950/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex items-center justify-center">
          <p className="text-sm text-slate-400">Cargando mesa...</p>
        </div>
      </div>
    );
  }

  if (table.status === 'LIBRE') {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-command-950/60 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
        <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          <div className="bg-gradient-to-r from-command-950 via-command-900 to-command-800 text-white p-5 flex items-center justify-between shrink-0">
            <span className="font-bold text-lg">Abrir Mesa {table.number}</span>
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
              <span className="material-symbols-rounded">close</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Comensales</span>
              <input
                autoFocus
                type="number"
                min={1}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-command-800"
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value.replace(/\D/g, ''))}
                placeholder="Ej: 4"
                onKeyDown={(e) => e.key === 'Enter' && openTable()}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Mozo</span>
              <select
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-command-800"
                value={waiterUserId}
                onChange={(e) => setWaiterUserId(e.target.value)}
              >
                <option value="">Elegir...</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.username}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Cliente (opcional)</span>
              <input
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-command-800"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Notas (opcional)</span>
              <input
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-command-800"
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
                placeholder="Ej: juntan dos mesas"
              />
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
          <div className="p-5 border-t border-slate-200 shrink-0">
            <button
              onClick={openTable}
              disabled={busy}
              className="w-full py-3 rounded-xl bg-command-800 hover:bg-command-900 text-white font-bold text-sm uppercase tracking-wide transition-all disabled:opacity-50"
            >
              {busy ? 'Abriendo...' : 'Abrir mesa'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const order = table.currentOrder;
  const elapsedMin = order ? minutesSince(order.createdAt) : 0;
  const isLockedPendingPayment = table.status === 'ESPERANDO_PAGO' && order?.status === 'EN_ESPERA_PAGO';
  const isPreBill = table.status === 'ESPERANDO_PAGO' && order?.status === 'NUEVO';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-command-950/60 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="bg-gradient-to-r from-command-950 via-command-900 to-command-800 text-white p-5 space-y-1 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-lg">Mesa {table.number}</span>
              {isPreBill && <span className="px-2 py-0.5 rounded-full bg-blue-400/80 text-[10px] font-bold">Pre-cuenta</span>}
              {isLockedPendingPayment && <span className="px-2 py-0.5 rounded-full bg-blue-400/80 text-[10px] font-bold">Esperando pago</span>}
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
              <span className="material-symbols-rounded">close</span>
            </button>
          </div>
          {order && (
            <p className="text-[11px] text-white/60">
              {order.waiterName ? `Mozo: ${order.waiterName} · ` : ''}
              {order.guestCount != null ? `${order.guestCount} comensales · ` : ''}
              Hace {elapsedMin} min
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {order?.customerName && <p className="text-sm text-slate-600">{order.customerName}</p>}
          {order?.notes && (
            <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
              <span className="material-symbols-rounded text-sm shrink-0">sticky_note_2</span>
              <span className="whitespace-pre-line">{order.notes}</span>
            </div>
          )}

          <div>
            <div className="font-bold text-slate-800 mb-2 text-sm">Ítems ({order?.items.length ?? 0})</div>
            <ul className="space-y-2">
              {(order?.items ?? []).map((item) => (
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
                      {item.notes}
                    </span>
                  )}
                </li>
              ))}
              {(order?.items.length ?? 0) === 0 && <li className="text-xs text-slate-400">Todavía no hay ítems cargados.</li>}
            </ul>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between">
            <span className="font-bold text-slate-800 text-sm">Subtotal</span>
            <span className="font-mono font-bold text-command-950">{formatPesos(order?.totalAmount ?? 0)}</span>
          </div>

          {isLockedPendingPayment && (
            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
              Esta mesa está cerrada, esperando que se apruebe el comprobante en <strong>Pagos por Revisar</strong>. Se libera sola apenas se confirme.
            </p>
          )}

          {showMovePicker && (
            <div className="border border-slate-200 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-slate-600">Mover a qué mesa:</p>
              <div className="grid grid-cols-4 gap-1.5">
                {freeTables.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => moveTo(t.id)}
                    disabled={busy}
                    className="py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors"
                  >
                    {t.number}
                  </button>
                ))}
                {freeTables.length === 0 && <p className="col-span-4 text-xs text-slate-400">No hay mesas libres.</p>}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        {!isLockedPendingPayment && (
          <div className="p-5 border-t border-slate-200 space-y-2 sticky bottom-0 bg-white shrink-0">
            {isPreBill ? (
              <button
                onClick={reopen}
                disabled={busy}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-rounded text-base">undo</span>
                Reabrir (agregar algo más)
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onAddItems}
                  className="py-2.5 rounded-xl bg-command-800 hover:bg-command-900 text-white font-semibold text-xs uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-rounded text-base">add</span>
                  Sumar ítems
                </button>
                <button
                  onClick={preBill}
                  disabled={busy}
                  className="py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-rounded text-base">receipt_long</span>
                  Pre-cuenta
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowMovePicker((v) => !v)}
                className="py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-rounded text-base">swap_horiz</span>
                Mover mesa
              </button>
              <button
                onClick={onCloseTable}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-rounded text-base">point_of_sale</span>
                Cerrar mesa
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
