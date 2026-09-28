'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { formatPesos } from '@/lib/format';
import type { Order } from '@/types/order';

// Fase 3, browser-print fallback (plan section 7): no local hardware to
// talk to, no print-bridge agent to run per tenant — just an 80mm-formatted
// page and the browser's own print dialog. Opened standalone (new tab) from
// the KDS detail drawer's "Imprimir comanda" button, auto-triggers print.
export default function PrintTicketPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/admin/orders/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setOrder(data.order);
        else setError(data.error || 'Pedido no encontrado');
      });
  }, [params.id]);

  useEffect(() => {
    if (order) {
      // Small delay so the browser finishes laying out the ticket before
      // the print dialog steals focus.
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [order]);

  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!order) return <p className="p-6 text-sm text-slate-400">Cargando comanda...</p>;

  return (
    <div className="print-ticket mx-auto max-w-[80mm] p-3 font-mono text-[11px] leading-snug text-black bg-white">
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 4mm; }
          body { background: white; }
        }
      `}</style>

      <div className="text-center space-y-0.5 mb-2">
        <div className="font-bold text-sm">JustFood</div>
        <div className="text-[10px]">Comanda de cocina</div>
      </div>
      <div className="border-t border-dashed border-black my-1" />

      <div className="flex justify-between font-bold">
        <span>#{order.orderCode}</span>
        <span className="uppercase">{order.channel}</span>
      </div>
      <div>{new Date(order.createdAt).toLocaleString('es-AR')}</div>
      <div className="border-t border-dashed border-black my-1" />

      <div className="font-bold">{order.customerName || 'Cliente sin nombre'}</div>
      {order.customerPhone && <div>Tel: {order.customerPhone}</div>}
      {order.address && <div>{order.address}</div>}
      {order.locality && <div>{order.locality}</div>}
      <div className="border-t border-dashed border-black my-1" />

      <table className="w-full">
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td className="align-top pr-1">{item.quantity}x</td>
              <td className="align-top">
                {item.productNameSnapshot}
                {item.notes && <div className="text-[10px]">* {item.notes}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-dashed border-black my-1" />

      {order.notes && (
        <>
          <div className="whitespace-pre-line">{order.notes}</div>
          <div className="border-t border-dashed border-black my-1" />
        </>
      )}

      <div className="flex justify-between font-bold text-sm">
        <span>TOTAL</span>
        <span>{formatPesos(order.totalAmount)}</span>
      </div>
      <div className="uppercase">{order.paymentMethod}</div>

      <div className="text-center text-[10px] mt-3">Creado y desarrollado por Just Create</div>
    </div>
  );
}
