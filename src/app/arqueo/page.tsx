'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AppHeader } from '@/components/AppHeader';
import { Footer } from '@/components/Footer';
import { GuideCard } from '@/components/GuideCard';
import { formatPesos } from '@/lib/format';

interface Arqueo {
  date: string;
  byMethod: Record<string, { count: number; total: number }>;
  grandTotal: number;
  orderCount: number;
}

const METHOD_META: Record<string, { label: string; icon: string; className: string }> = {
  efectivo: { label: 'Efectivo', icon: 'payments', className: 'bg-emerald-50 text-emerald-700' },
  transferencia: { label: 'Transferencia', icon: 'account_balance', className: 'bg-blue-50 text-blue-700' },
  mercadopago: { label: 'Mercado Pago', icon: 'credit_card', className: 'bg-cyan-50 text-cyan-700' },
};

export default function ArqueoPage() {
  const { data: session } = useSession();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<Arqueo | null>(null);

  useEffect(() => {
    fetch(`/api/v1/admin/arqueo?date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d);
      });
  }, [date]);

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <AppHeader tenantName={session?.user?.tenantSlug ?? ''} activeNav="caja" />

      <main className="flex-1 max-w-[900px] w-full mx-auto px-6 sm:px-8 py-6 space-y-6 animate-in fade-in duration-300">
        <GuideCard
          question="¿Cómo funciona el arqueo?"
          tips={[
            { icon: 'calendar_month', title: 'Elegí el día', body: 'Cambiá la fecha arriba a la derecha para ver el total de cualquier jornada pasada.' },
            { icon: 'payments', title: 'Desglose por método', body: 'Efectivo, transferencia y Mercado Pago se muestran por separado para facilitar el cierre de caja.' },
            { icon: 'moped', title: 'Efectivo con cadetes', body: 'El efectivo cobrado en la puerta por los repartidores se rinde aparte, en Cadetes & Repartidores.' },
          ]}
        />

        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-command-950">Arqueo & Caja</h1>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-command-800"
          />
        </div>

        {!data ? (
          <p className="text-sm text-slate-400">Cargando...</p>
        ) : (
          <>
            <div className="bg-gradient-to-br from-command-900 to-command-950 text-white rounded-2xl p-6 animate-in fade-in">
              <p className="text-[11px] uppercase font-semibold text-limeaccent tracking-wider">Total del día</p>
              <p className="font-mono font-bold text-3xl mt-1">{formatPesos(data.grandTotal)}</p>
              <p className="text-xs text-white/60 mt-1">{data.orderCount} comandas</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(METHOD_META).map(([method, meta]) => {
                const entry = data.byMethod[method] ?? { count: 0, total: 0 };
                return (
                  <div key={method} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow animate-in fade-in">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${meta.className}`}>
                      <span className="material-symbols-rounded text-sm">{meta.icon}</span>
                      {meta.label}
                    </span>
                    <p className="font-mono font-bold text-xl text-command-950 mt-2">{formatPesos(entry.total)}</p>
                    <p className="text-xs text-slate-400">{entry.count} comandas</p>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-slate-400">
              Este total incluye todos los pedidos del día (activos + entregados). El módulo de apertura/cierre de caja con
              conteo físico de efectivo queda para una fase siguiente — por ahora esto es el punto de partida para el
              arqueo manual.
            </p>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
