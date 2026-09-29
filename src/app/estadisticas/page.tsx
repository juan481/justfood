'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AppHeader } from '@/components/AppHeader';
import { Footer } from '@/components/Footer';
import { GuideCard } from '@/components/GuideCard';
import { formatPesos, waLink } from '@/lib/format';

interface Analytics {
  days: number;
  byDay: Record<string, { count: number; revenue: number }>;
  topProducts: { name: string; quantity: number; revenue: number }[];
  visitsToday: number;
  visitsThisMonth: number;
  ordersThisMonth: number;
  revenueThisMonth: number;
  conversionPct: number;
  topCustomers: { phone: string; name: string; lastAddress: string | null; orderCount: number; total: number }[];
  recentOrders: {
    id: string;
    orderCode: string;
    customerName: string | null;
    customerPhone: string | null;
    address: string | null;
    locality: string | null;
    totalAmount: number;
    createdAt: string;
    items: { id: string; productNameSnapshot: string; quantity: number }[];
  }[];
}

const MEDALS = ['🥇', '🥈', '🥉'];

function StatCard({ label, value, sub, icon, accent, live }: { label: string; value: string; sub?: string; icon: string; accent: string; live?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow animate-in fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-400 text-[11px] font-semibold uppercase tracking-wide">
          <span className={`material-symbols-rounded text-base ${accent}`}>{icon}</span>
          {label}
        </div>
        {live && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
      </div>
      <div className="text-2xl font-bold text-command-950 mt-1 font-mono">{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

export default function EstadisticasPage() {
  const { data: session } = useSession();
  const [days, setDays] = useState(14);
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/v1/admin/analytics?days=${days}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setData(d);
        });
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [days]);

  const dayEntries = data ? Object.entries(data.byDay).sort(([a], [b]) => a.localeCompare(b)) : [];
  const maxDayRevenue = Math.max(1, ...dayEntries.map(([, v]) => v.revenue));

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <AppHeader tenantName={session?.user?.tenantSlug ?? ''} activeNav="analitica" />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 sm:px-8 py-6 space-y-5 animate-in fade-in duration-300">
        <GuideCard
          question="¿Cómo funciona este panel de estadísticas?"
          tips={[
            { icon: 'visibility', title: 'Visitas en vivo', body: 'Cuenta las visitas a la web del cliente en tiempo real — sirve para ver si una promo está funcionando.' },
            { icon: 'star', title: 'Ranking de clientes', body: 'Ordenado por cantidad de pedidos — identificá a quién vale la pena mandarle un descuento VIP.' },
            { icon: 'trending_up', title: 'Facturación estimada', body: 'Suma todos los pedidos del mes (incluye los que todavía están en curso), no solo los ya entregados.' },
          ]}
        />

        {!data ? (
          <p className="text-sm text-slate-400">Cargando...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Visitas Hoy" value={String(data.visitsToday)} sub="Personas navegando en vivo" icon="visibility" accent="text-command-800" live />
              <StatCard label="Visitas Este Mes" value={String(data.visitsThisMonth)} sub="30 días" icon="trending_up" accent="text-blue-600" />
              <StatCard
                label="Pedidos Generados"
                value={String(data.ordersThisMonth)}
                sub={`${data.conversionPct}% conv.`}
                icon="shopping_bag"
                accent="text-orange-600"
              />
              <StatCard label="Facturación Estimada Mes" value={formatPesos(data.revenueThisMonth)} sub="Suma de pedidos registrados" icon="payments" accent="text-emerald-600" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
                  <span className="material-symbols-rounded text-base text-command-800">show_chart</span>
                  Tendencia de Visitas Diarias (Últimos {days} días)
                </h2>
                <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
                  {[7, 14, 30].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDays(d)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${days === d ? 'bg-white text-command-950 shadow-sm' : 'text-slate-500'}`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-end gap-1.5 h-40">
                {dayEntries.map(([day, v]) => (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">{formatPesos(v.revenue)}</span>
                    <div
                      className="w-full bg-gradient-to-t from-command-800 to-limeaccent rounded-t-md transition-all hover:opacity-80"
                      style={{ height: `${Math.max(4, (v.revenue / maxDayRevenue) * 120)}px` }}
                    />
                    <span className="text-[9px] text-slate-400">
                      {new Date(day + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                ))}
                {dayEntries.length === 0 && <p className="text-xs text-slate-400 m-auto">Sin datos en este período.</p>}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto animate-in fade-in">
              <div className="p-5 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
                    <span className="material-symbols-rounded text-base text-amber-500">star</span>
                    Ranking de Mejores Clientes
                  </h2>
                  <p className="text-[11px] text-slate-400">Identificá a tus clientes recurrentes por su frecuencia de pedidos</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold">Top {data.topCustomers.length} Fidelizados</span>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-400 uppercase">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Ranking</th>
                    <th className="text-left px-4 py-2 font-semibold">Cliente / Teléfono</th>
                    <th className="text-left px-4 py-2 font-semibold hidden sm:table-cell">Última Dirección</th>
                    <th className="text-right px-4 py-2 font-semibold">Pedidos</th>
                    <th className="text-right px-4 py-2 font-semibold">Total</th>
                    <th className="text-right px-4 py-2 font-semibold">Contacto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.topCustomers.map((c, i) => (
                    <tr key={c.phone} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-bold">{MEDALS[i] ?? `${i + 1}°`}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-700">{c.name}</div>
                        <div className="text-slate-400 font-mono">{c.phone}</div>
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell text-slate-500">{c.lastAddress ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-command-800">{c.orderCount}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-emerald-600 font-semibold">{formatPesos(c.total)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <a
                          href={waLink(c.phone)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold transition-colors"
                        >
                          <span className="material-symbols-rounded text-xs">chat</span>
                          Escribir
                        </a>
                      </td>
                    </tr>
                  ))}
                  {data.topCustomers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                        Sin datos todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto animate-in fade-in">
              <div className="p-5 pb-3">
                <h2 className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
                  <span className="material-symbols-rounded text-base text-slate-500">history</span>
                  Historial Reciente de Pedidos
                </h2>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-400 uppercase">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Fecha / Hora</th>
                    <th className="text-left px-4 py-2 font-semibold">Cliente</th>
                    <th className="text-left px-4 py-2 font-semibold hidden md:table-cell">Dirección</th>
                    <th className="text-left px-4 py-2 font-semibold">Desglose de Ítems</th>
                    <th className="text-right px-4 py-2 font-semibold">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {new Date(o.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })},{' '}
                        {new Date(o.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                        <div className="text-slate-400 font-mono">#{o.orderCode.replace(/^\D+-?0*/, '')}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        {o.customerName}
                        <div className="text-slate-400 font-mono">{o.customerPhone}</div>
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell text-slate-500">
                        {o.address ? `${o.address}${o.locality ? ` (${o.locality})` : ''}` : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {o.items.slice(0, 3).map((item) => (
                            <span key={item.id} className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 whitespace-nowrap">
                              {item.quantity}x {item.productNameSnapshot}
                            </span>
                          ))}
                          {o.items.length > 3 && <span className="text-slate-400">+{o.items.length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-700">{formatPesos(o.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
