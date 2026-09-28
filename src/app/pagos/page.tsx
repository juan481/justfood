'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AppHeader } from '@/components/AppHeader';
import { Footer } from '@/components/Footer';
import { GuideCard } from '@/components/GuideCard';
import { compressImage } from '@/lib/image-compress';
import { formatPesos } from '@/lib/format';
import type { Order } from '@/types/order';

interface Receipt {
  id: string;
  orderId: string;
  imageUrl: string;
  extractedAmount: number | null;
  extractedAliasOrCvu: string | null;
  extractedOperationNumber: string | null;
  autoValidationStatus: string;
  createdAt: string;
  order: {
    orderCode: string;
    customerName: string | null;
    totalAmount: number;
    paymentMethod: string;
  };
}

const FLAG_LABEL: Record<string, { label: string; className: string }> = {
  MATCH: { label: 'Coincide', className: 'bg-emerald-100 text-emerald-700' },
  AMOUNT_MISMATCH: { label: 'Monto no coincide', className: 'bg-red-100 text-red-700' },
  ALIAS_MISMATCH: { label: 'Alias/CVU no coincide', className: 'bg-red-100 text-red-700' },
  DUPLICATE: { label: 'Operación duplicada', className: 'bg-red-100 text-red-700' },
  UNREADABLE: { label: 'No se pudo leer', className: 'bg-slate-100 text-slate-600' },
  PENDING_EXTRACTION: { label: 'Sin extracción automática', className: 'bg-amber-100 text-amber-700' },
};

function AttachReceiptForm({ order, onAttached }: { order: Order; onAttached: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(order.totalAmount));
  const [alias, setAlias] = useState('');
  const [operationNumber, setOperationNumber] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    try {
      const dataUrl = await compressImage(file);
      setImageDataUrl(dataUrl);
    } catch {
      setError('No se pudo procesar la imagen — probá con otra foto.');
    }
  }

  async function submit() {
    if (!imageDataUrl) {
      setError('Subí la foto del comprobante primero — sin eso no hay nada que revisar.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/v1/admin/payment-receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        imageUrl: imageDataUrl,
        extractedAmount: amount ? parseInt(amount, 10) : null,
        extractedAliasOrCvu: alias || null,
        extractedOperationNumber: operationNumber || null,
      }),
    });
    setSubmitting(false);
    if (res.ok) onAttached();
    else setError('Error al guardar — intentá de nuevo.');
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-semibold text-command-800 hover:underline flex items-center gap-1">
        <span className="material-symbols-rounded text-sm">add_a_photo</span>
        Cargar comprobante
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 animate-in fade-in">
      <div className="flex gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-command-500 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-command-700 transition-colors overflow-hidden"
        >
          {imageDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageDataUrl} alt="Comprobante" className="w-full h-full object-cover" />
          ) : (
            <>
              <span className="material-symbols-rounded text-xl">add_a_photo</span>
              <span className="text-[9px] font-semibold">Foto</span>
            </>
          )}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono" placeholder="Monto" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
          <input className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs" placeholder="Alias / CVU" value={alias} onChange={(e) => setAlias(e.target.value)} />
          <input className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs" placeholder="N° operación" value={operationNumber} onChange={(e) => setOperationNumber(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={submitting}
        className="w-full py-2 rounded-lg bg-command-800 hover:bg-command-900 text-white text-xs font-semibold uppercase transition disabled:opacity-50"
      >
        {submitting ? 'Guardando...' : 'Guardar comprobante'}
      </button>
    </div>
  );
}

