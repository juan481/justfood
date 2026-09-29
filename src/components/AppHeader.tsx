'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';

interface AppHeaderProps {
  tenantName: string;
  activeNav: 'home' | 'kds' | 'menu' | 'pagos' | 'analitica' | 'salon' | 'qr' | 'caja' | 'historial' | 'ajustes' | 'cadetes';
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  live?: boolean;
}

const NAV_ITEMS: { key: AppHeaderProps['activeNav']; label: string; icon: string; href: string | null }[] = [
  { key: 'home', label: 'Inicio', icon: 'home', href: '/panel' },
  { key: 'kds', label: 'Comandero & Cocina', icon: 'receipt_long', href: '/kds' },
  { key: 'cadetes', label: 'Cadetes & Repartidores', icon: 'moped', href: '/cadetes' },
  { key: 'menu', label: 'Menú & Stock', icon: 'menu_book', href: '/menu' },
  { key: 'pagos', label: 'Pagos por Revisar', icon: 'fact_check', href: '/pagos' },
  { key: 'analitica', label: 'Estadísticas', icon: 'insights', href: '/estadisticas' },
  { key: 'salon', label: 'Salón & Mesas', icon: 'table_bar', href: '/salon' },
  { key: 'qr', label: 'Menú QR', icon: 'qr_code_2', href: '/menu-qr' },
  { key: 'caja', label: 'Arqueo & Caja', icon: 'payments', href: '/arqueo' },
  { key: 'historial', label: 'Historial', icon: 'history', href: '/historial' },
  { key: 'ajustes', label: 'Pagos y Envíos', icon: 'settings', href: '/ajustes' },
];

// The one shared header for every authenticated screen — built directly
// from design-reference/kds_justfood_*/code.html's "Command Bar" markup,
// now the single design language for the whole app (plan section 4), not
// just the KDS.
export function AppHeader({ tenantName, activeNav, soundEnabled, onToggleSound, live }: AppHeaderProps) {
  // Self-fetched rather than passed down as props — this way every screen
  // shows "how many pedidos/pagos are waiting" in the nav, not just the
  // page that happens to already load that data for its own content.
  const [badges, setBadges] = useState({ activeOrders: 0, pendingPaymentReviews: 0 });
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      fetch('/api/v1/admin/badge-counts')
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setBadges({ activeOrders: d.activeOrders, pendingPaymentReviews: d.pendingPaymentReviews });
        })
        .catch(() => {});
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch('/api/v1/admin/business-info')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setTenantLogoUrl(d.logoUrl ?? null);
      })
      .catch(() => {});
  }, []);

  return (
    <header className="bg-gradient-to-r from-command-950 via-command-900 to-command-800 text-white shadow-xl shadow-command-950/25 sticky top-0 z-50">
      <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-4 px-4 py-3">
        <Link href="/panel" className="flex items-center gap-3 min-w-0 shrink-0">
          <Image src="/logo-justfood-icon.png" alt="JustFood" width={40} height={40} className="w-10 h-10 rounded-xl shrink-0" priority />
          <div className="flex items-baseline gap-0.5 font-extrabold text-lg shrink-0">
            <span>Just</span>
            <span className="text-limeaccent">Food</span>
          </div>
        </Link>
        <div className="flex items-center gap-3 min-w-0">
          <div className="hidden sm:block w-px h-6 bg-white/20 shrink-0" />
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-command-700/60 text-xs font-semibold truncate">
            {tenantLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenantLogoUrl} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
            ) : (
              '🍕'
            )}
            {tenantName}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {live !== undefined && (
            <div
              className={`hidden xl:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black/20 border border-white/10 text-xs font-medium ${
                live ? 'text-limeaccent' : 'text-white/50'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${live ? 'bg-limeaccent animate-pulse' : 'bg-white/30'}`} />
              {live ? 'En Vivo' : 'Reconectando…'}
            </div>
          )}
          {onToggleSound && (
            <button
              onClick={onToggleSound}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/20 hover:bg-white/10 border border-white/10 text-xs font-medium text-white/90 transition"
              title="Activar / Silenciar notificaciones sonoras"
            >
              <span className="material-symbols-rounded text-limeaccent text-base">
                {soundEnabled ? 'volume_up' : 'volume_off'}
              </span>
            </button>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/20 hover:bg-white/10 border border-white/10 text-xs font-medium text-white/90 transition"
          >
            <span className="material-symbols-rounded text-base">logout</span>
          </button>
        </div>
      </div>

      <nav className="bg-black/15 border-t border-white/10">
        <div className="max-w-[1920px] mx-auto flex items-center gap-2 overflow-x-auto custom-scrollbar px-4 py-2">
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === activeNav;
            const className = `inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              isActive ? 'bg-white text-command-950 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'
            } ${!item.href ? 'opacity-50 cursor-not-allowed' : ''}`;

            const badgeCount = item.key === 'pagos' ? badges.pendingPaymentReviews : item.key === 'kds' ? badges.activeOrders : 0;

            if (!item.href) {
              return (
                <span key={item.key} className={className} title="Próximamente">
                  <span className="material-symbols-rounded text-sm">{item.icon}</span>
                  {item.label}
                </span>
              );
            }
            return (
              <Link key={item.key} href={item.href} className={className}>
                <span className="material-symbols-rounded text-sm">{item.icon}</span>
                {item.label}
                {badgeCount > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white ${
                      item.key === 'pagos' ? 'bg-orange-500' : 'bg-limeaccent text-command-950'
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
