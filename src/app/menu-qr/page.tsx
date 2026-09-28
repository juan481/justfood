'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import QRCode from 'qrcode';
import { AppHeader } from '@/components/AppHeader';
import { Footer } from '@/components/Footer';
import { GuideCard } from '@/components/GuideCard';

interface Lead {
  id: string;
  email: string;
  code: string | null;
  createdAt: string;
}

export default function MenuQrPage() {
  const { data: session } = useSession();
  const [siteUrl, setSiteUrl] = useState('');
  const [savedUrl, setSavedUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/v1/admin/settings?keys=public_site_url')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.settings.public_site_url) {
          setSiteUrl(d.settings.public_site_url);
          setSavedUrl(d.settings.public_site_url);
        }
      });
    fetch('/api/v1/admin/leads')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setLeads(d.leads);
      });
  }, []);

  useEffect(() => {
    if (!savedUrl) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(savedUrl, { width: 320, margin: 1, color: { dark: '#06381a', light: '#ffffff' } }).then(setQrDataUrl);
  }, [savedUrl]);

  async function save() {
    setSaving(true);
    const res = await fetch('/api/v1/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_site_url: siteUrl }),
    });
    setSaving(false);
    if (res.ok) setSavedUrl(siteUrl);
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <AppHeader tenantName={session?.user?.tenantSlug ?? ''} activeNav="qr" />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 sm:px-8 py-6 space-y-6 animate-in fade-in duration-300">
        <GuideCard
          question="¿Cómo funciona el Menú QR?"
          tips={[
            { icon: 'link', title: 'Un solo lugar para pegar la URL', body: 'Poné el link de tu sitio una vez — el QR se regenera solo cada vez que lo cambiás.' },
            { icon: 'print', title: 'Imprimilo donde quieras', body: 'Descargalo en PNG para ponerlo en mesas, vidriera o flyers.' },
            { icon: 'mail', title: 'Leads capturados', body: 'Cada email que deja un cliente a cambio de un descuento queda registrado acá abajo.' },
          ]}
        />

        <h1 className="text-xl font-bold text-command-950">Menú QR & Leads</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 animate-in fade-in">
            <h2 className="font-bold text-sm text-slate-700">Código QR de tu menú</h2>
            <p className="text-xs text-slate-500">
              Apunta a la web del restaurante (la que ya tiene el catálogo y el checkout). Pegala una vez y el QR queda listo
              para imprimir en mesas, vidriera, o flyers.
            </p>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="https://pizzazeka.com.ar"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
              />
              <button
                onClick={save}
                disabled={saving || !siteUrl}
                className="px-4 py-2 rounded-xl bg-command-800 hover:bg-command-900 text-white text-xs font-semibold uppercase transition disabled:opacity-50"
              >
                Guardar
              </button>
            </div>

            {qrDataUrl && (
              <div className="flex flex-col items-center gap-3 pt-2 animate-in fade-in">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR del menú" className="rounded-xl border border-slate-200 p-2" />
                <a
                  href={qrDataUrl}
                  download="justfood-menu-qr.png"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600 transition-colors"
                >
                  <span className="material-symbols-rounded text-base">download</span>
                  Descargar PNG
                </a>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 animate-in fade-in">
            <h2 className="font-bold text-sm text-slate-700">Leads capturados</h2>
            <p className="text-xs text-slate-500">Emails de clientes que dejaron su dato a cambio de un descuento en la web.</p>
            <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
              {leads.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-2 text-sm hover:bg-slate-50 transition-colors px-1 rounded">
                  <span className="text-slate-700">{l.email}</span>
                  <span className="flex items-center gap-2 text-xs text-slate-400">
                    {l.code && <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono">{l.code}</span>}
                    {new Date(l.createdAt).toLocaleDateString('es-AR')}
                  </span>
                </div>
              ))}
              {leads.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">Sin leads todavía.</p>}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
