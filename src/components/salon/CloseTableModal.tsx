'use client';

import { useState } from 'react';
import { formatPesos } from '@/lib/format';

const PAYMENT_METHODS: { key: string; label: string; icon: string; gated?: boolean }[] = [
  { key: 'efectivo', label: 'Efectivo', icon: 'payments' },
  { key: 'debito', label: 'Débito', icon: 'credit_card' },
  { key: 'credito', label: 'Crédito', icon: 'credit_card' },
  { key: 'mercadopago', label: 'Mercado Pago', icon: 'qr_code_2', gated: true },
  { key: 'transferencia', label: 'Transferencia', icon: 'account_balance', gated: true },
];

interface CloseTableModalProps {
  tableNumber: number;
  total: number;
  onClose: () => void;
  onClosed: (pendingVerification: boolean) => void;
  closeTable: (paymentMethod: string) => Promise<{ ok: boolean; error?: string; pendingVerification?: boolean }>;
}

export function CloseTableModal({ tableNumber, total, onClose, onClosed, closeTable }: CloseTableModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!paymentMethod) {
      setError('Elegí el medio de pago.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await closeTable(paymentMethod);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || 'No se pudo cerrar la mesa');
      return;
    }
    onClosed(!!result.pendingVerification);
  }

  const selectedMeta = PAYMENT_METHODS.find((m) => m.key === paymentMethod);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md animate-in fade-in" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <div className="bg-gradient-to-r from-command-950 via-command-900 to-command-800 text-white px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-base">Cerrar Mesa {tableNumber}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex justify-between items-baseline bg-slate-50 rounded-xl px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Total a pagar</span>
            <span className="font-mono font-extrabold text-xl text-command-950">{formatPesos(total)}</span>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Medio de pago</span>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setPaymentMethod(m.key)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    paymentMethod === m.key ? 'bg-command-800 text-white scale-[1.02]' : 'bg-white border border-slate-200 text-slate-500 hover:border-command-300'
                  }`}
                >
                  <span className="material-symbols-rounded text-base">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {selectedMeta?.gated && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-1.5">
              <span className="material-symbols-rounded text-sm shrink-0">info</span>
              La mesa queda en azul hasta que se apruebe el comprobante en &quot;Pagos por Revisar&quot;.
            </p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-semibold uppercase transition-colors">
            Cancelar
          </button>
          <button
            onClick={confirm}
            disabled={submitting || !paymentMethod}
            className="px-6 py-2.5 rounded-xl bg-command-800 hover:bg-command-900 text-white font-bold text-xs uppercase tracking-wide transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            {submitting ? 'Cerrando...' : 'Confirmar cierre'}
          </button>
        </div>
      </div>
    </div>
  );
}
