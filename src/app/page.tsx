'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { AppHeader } from '@/components/AppHeader';
import { Footer } from '@/components/Footer';

interface HomeSummary {
  tenantName: string;
  activeOrders: number;
  pendingPaymentReviews: number;
  todaysOrdersCount: number;
  todaysRevenue: number;
  connectedCouriers: number;
}

const MODULES: { icon: string; title: string; description: string; href: string; accent: string }[] = [
  {
    icon: 'receipt_long',
    title: 'Comandero & Cocina',
    description: 'Tablero en tiempo real: cada pedido nuevo suena y aparece al instante, sin recargar nada.',
    href: '/kds',
    accent: 'bg-command-800',
  },
  {
    icon: 'moped',
    title: 'Cadetes & Repartidores',
    description: 'Asigná repartidores, seguí quién está en la calle y controlá el efectivo pendiente de rendir.',
    href: '/cadetes',
    accent: 'bg-orange-600',
  },
  {
    icon: 'menu_book',
    title: 'Menú & Stock',
    description: 'Subí o bajá un producto sin stock en 1 clic — se refleja al instante en la web y el mostrador.',
    href: '/menu',
    accent: 'bg-emerald-600',
  },
  {
    icon: 'fact_check',
    title: 'Pagos por Revisar',
    description: 'Cada comprobante de transferencia con foto, monto y alias — aprobás o rechazás con un tap.',
    href: '/pagos',
    accent: 'bg-amber-600',
  },
  {
    icon: 'insights',
    title: 'Estadísticas',
    description: 'Ventas, productos más pedidos y horarios pico para tomar decisiones con datos reales.',
    href: '/estadisticas',
    accent: 'bg-sky-600',
  },
  {
    icon: 'table_bar',
    title: 'Salón & Mesas',
    description: 'Gestión de mesas y reservas para el servicio presencial, sin planillas ni llamados cruzados.',
    href: '/salon',
    accent: 'bg-violet-600',
  },
  {
    icon: 'qr_code_2',
    title: 'Menú QR',
    description: 'Un QR para que el cliente pida desde la mesa, siempre con precios y stock actualizados.',
    href: '/menu-qr',
    accent: 'bg-rose-600',
  },
  {
    icon: 'payments',
    title: 'Arqueo & Caja',
    description: 'Cierre de caja diario: lo que entró por efectivo, transferencia y Mercado Pago, todo en un lugar.',
    href: '/arqueo',
    accent: 'bg-teal-600',
  },
  {
    icon: 'settings',
    title: 'Pagos y Envíos',
    description: 'Alias, CBU, Mercado Pago, radio de envío y datos del local — la config que ordena todo lo demás.',
    href: '/ajustes',
    accent: 'bg-slate-600',
  },
];

const money = (n: number) => `$${n.toLocaleString('es-AR')}`;

export default function HomePage() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<HomeSummary | null>(null);

  useEffect(() => {
    fetch('/api/v1/admin/home-summary')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setSummary(d);
      })
      .catch(() => {});
  }, []);

  const firstName = session?.user?.name ?? '';

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <AppHeader tenantName={session?.user?.tenantSlug ?? ''} activeNav="home" />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 sm:px-8 py-8 space-y-8 animate-in fade-in duration-300">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-slate-800">
              Hola{firstName ? `, ${firstName}` : ''} 👋
            </h1>
            <p className="text-sm text-slate-500">
              {summary?.tenantName ? `Así está ${summary.tenantName} ahora mismo.` : 'Así está tu local ahora mismo.'}
            </p>
          </div>
          <Image src="/logo-justfood.png" alt="JustFood" width={186} height={57} className="h-10 w-auto opacity-90" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon="receipt_long" label="Pedidos activos" value={summary ? String(summary.activeOrders) : '—'} tone="text-command-800" />
          <StatCard icon="fact_check" label="Pagos por revisar" value={summary ? String(summary.pendingPaymentReviews) : '—'} tone="text-amber-600" urgent={!!summary?.pendingPaymentReviews} />
          <StatCard icon="today" label="Ventas de hoy" value={summary ? `${summary.todaysOrdersCount} pedidos` : '—'} tone="text-emerald-600" />
          <StatCard icon="payments" label="Facturado hoy" value={summary ? money(summary.todaysRevenue) : '—'} tone="text-sky-600" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-700">Qué podés hacer con JustFood</h2>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
              Todo en un solo panel
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODULES.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="group bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <span className={`w-10 h-10 rounded-xl ${m.accent} flex items-center justify-center shrink-0`}>
                  <span className="material-symbols-rounded text-white text-lg">{m.icon}</span>
                </span>
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-slate-800">{m.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{m.description}</p>
                </div>
                <span className="mt-auto text-[11px] font-semibold text-command-800 flex items-center gap-1 group-hover:gap-1.5 transition-all">
                  Abrir
                  <span className="material-symbols-rounded text-sm">arrow_forward</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
  urgent,
}: {
  icon: string;
  label: string;
  value: string;
  tone: string;
  urgent?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-3 ${
        urgent ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'
      }`}
    >
      <span className={`w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 ${tone}`}>
        <span className="material-symbols-rounded text-lg">{icon}</span>
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide truncate">{label}</p>
        <p className={`text-lg font-extrabold ${tone}`}>{value}</p>
      </div>
    </div>
  );
}
