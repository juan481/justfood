'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AppHeader } from '@/components/AppHeader';
import { Footer } from '@/components/Footer';
import { compressImage } from '@/lib/image-compress';

interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}
type WeekHours = Record<string, DayHours>;

const DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Lunes' },
  { key: 'tue', label: 'Martes' },
  { key: 'wed', label: 'Miércoles' },
  { key: 'thu', label: 'Jueves' },
  { key: 'fri', label: 'Viernes' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
];
const DEFAULT_HOURS: WeekHours = Object.fromEntries(
  DAYS.map((d) => [d.key, { open: '11:00', close: '23:30', closed: false }])
);

export default function AjustesPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [cost, setCost] = useState('0');
  const [radiusKm, setRadiusKm] = useState('');
  const [paymentAlias, setPaymentAlias] = useState('');
  const [paymentTitular, setPaymentTitular] = useState('');
  const [paymentCvu, setPaymentCvu] = useState('');
  const [mpToken, setMpToken] = useState('');
  const [hasMpToken, setHasMpToken] = useState(false);
  const [showMpToken, setShowMpToken] = useState(false);
  const [copied, setCopied] = useState(false);

  const [fudoEnabled, setFudoEnabled] = useState(false);
  const [fudoBusinessId, setFudoBusinessId] = useState('');
  const [fudoToken, setFudoToken] = useState('');
  const [hasFudoToken, setHasFudoToken] = useState(false);
  const [showFudoToken, setShowFudoToken] = useState(false);

  const [address, setAddress] = useState('');
  const [businessHours, setBusinessHours] = useState<WeekHours>(DEFAULT_HOURS);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/admin/delivery-zone').then((r) => r.json()),
      fetch('/api/v1/admin/payment-config').then((r) => r.json()),
      fetch('/api/v1/admin/pos-config').then((r) => r.json()),
      fetch('/api/v1/admin/business-info').then((r) => r.json()),
    ]).then(([dz, pc, pos, bi]) => {
      if (dz.ok) {
        setCost(String(dz.cost));
        setRadiusKm(dz.radiusKm != null ? String(dz.radiusKm) : '');
      }
      if (pc.ok) {
        setPaymentAlias(pc.paymentAlias);
        setPaymentTitular(pc.paymentTitular);
        setPaymentCvu(pc.paymentCvu);
        setHasMpToken(pc.hasMpToken);
      }
      if (pos.ok) {
        setFudoEnabled(pos.enabled);
        setFudoBusinessId(pos.businessId);
        setHasFudoToken(pos.hasApiToken);
      }
      if (bi.ok) {
        setAddress(bi.address ?? '');
        setBusinessHours(bi.businessHours ?? DEFAULT_HOURS);
        setLogoUrl(bi.logoUrl ?? null);
      }
      setLoading(false);
    });
  }, []);

  async function saveAll() {
    setSaving(true);
    await Promise.all([
      fetch('/api/v1/admin/delivery-zone', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cost: Number(cost) || 0, radiusKm: radiusKm ? Number(radiusKm) : null }),
      }),
      fetch('/api/v1/admin/payment-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentAlias,
          paymentTitular,
          paymentCvu,
          ...(mpToken ? { mpAccessToken: mpToken } : {}),
        }),
      }),
      fetch('/api/v1/admin/business-info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, businessHours, logoUrl: logoUrl ?? '' }),
      }),
    ]);
    if (mpToken) {
      setHasMpToken(true);
      setMpToken('');
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function updateDay(key: string, patch: Partial<DayHours>) {
    setBusinessHours((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoUploading(true);
    try {
      // Square-ish icon, so it fits the header/print ticket without
      // stretching — a bit tighter than the receipt photos' 1000px since a
      // logo mark never needs to be that large.
      const dataUrl = await compressImage(file, 400, 0.85);
      setLogoUrl(dataUrl);
    } catch {
      alert('No se pudo procesar la imagen. Probá con otra foto.');
    } finally {
      setLogoUploading(false);
    }
  }

  async function saveFudo() {
    await fetch('/api/v1/admin/pos-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: fudoEnabled, businessId: fudoBusinessId, ...(fudoToken ? { apiToken: fudoToken } : {}) }),
    });
    if (fudoToken) {
      setHasFudoToken(true);
      setFudoToken('');
    }
  }

  function copyAlias() {
    navigator.clipboard.writeText(paymentAlias).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <AppHeader tenantName={session?.user?.tenantSlug ?? ''} activeNav="ajustes" />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 sm:px-8 py-6 space-y-5 animate-in fade-in duration-300">
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in">
          <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
            <span className="material-symbols-rounded text-command-800">settings</span>
          </span>
          <div className="text-xs text-slate-600 space-y-1">
            <p className="font-bold text-sm text-slate-800">Configuración Central de Operaciones y Pagos</p>
            <p>
              <strong>Radio y Costo de Envío:</strong> definí el costo que se suma automáticamente al total del checkout
              y el radio máximo en kilómetros que aceptás para delivery.
            </p>
            <p>
              <strong>Cobros Mercado Pago / Transferencia:</strong> configurá el alias para que el cliente copie y
              transfiera en 1 clic, o cargá el Access Token para habilitar el botón oficial de Mercado Pago Checkout Pro.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Cargando...</p>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
                  <span className="material-symbols-rounded text-base text-command-800">storefront</span>
                  Datos del Local
                </h2>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">Dirección & Horarios</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="relative w-16 h-16 rounded-2xl border-2 border-dashed border-slate-200 hover:border-command-400 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden transition-colors"
                  title="Subir logo del local"
                >
                  {logoUploading ? (
                    <span className="w-4 h-4 border-2 border-slate-300 border-t-command-800 rounded-full animate-spin" />
                  ) : logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Logo del local" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-rounded text-slate-300 text-2xl">add_photo_alternate</span>
                  )}
                </button>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-600">Logo del Local</p>
                  <p className="text-[10px] text-slate-400">
                    Aparece en el encabezado del sistema y en la comanda impresa. Tocá el recuadro para subir uno.
                  </p>
                  {logoUrl && (
                    <button onClick={() => setLogoUrl(null)} className="text-[11px] text-red-500 hover:underline">
                      Quitar logo
                    </button>
                  )}
                </div>
              </div>

              <label className="text-xs text-slate-500 space-y-1 block">
                <span className="font-semibold text-slate-600">Dirección del Local</span>
                <input
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ej: Av. Siempre Viva 742, Springfield"
                />
                <p className="text-[10px] text-slate-400">El radio de envío de la sección de abajo se mide desde esta dirección.</p>
              </label>

              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-600">Horarios de Atención</span>
                <div className="space-y-1.5">
                  {DAYS.map((d) => {
                    const h = businessHours[d.key] ?? DEFAULT_HOURS[d.key];
                    return (
                      <div key={d.key} className="flex items-center gap-2 text-xs">
                        <span className="w-20 shrink-0 text-slate-500 font-medium">{d.label}</span>
                        <label className="flex items-center gap-1 text-slate-400 shrink-0">
                          <input
                            type="checkbox"
                            checked={h.closed}
                            onChange={(e) => updateDay(d.key, { closed: e.target.checked })}
                            className="rounded text-command-800"
                          />
                          Cerrado
                        </label>
                        {!h.closed && (
                          <>
                            <input
                              type="time"
                              className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                              value={h.open}
                              onChange={(e) => updateDay(d.key, { open: e.target.value })}
                            />
                            <span className="text-slate-300">–</span>
                            <input
                              type="time"
                              className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                              value={h.close}
                              onChange={(e) => updateDay(d.key, { close: e.target.value })}
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
                  <span className="material-symbols-rounded text-base text-command-800">two_wheeler</span>
                  Costos de Envío y Medios de Pago
                </h2>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">Delivery & Checkout</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="text-xs text-slate-500 space-y-1">
                  <span className="font-semibold text-slate-600">Costo Fijo de Envío ($ ARS)</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input className="w-full pl-6 pr-3 py-2 border border-slate-200 rounded-xl text-sm font-mono" value={cost} onChange={(e) => setCost(e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <p className="text-[10px] text-slate-400">Se suma al seleccionar Delivery</p>
                </label>
                <label className="text-xs text-slate-500 space-y-1">
                  <span className="font-semibold text-slate-600">Radio Máximo (Kilómetros)</span>
                  <input className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} placeholder="3" />
                  <p className="text-[10px] text-slate-400">{address ? `Desde: ${address}` : 'Cargá la dirección del local arriba para medir el radio desde ahí'}</p>
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                  Alias de Cobro (1 clic copiar)
                  <button onClick={copyAlias} className="text-command-800 hover:underline text-[11px] flex items-center gap-0.5">
                    <span className="material-symbols-rounded text-xs">content_copy</span>
                    {copied ? 'Copiado ✓' : 'Copiar prueba'}
                  </button>
                </label>
                <input className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono uppercase" value={paymentAlias} onChange={(e) => setPaymentAlias(e.target.value)} placeholder="PIZZA.ZEKA.MP" />
                <p className="text-[10px] text-slate-400">Aparece en la pantalla del cliente para transferir</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="text-xs text-slate-500 space-y-1">
                  <span className="font-semibold text-slate-600">Titular de la Cuenta</span>
                  <input className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" value={paymentTitular} onChange={(e) => setPaymentTitular(e.target.value)} />
                </label>
                <label className="text-xs text-slate-500 space-y-1">
                  <span className="font-semibold text-slate-600">CBU / CVU (Opcional)</span>
                  <input className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono" value={paymentCvu} onChange={(e) => setPaymentCvu(e.target.value)} />
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                  Mercado Pago Access Token (Checkout Pro)
                  {hasMpToken && <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-bold">CONFIGURADO</span>}
                </label>
                <div className="relative">
                  <input
                    type={showMpToken ? 'text' : 'password'}
                    className="w-full px-3 py-2 pr-9 border border-slate-200 rounded-xl text-sm font-mono"
                    value={mpToken}
                    onChange={(e) => setMpToken(e.target.value)}
                    placeholder={hasMpToken ? '•••••••••••••••••••••••••• (ya configurado)' : 'APP_USR-...'}
                  />
                  <button onClick={() => setShowMpToken((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <span className="material-symbols-rounded text-base">{showMpToken ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">Credenciales de producción de Developers Mercado Pago. Si está configurado, habilita el botón de pago con tarjeta/saldo MP.</p>
              </div>
            </div>

            {/* Fudo POS — de-emphasized secondary card, per Juan: "puede ir a configuración" */}
            <details className="bg-white rounded-2xl border border-slate-200 shadow-sm animate-in fade-in">
              <summary className="cursor-pointer select-none p-5 flex items-center justify-between text-sm font-bold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-rounded text-base text-slate-400">point_of_sale</span>
                  Integración avanzada: Sistema Gastronómico Fudo
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${fudoEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                  {fudoEnabled ? 'Activo' : 'Desactivado'}
                </span>
              </summary>
              <div className="px-5 pb-5 space-y-3 border-t border-slate-100 pt-4">
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  <input type="checkbox" checked={fudoEnabled} onChange={(e) => setFudoEnabled(e.target.checked)} className="rounded text-command-800" />
                  Sincronizar pedidos entrantes con Fudo en tiempo real
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs text-slate-500 space-y-1">
                    <span className="font-semibold text-slate-600">ID de Sucursal / Local Fudo</span>
                    <input className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono" value={fudoBusinessId} onChange={(e) => setFudoBusinessId(e.target.value)} />
                  </label>
                  <label className="text-xs text-slate-500 space-y-1">
                    <span className="font-semibold text-slate-600 flex items-center gap-1">
                      API Token de Fudo {hasFudoToken && <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-bold">OK</span>}
                    </span>
                    <div className="relative">
                      <input
                        type={showFudoToken ? 'text' : 'password'}
                        className="w-full px-3 py-2 pr-9 border border-slate-200 rounded-xl text-sm font-mono"
                        value={fudoToken}
                        onChange={(e) => setFudoToken(e.target.value)}
                        placeholder={hasFudoToken ? '•••••••••• (ya configurado)' : ''}
                      />
                      <button onClick={() => setShowFudoToken((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <span className="material-symbols-rounded text-base">{showFudoToken ? 'visibility_off' : 'visibility'}</span>
                      </button>
                    </div>
                  </label>
                </div>
                <p className="text-[10px] text-slate-400">
                  Necesita tener contratado el Plan Pro de Fudo y pedir la activación de API para &quot;Sitio Web Propio&quot; a integraciones-oficiales@fu.do.
                </p>
                <button onClick={saveFudo} className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600 transition-colors">
                  Guardar Fudo
                </button>
              </div>
            </details>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Última sincronización guardada: hoy</span>
              <div className="flex items-center gap-2">
                {saved && <span className="text-xs text-emerald-600 animate-in fade-in">Guardado ✓</span>}
                <button
                  onClick={saveAll}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-command-800 hover:bg-command-900 text-white text-xs font-bold uppercase transition-all hover:scale-105 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span className="material-symbols-rounded text-base">save</span>
                  {saving ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