export default function PagosPage() {
  const { data: session } = useSession();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [receiptsRes, ordersRes] = await Promise.all([
      fetch('/api/v1/admin/payment-receipts'),
      fetch('/api/v1/admin/orders/pending-payment'),
    ]);
    const receiptsData = await receiptsRes.json();
    const ordersData = await ordersRes.json();
    if (receiptsData.ok) setReceipts(receiptsData.receipts);
    if (ordersData.ok) setPendingOrders(ordersData.orders);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, action: 'approve' | 'reject') {
    setBusyId(id);
    const res = await fetch(`/api/v1/admin/payment-receipts/${id}/${action}`, { method: 'PATCH' });
    const data = await res.json();
    setBusyId(null);
    if (data.ok) {
      load();
    } else {
      alert(data.error || 'Error al procesar');
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <AppHeader tenantName={session?.user?.tenantSlug ?? ''} activeNav="pagos" />

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 sm:px-8 py-6 space-y-6 animate-in fade-in duration-300">
        <GuideCard
          question="¿Cómo funciona la revisión de comprobantes?"
          tips={[
            {
              icon: 'chat',
              title: '1. Te llega por WhatsApp',
              body: 'El cliente te manda la foto de la transferencia por WhatsApp — todavía no hay lectura automática, así que la carga es manual.',
            },
            {
              icon: 'add_a_photo',
              title: '2. Subís la foto acá',
              body: 'En "Esperando comprobante" tocá Cargar comprobante: subí esa misma foto y escribí monto, alias y N° de operación tal cual figuran.',
            },
            {
              icon: 'fact_check',
              title: '3. Aprobás o rechazás',
              body: 'El sistema marca en rojo si el monto/alias no coincide con el pedido, o si el N° de operación ya se usó antes. Vos mirás la foto y decidís.',
            },
          ]}
        />

        <div>
          <h1 className="text-xl font-bold text-command-950">Pagos por Revisar</h1>
          <p className="text-sm text-slate-500">
            Pedidos por transferencia esperando confirmación — no entran a cocina hasta que se aprueben acá.
          </p>
        </div>

        {!loading && pendingOrders.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Esperando comprobante</h2>
            {pendingOrders.map((o) => (
              <div key={o.id} className="bg-white rounded-xl border border-amber-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    <span className="font-mono font-bold text-command-800">#{o.orderCode}</span>{' '}
                    {o.customerName || 'Cliente sin nombre'} — {formatPesos(o.totalAmount)}
                  </span>
                </div>
                <AttachReceiptForm order={o} onAttached={load} />
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Comprobantes a revisar</h2>

          {loading && <p className="text-slate-400 text-sm">Cargando...</p>}

          {!loading && receipts.length === 0 && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
              <span className="material-symbols-rounded text-3xl text-slate-300">task_alt</span>
              <p className="text-slate-500 font-medium mt-2">Sin comprobantes pendientes.</p>
            </div>
          )}

          <div className="space-y-3">
            {receipts.map((r) => {
              const flag = FLAG_LABEL[r.autoValidationStatus] ?? FLAG_LABEL.PENDING_EXTRACTION;
              const hasImage = r.imageUrl && r.imageUrl !== 'about:blank';
              return (
                <div key={r.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-4 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="font-mono text-sm font-bold text-command-800">#{r.order.orderCode}</span>
                      <span className="ml-2 text-sm text-slate-600">{r.order.customerName || 'Cliente sin nombre'}</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${flag.className}`}>{flag.label}</span>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => hasImage && setZoomImage(r.imageUrl)}
                      className={`shrink-0 w-20 h-20 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50 ${hasImage ? 'hover:ring-2 ring-command-500' : ''}`}
                    >
                      {hasImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.imageUrl} alt="Comprobante" className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-rounded text-slate-300">image_not_supported</span>
                      )}
                    </button>

                    <div className="grid grid-cols-2 gap-3 text-sm flex-1">
                      <div>
                        <div className="text-xs text-slate-400 uppercase">Total pedido</div>
                        <div className="font-mono font-semibold">{formatPesos(r.order.totalAmount)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 uppercase">Monto comprobante</div>
                        <div className="font-mono font-semibold">{r.extractedAmount !== null ? formatPesos(r.extractedAmount) : '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 uppercase">Alias / CVU</div>
                        <div className="font-mono text-xs">{r.extractedAliasOrCvu || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 uppercase">N° operación</div>
                        <div className="font-mono text-xs">{r.extractedOperationNumber || '—'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <button
                      disabled={busyId === r.id}
                      onClick={() => decide(r.id, 'approve')}
                      className="flex-1 py-2.5 rounded-xl bg-command-800 hover:bg-command-900 text-white font-semibold text-xs uppercase tracking-wide transition disabled:opacity-50"
                    >
                      Aprobar → pasa a cocina
                    </button>
                    <button
                      disabled={busyId === r.id}
                      onClick={() => decide(r.id, 'reject')}
                      className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-xs uppercase tracking-wide transition disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />

      {zoomImage && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in" onClick={() => setZoomImage(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomImage} alt="Comprobante ampliado" className="max-w-full max-h-full rounded-2xl shadow-2xl animate-in zoom-in-95" />
        </div>
      )}
    </div>
  );
}
