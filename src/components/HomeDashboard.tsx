'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AppHeader } from '@/components/AppHeader';
import { Footer } from '@/components/Footer';

interface HomeSummary {
  tenantName: string;
  activeOrders: number;
  pendingPaymentReviews: number;
  todaysOrdersCount: number;
  todaysRevenue: number;
}

const modules = [
  ['receipt_long', 'Comandero & Cocina', 'Tablero en tiempo real para cada pedido.', '/kds', 'bg-command-800'],
  ['moped', 'Cadetes & Repartidores', 'Asigná repartidores y controlá el efectivo.', '/cadetes', 'bg-orange-600'],
  ['menu_book', 'Menú & Stock', 'Actualizá productos y disponibilidad en un toque.', '/menu', 'bg-emerald-600'],
  ['fact_check', 'Pagos por Revisar', 'Aprobá comprobantes de transferencia.', '/pagos', 'bg-amber-600'],
  ['insights', 'Estadísticas', 'Ventas y productos para decidir con datos.', '/estadisticas', 'bg-sky-600'],
  ['table_bar', 'Salón & Mesas', 'Mesas y reservas para el servicio presencial.', '/salon', 'bg-violet-600'],
  ['qr_code_2', 'Menú QR', 'Pedidos desde la mesa con stock actualizado.', '/menu-qr', 'bg-rose-600'],
  ['payments', 'Arqueo & Caja', 'Cierre diario de todos tus cobros.', '/arqueo', 'bg-teal-600'],
];

export function HomeDashboard() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  useEffect(() => {
    fetch('/api/v1/admin/home-summary').then((r) => r.json()).then((d) => d.ok && setSummary(d)).catch(() => {});
  }, []);
  const money = (value: number) => '$' + value.toLocaleString('es-AR');
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <AppHeader tenantName={session?.user?.tenantSlug ?? ''} activeNav="home" />
      <main className="mx-auto w-full max-w-[1200px] flex-1 space-y-8 px-6 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-extrabold text-slate-800">Hola{session?.user?.name ? ', ' + session.user.name : ''} 👋</h1><p className="text-sm text-slate-500">{summary?.tenantName ? 'Así está ' + summary.tenantName + ' ahora mismo.' : 'Así está tu local ahora mismo.'}</p></div><Image src="/logo-justfood.png" alt="JustFood" width={186} height={57} className="h-10 w-auto" /></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon="receipt_long" label="Pedidos activos" value={summary ? String(summary.activeOrders) : '—'} tone="text-command-800" />
          <Stat icon="fact_check" label="Pagos por revisar" value={summary ? String(summary.pendingPaymentReviews) : '—'} tone="text-amber-600" />
          <Stat icon="today" label="Ventas de hoy" value={summary ? String(summary.todaysOrdersCount) + ' pedidos' : '—'} tone="text-emerald-600" />
          <Stat icon="payments" label="Facturado hoy" value={summary ? money(summary.todaysRevenue) : '—'} tone="text-sky-600" />
        </div>
        <div><h2 className="mb-3 text-sm font-bold text-slate-700">Qué podés hacer con JustFood</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{modules.map(([icon, title, description, href, accent]) => <Link key={href} href={href} className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"><span className={'flex h-10 w-10 items-center justify-center rounded-xl text-white ' + accent}><span className="material-symbols-rounded">{icon}</span></span><div><h3 className="text-sm font-bold text-slate-800">{title}</h3><p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p></div><span className="mt-auto text-xs font-semibold text-command-800">Abrir →</span></Link>)}</div></div>
      </main>
      <Footer />
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className={'material-symbols-rounded flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 ' + tone}>{icon}</span><div className="min-w-0"><p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className={'text-lg font-extrabold ' + tone}>{value}</p></div></div>;
}
