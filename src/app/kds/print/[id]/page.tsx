'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { formatPesos } from '@/lib/format';
import type { Order, PrepArea } from '@/types/order';

// Fase 3, browser-print fallback (plan section 7): no local hardware to
// talk to, no print-bridge agent to run per tenant — just an 80mm-formatted
// page and the browser's own print dialog. Opened standalone (new tab) from
// the KDS detail drawer's "Imprimir comanda" button, auto-triggers print.
export default function PrintTicketPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const station = searchParams.get('station') as PrepArea | null;
  const itemIdsParam = searchParams.get('items');
  const onlyItemIds = useMemo(() => (itemIdsParam ? new Set(itemIdsParam.split(',')) : null), [itemIdsParam]);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');

  useEffect(() => {
    fetch(`/api/v1/admin/orders/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setOrder(data.order);
        else setError(data.error || 'Pedido no encontrado');
      });
  }, [params.id]);

  useEffect(() => {
    fetch('/api/v1/admin/business-info')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setLogoUrl(d.logoUrl ?? null);
          setBusinessName(d.businessName ?? '');
        }
      })
      .catch(() => {});
  }, []);

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

  // Sin station, se imprime todo (compatibilidad con delivery/mostrador/
  // whatsapp, que nunca mandan este parámetro). Con station, solo los ítems
  // de esa estación — SIN_IMPRESION nunca entra a ningún ticket.
  const printableItems = station
    ? order.items.filter((item) => item.prepAreaSnapshot === station && (!onlyItemIds || onlyItemIds.has(item.id)))
    : order.items;
  const isDineIn = order.channel === 'DINE_IN';

  return (
    <div className="print-ticket mx-auto max-w-[80mm] p-3 font-mono text-[11px] leading-snug text-black bg-white">
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 4mm; }
          body { background: white; }
        }
      `}</style>

      <div className="text-center space-y-0.5 mb-2">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="w-10 h-10 mx-auto rounded-lg object-cover mb-1" />
        )}
        <div className="font-bold text-sm">{businessName || 'Comanda de Cocina'}</div>
        <div className="text-[10px]">Comanda de cocina</div>
      </div>
      <div className="border-t border-dashed border-black my-1" />

      <div className="flex justify-between font-bold">
        <span>#{order.orderCode}</span>
        <span className="uppercase">{order.channel}</span>
      </div>
      <div>{new Date(order.createdAt).toLocaleString('es-AR')}</div>
      {station && (
        <div className="text-center font-bold text-sm border border-black rounded-sm my-1 py-0.5">
          COMANDA — {station}
        </div>
      )}
      {isDineIn && !station && (
        <div className="text-center font-bold text-sm border border-black rounded-sm my-1 py-0.5">PRE-CUENTA</div>
      )}
      <div className="border-t border-dashed border-black my-1" />

      {isDineIn ? (
        <>
          <div className="font-bold">Mesa {order.table?.number ?? '—'}</div>
          {order.waiterName && <div>Mozo: {order.waiterName}</div>}
          {order.guestCount != null && <div>Comensales: {order.guestCount}</div>}
          {order.customerName && <div>{order.customerName}</div>}
        </>
      ) : (
        <>
          <div className="font-bold">{order.customerName || 'Cliente sin nombre'}</div>
          {order.customerPhone && <div>Tel: {order.customerPhone}</div>}
          {order.address && <div>{order.address}</div>}
          {order.locality && <div>{order.locality}</div>}
        </>
      )}
      <div className="border-t border-dashed border-black my-1" />

      <table className="w-full">
        <tbody>
          {printableItems.map((item) => (
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

      {/* Una comanda de Salón filtrada por estación (?station=) es de
          preparación para cocina/barra, no de cobro — ahí no se muestra
          total. Sin station (pre-cuenta / reimpresión completa de una mesa)
          sí tiene sentido mostrarlo. */}
      {(!isDineIn || !station) && (
        <>
          <div className="flex justify-between font-bold text-sm">
            <span>TOTAL</span>
            <span>{formatPesos(order.totalAmount)}</span>
          </div>
          {!isDineIn && <div className="uppercase">{order.paymentMethod}</div>}
        </>
      )}

      <div className="text-center text-[10px] mt-3">Creado y desarrollado por Just Create</div>
    </div>
  );
}
