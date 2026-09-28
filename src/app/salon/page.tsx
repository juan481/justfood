'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AppHeader } from '@/components/AppHeader';
import { Footer } from '@/components/Footer';

interface Reservation {
  id: string;
  customerName: string;
  customerPhone: string | null;
  reservationDate: string;
  timeSlot: string;
  peopleCount: number;
  tableCapacityUsed: number;
  status: string;
  notes: string | null;
}
interface TableRow {
  id: string;
  capacity: number;
  quantity: number;
  label: string | null;
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  confirmada: { label: 'Confirmada', className: 'bg-emerald-100 text-emerald-700' },
  cancelada: { label: 'Cancelada / Liberada', className: 'bg-red-100 text-red-700' },
  completada: { label: 'Completada', className: 'bg-slate-100 text-slate-500' },
};
const TABLE_ICONS = ['groups_2', 'diversity_3', 'people', 'groups'];

function turnoDe(timeSlot: string): 'Almuerzo' | 'Cena' {
  const hour = Number(timeSlot.split(':')[0]);
  return hour < 17 ? 'Almuerzo' : 'Cena';
}

function NewTableForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [capacity, setCapacity] = useState(2);
  const [quantity, setQuantity] = useState(1);

  async function submit() {
    const res = await fetch('/api/v1/admin/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacity, quantity }),
    });
    if (res.ok) {
      setOpen(false);
      onCreated();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-command-800 hover:bg-command-900 text-white font-semibold text-sm transition-all hover:scale-105"
      >
        <span className="material-symbols-rounded text-base">add</span>
        Nueva Mesa
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-2 animate-in fade-in">
      <label className="text-xs text-slate-500 flex items-center gap-1">
        Capacidad
        <input type="number" min={1} className="w-14 px-1.5 py-1 border border-slate-200 rounded text-sm" value={capacity} onChange={(e) => setCapacity(Number(e.target.value) || 1)} />
      </label>
      <label className="text-xs text-slate-500 flex items-center gap-1">
        Cantidad
        <input type="number" min={1} className="w-14 px-1.5 py-1 border border-slate-200 rounded text-sm" value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 1)} />
      </label>
      <button onClick={submit} className="px-3 py-1.5 rounded-lg bg-command-800 text-white text-xs font-semibold">
        Crear
      </button>
      <button onClick={() => setOpen(false)} className="px-2 py-1.5 text-xs text-slate-400">
        ✕
      </button>
    </div>
  );
}

