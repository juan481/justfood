'use client';

import { useEffect, useState } from 'react';

interface Staff {
  id: string;
  username: string;
  role: string;
}

interface OpenTableModalProps {
  tableNumber: number;
  onClose: () => void;
  onOpened: () => void;
  open: (input: { guestCount: number; waiterUserId: string; customerName?: string; notes?: string }) => Promise<{ ok: boolean; error?: string }>;
}

export function OpenTableModal({ tableNumber, onClose, onOpened, open }: OpenTableModalProps) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [guestCount, setGuestCount] = useState('');
  const [waiterUserId, setWaiterUserId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/admin/staff')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setStaff(d.staff);
      });
  }, []);

  async function submit() {
    const guests = parseInt(guestCount, 10);
    if (!Number.isSafeInteger(guests) || guests < 1) {
      setError('Ingresá la cantidad de comensales.');
      return;
    }
    if (!waiterUserId) {
      setError('Elegí quién atiende la mesa.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await open({ guestCount: guests, waiterUserId, customerName: customerName || undefined, notes: notes || undefined });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || 'No se pudo abrir la mesa');
      return;
    }
    onOpened();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md animate-in fade-in" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <div className="bg-gradient-to-r from-command-950 via-command-900 to-command-800 text-white px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-base">Abrir Mesa {tableNumber}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>
        <div className="p-5 space-y-3">
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
              placeholder="Nombre (opcional)"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Notas (opcional)</span>
            <input
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-command-800"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: juntan dos mesas"
            />
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-semibold uppercase transition-colors">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-command-800 hover:bg-command-900 text-white font-bold text-xs uppercase tracking-wide transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            {submitting ? 'Abriendo...' : 'Abrir mesa'}
          </button>
        </div>
      </div>
    </div>
  );
}
