'use client';

import { useState } from 'react';
import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'JustFood',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'Sistema de gestión gastronómica: comandero de cocina en tiempo real, menú y stock, pagos por transferencia y Mercado Pago, cadetes y delivery.',
  offers: { '@type': 'Offer', category: 'SaaS' },
  publisher: { '@type': 'Organization', name: 'Just Create', url: 'https://justcreate.com.ar' },
};

const METRICS: { val: string; label: string; sub: string }[] = [
  { val: 'Tiempo Real', label: 'Comandero & Cocina', sub: 'Cada pedido nuevo suena y aparece al instante' },
  { val: '1 Tap', label: 'Pagos por Revisar', sub: 'Comprobante con foto, aprobás o rechazás al toque' },
  { val: 'En Vivo', label: 'Cadetes & Reparto', sub: 'Quién está en la calle y el efectivo por rendir' },
  { val: 'Multi-Local', label: 'Un Panel, Todo el Negocio', sub: 'Menú, stock, ventas y caja centralizados' },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn('credentials', {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Usuario o contraseña incorrectos.');
      return;
    }

    router.push('/panel');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex bg-command-950 text-slate-800 antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />
      {/* Panel izquierdo — presentación editorial sobre el tema oscuro Command Bar */}
      <div className="hidden lg:flex lg:w-[50%] flex-col justify-between p-12 xl:p-16 bg-gradient-to-br from-command-950 via-command-900 to-command-800 border-r border-white/5 relative overflow-hidden text-white">
        <div className="absolute inset-0 bg-[radial-gradient(rgba(159,247,153,0.12)_1px,transparent_1px)] [background-size:28px_28px] opacity-40 pointer-events-none" />
        <div className="absolute -top-28 -left-28 w-[520px] h-[520px] rounded-full bg-limeaccent/10 blur-[130px] pointer-events-none" />
        <div className="absolute -bottom-28 -right-28 w-[480px] h-[480px] rounded-full bg-command-700/40 blur-[120px] pointer-events-none" />

        <div className="space-y-6 my-auto max-w-lg relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-white/5 text-limeaccent border border-white/10">
            <span className="material-symbols-rounded text-sm">eco</span>
            <span>Sistema Operativo para Gastronomía</span>
          </div>

          <h1 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight tracking-tight">
            Gestioná tu local con la{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-limeaccent via-emerald-200 to-white">
              velocidad de una cocina real
            </span>
            .
          </h1>

          <p className="text-white/60 text-sm leading-relaxed">
            Comandero, menú, pagos y cadetes en un solo panel — pedidos de la web, el mostrador y WhatsApp
            entrando al mismo tablero en tiempo real, sin planillas ni llamados cruzados.
          </p>

          <div className="grid grid-cols-2 gap-3.5 pt-2">
            {METRICS.map((m) => (
              <div
                key={m.label}
                className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 transition-all hover:border-limeaccent/40 hover:bg-white/[0.07] hover:-translate-y-0.5"
              >
                <p className="text-base font-bold text-limeaccent tracking-tight">{m.val}</p>
                <p className="text-xs font-semibold text-white mt-1 leading-snug">{m.label}</p>
                <p className="text-[11px] text-white/50 mt-1 leading-relaxed">{m.sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-white/10 relative z-10">
          <a href="/landing" className="inline-flex items-center gap-1.5 text-xs text-white/55 transition-colors hover:text-limeaccent">
            <span className="material-symbols-rounded text-sm">arrow_back</span>
            Volver a la página principal
          </a>
          <span className="text-xs text-white/30">© 2026</span>
        </div>
      </div>

      {/* Panel derecho — tarjeta de login sobre fondo claro */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-white/70 blur-[90px] pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

        <div className="w-full max-w-[440px] relative z-10">
          <div className="bg-white rounded-[28px] p-8 sm:p-10 border border-slate-200 shadow-[0_20px_50px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-center mb-6 pb-2">
              <Image src="/logo-justfood.png" alt="JustFood" width={186} height={57} className="h-9 w-auto" priority />
            </div>

            <div className="mb-7">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-rounded text-base text-command-800">verified_user</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-command-800">Acceso del Local</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Iniciar sesión</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Ingresá tu usuario y contraseña — te llevamos directo a tu local.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Usuario</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  placeholder="admin"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-command-800 focus:bg-white focus:ring-2 focus:ring-command-800/15 text-slate-800 placeholder-slate-400 rounded-xl px-4 py-3 text-sm outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••••••"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-command-800 focus:bg-white focus:ring-2 focus:ring-command-800/15 text-slate-800 placeholder-slate-400 rounded-xl px-4 py-3 pr-11 text-sm outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <span className="material-symbols-rounded text-base">{showPass ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-medium bg-red-50 border border-red-200 text-red-700">
                  <span className="material-symbols-rounded text-sm shrink-0">error</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full font-semibold text-sm text-white bg-command-800 hover:bg-command-900 transition-all transform hover:-translate-y-0.5 disabled:opacity-60 shadow-md shadow-command-800/25 mt-2"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 rounded-full animate-spin border-white/30 border-t-white" />
                ) : (
                  <span className="material-symbols-rounded text-base">login</span>
                )}
                <span>{loading ? 'Ingresando...' : 'Ingresar'}</span>
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400">¿Problemas para acceder? Consultá con tu encargado.</p>
            </div>

            <div className="mt-3 text-center">
              <a href="/landing" className="inline-flex items-center gap-1 text-xs font-semibold text-command-800 hover:underline">
                <span className="material-symbols-rounded text-sm">arrow_back</span>
                Volver a la página principal
              </a>
            </div>

            <div className="mt-6 pt-5 flex items-center justify-center border-t border-slate-50">
              <a
                href="https://justcreate.com.ar"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-command-800 transition-colors"
              >
                <span>Desarrollado y diseñado por</span>
                <img src="https://crm.justcreate.com.ar/just-create-logo.png" alt="Just Create" className="h-6 w-auto" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