export default function SalonPage() {
  const { data: session } = useSession();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [showAll, setShowAll] = useState(false);

  async function load() {
    const res = await fetch(`/api/v1/admin/reservations?from=${showAll ? '2000-01-01' : selectedDate}`);
    const data = await res.json();
    if (data.ok) {
      setReservations(data.reservations);
      setTables(data.tables);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, showAll]);

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/v1/admin/reservations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function changeTableQty(table: TableRow, delta: number) {
    const quantity = Math.max(0, table.quantity + delta);
    setTables((prev) => prev.map((t) => (t.id === table.id ? { ...t, quantity } : t)));
    await fetch(`/api/v1/admin/tables/${table.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity }),
    });
  }

  async function deleteTable(id: string) {
    if (!confirm('¿Eliminar este tipo de mesa?')) return;
    await fetch(`/api/v1/admin/tables/${id}`, { method: 'DELETE' });
    load();
  }

  const totalTables = tables.reduce((sum, t) => sum + t.quantity, 0);
  const totalCapacity = tables.reduce((sum, t) => sum + t.capacity * t.quantity, 0);

  const todaysReservations = useMemo(
    () => reservations.filter((r) => r.reservationDate === selectedDate && r.status !== 'cancelada'),
    [reservations, selectedDate]
  );
  const almuerzoUsed = todaysReservations.filter((r) => turnoDe(r.timeSlot) === 'Almuerzo').length;
  const cenaUsed = todaysReservations.filter((r) => turnoDe(r.timeSlot) === 'Cena').length;

  const visibleReservations = showAll ? reservations : reservations.filter((r) => r.reservationDate === selectedDate);

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <AppHeader tenantName={session?.user?.tenantSlug ?? ''} activeNav="salon" />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 sm:px-8 py-6 space-y-5 animate-in fade-in duration-300">
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in">
          <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
            <span className="material-symbols-rounded text-command-800">calendar_month</span>
          </span>
          <div className="text-xs text-slate-600 space-y-1">
            <p className="font-bold text-sm text-slate-800">¿Cómo funciona el módulo de Reservas y Salón?</p>
            <p>
              <strong>Inventario físico de mesas:</strong> configurá abajo cuántas mesas reales tenés operativas por
              capacidad.
            </p>
            <p>
              <strong>Descuento automático de cupos:</strong> cuando un cliente reserva para una fecha y turno (Almuerzo
              o Cena), el sistema descuenta la mesa adecuada en tiempo real, bloqueando el turno ante falta de stock.
            </p>
            <p>
              <strong>Gestión de estados:</strong> marcá las reservas como <em>Completada</em> cuando asisten, o{' '}
              <em>Liberar / Cancelar</em> si avisan cancelación para restituir la disponibilidad de inmediato.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-bold text-sm text-slate-700 flex items-center gap-2">
                Capacidad e Inventario del Salón
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-semibold">{totalTables} mesas en total</span>
              </h2>
              <p className="text-xs text-slate-500">Capacidad máx. {totalCapacity} personas</p>
            </div>
            <NewTableForm onCreated={load} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {tables.map((t, i) => (
              <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2 hover:shadow-md transition-shadow animate-in fade-in">
                <div className="flex items-start justify-between">
                  <span className="material-symbols-rounded text-command-800">{TABLE_ICONS[i % TABLE_ICONS.length]}</span>
                  <div className="flex gap-1">
                    <button onClick={() => deleteTable(t.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                      <span className="material-symbols-rounded text-sm">delete</span>
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">{t.label ?? `Mesas para ${t.capacity}`}</div>
                  <div className="text-[11px] text-slate-400">Capacidad: {t.capacity} personas</div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  Mesas físicas:
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => changeTableQty(t, -1)} className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 font-bold transition-colors">
                      −
                    </button>
                    <span className="w-6 text-center font-bold text-slate-800">{t.quantity}</span>
                    <button onClick={() => changeTableQty(t, 1)} className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 font-bold transition-colors">
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-bold text-sm text-slate-700 flex items-center gap-2">
              Listado de Reservas Registradas
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-semibold">{visibleReservations.length} reservas</span>
            </h2>
            <div className="flex items-center gap-2">
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs" />
              <button
                onClick={() => setShowAll((s) => !s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${showAll ? 'bg-command-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                Ver Todas
              </button>
              <button onClick={load} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                <span className="material-symbols-rounded text-sm">refresh</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold">Código</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Fecha & Turno</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Cliente</th>
                  <th className="text-left px-3 py-2.5 font-semibold hidden sm:table-cell">Teléfono</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Personas</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Estado</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && visibleReservations.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                      Sin reservas para esta fecha.
                    </td>
                  </tr>
                )}
                {visibleReservations.map((r) => {
                  const meta = STATUS_META[r.status] ?? STATUS_META.confirmada;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-xs font-bold text-command-800">#RES-{r.id.slice(-4)}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {r.reservationDate}
                        <div className="text-slate-400 flex items-center gap-1">
                          <span className="material-symbols-rounded text-[13px]">{turnoDe(r.timeSlot) === 'Almuerzo' ? 'wb_sunny' : 'nightlight'}</span>
                          Turno {turnoDe(r.timeSlot)} ({r.timeSlot} hs)
                        </div>
                      </td>
                      <td className="px-3 py-2.5">{r.customerName}</td>
                      <td className="px-3 py-2.5 hidden sm:table-cell text-slate-500">{r.customerPhone}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">
                        {r.peopleCount} pers
                        <div>Mesa {r.tableCapacityUsed}p</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.className}`}>{meta.label.toUpperCase()}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {r.status === 'confirmada' && (
                          <div className="flex gap-1.5 justify-end">
                            <button onClick={() => updateStatus(r.id, 'completada')} className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-semibold transition-colors">
                              Completar
                            </button>
                            <button onClick={() => updateStatus(r.id, 'cancelada')} className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-500 transition-colors">
                              Liberar
                            </button>
                          </div>
                        )}
                        {r.status === 'cancelada' && (
                          <button onClick={() => updateStatus(r.id, 'confirmada')} className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-500 transition-colors">
                            Reactivar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-400 px-1">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Cupo Almuerzo: {Math.max(0, totalTables - almuerzoUsed)} / {totalTables} mesas libres
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                Cupo Cena: {Math.max(0, totalTables - cenaUsed)} / {totalTables} mesas libres
              </span>
            </div>
            <span className="flex items-center gap-1">
              <span className="material-symbols-rounded text-xs">bolt</span>
              Descuento automático de cupo activo por reserva web
            </span>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
