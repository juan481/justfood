'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AppHeader } from '@/components/AppHeader';
import { Footer } from '@/components/Footer';
import { GuideCard } from '@/components/GuideCard';
import { formatPesos, waLink } from '@/lib/format';

interface Courier {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  vehicle: string | null;
  plate: string | null;
  tariffPerDelivery: number;
  isActiveToday: boolean;
  status: 'DISPONIBLE' | 'EN_VIAJE' | 'INACTIVO';
  deliveriesToday: number;
  earnedToday: number;
  cashPending: number;
}
interface Stats {
  connectedCount: number;
  totalCouriers: number;
  deliveriesToday: number;
  avgDeliveryMin: number;
  effectivenessPct: number;
  totalCommissions: number;
  totalCashPending: number;
}

const STATUS_META: Record<Courier['status'], { label: string; dot: string; className: string }> = {
  DISPONIBLE: { label: 'En Base · Disponible', dot: 'bg-emerald-500', className: 'text-emerald-700' },
  EN_VIAJE: { label: 'En Viaje', dot: 'bg-blue-500', className: 'text-blue-700' },
  INACTIVO: { label: 'Inactivo / Franco', dot: 'bg-slate-300', className: 'text-slate-400' },
};

function StatCard({ label, value, sub, icon, accent }: { label: string; value: string; sub?: string; icon: string; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow animate-in fade-in">
      <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wide">
        <span className={`material-symbols-rounded text-base ${accent}`}>{icon}</span>
        {label}
      </div>
      <div className="text-xl font-bold text-command-950 mt-1 font-mono">{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function NewCourierForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [plate, setPlate] = useState('');
  const [tariff, setTariff] = useState(2000);
  const [enableToday, setEnableToday] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!firstName || !lastName) return;
    setSubmitting(true);
    const res = await fetch('/api/v1/admin/couriers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, phone, vehicle, plate, tariffPerDelivery: tariff, isActiveToday: enableToday }),
    });
    setSubmitting(false);
    if (res.ok) {
      setFirstName('');
      setLastName('');
      setPhone('');
      setVehicle('');
      setPlate('');
      onCreated();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-command-800 hover:bg-command-900 text-white font-semibold text-sm transition-all hover:scale-105"
      >
        <span className="material-symbols-rounded text-base">person_add</span>
        Nuevo Cadete
      </button>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Alta Rápida de Cadete</h3>
      <div className="grid grid-cols-2 gap-2">
        <input className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Nombre" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Apellido" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        <input className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Celular / WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Vehículo / Modelo" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
        <input className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Patente" value={plate} onChange={(e) => setPlate(e.target.value)} />
        <label className="flex items-center justify-between px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-500">
          Tarifa por envío
          <input type="number" className="w-20 text-right font-mono" value={tariff} onChange={(e) => setTariff(Number(e.target.value) || 0)} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-500">
        <input type="checkbox" checked={enableToday} onChange={(e) => setEnableToday(e.target.checked)} className="rounded text-command-800" />
        Habilitar de inmediato para el turno de hoy
      </label>
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-semibold uppercase transition-colors">
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={submitting || !firstName || !lastName}
          className="flex-1 px-4 py-2 rounded-xl bg-command-800 hover:bg-command-900 text-white text-xs font-bold uppercase transition-all hover:scale-[1.01] disabled:opacity-50"
        >
          {submitting ? 'Guardando...' : 'Guardar y Activar Cadete'}
        </button>
      </div>
    </div>
  );
}

export default function CadetesPage() {
  const { data: session } = useSession();
  const [fleet, setFleet] = useState<Courier[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);

  async function load() {
    const res = await fetch('/api/v1/admin/couriers/summary');
    const data = await res.json();
    if (data.ok) {
      setFleet(data.fleet);
      setStats(data.stats);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(courier: Courier) {
    await fetch(`/api/v1/admin/couriers/${courier.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActiveToday: !courier.isActiveToday, status: !courier.isActiveToday ? 'DISPONIBLE' : 'INACTIVO' }),
    });
    load();
  }

  async function settleAll() {
    if (!confirm('¿Confirmás que recibiste el efectivo de todos los cadetes con rendición pendiente?')) return;
    setSettling(true);
    await fetch('/api/v1/admin/couriers/settle-cash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    setSettling(false);
    load();
  }

  const now = new Date();

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <AppHeader tenantName={session?.user?.tenantSlug ?? ''} activeNav="cadetes" />

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 sm:px-8 py-6 space-y-6 animate-in fade-in duration-300">
        <GuideCard
          question="¿Cómo funciona este panel de cadetes?"
          tips={[
            { icon: 'toggle_on', title: 'Activar / desactivar', body: 'El switch de cada cadete lo saca del turno de hoy sin borrar su ficha — para francos o vacaciones.' },
            { icon: 'savings', title: 'Rendición de caja', body: 'El efectivo cobrado en la puerta se acumula por cadete hasta que confirmás que te lo entregaron.' },
            { icon: 'moped', title: 'Contador en el Comandero', body: 'Cuántos están conectados se ve también arriba del tablero de cocina, sin entrar acá.' },
          ]}
        />
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-command-800">moped</span>
              <h1 className="text-xl font-bold text-command-950">Cadetes & Repartidores</h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold">Wilde Central</span>
            </div>
            <p className="text-xs text-slate-500">
              Control de flota activa, asignación de pedidos en calle y liquidación diaria de envíos — hoy{' '}
              {now.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
            </p>
          </div>
          <NewCourierForm onCreated={load} />
        </div>

        {loading || !stats ? (
          <p className="text-sm text-slate-400">Cargando...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Cadetes Conectados"
                value={`${stats.connectedCount} / ${stats.totalCouriers}`}
                sub="en servicio"
                icon="person_pin_circle"
                accent="text-emerald-600"
              />
              <StatCard label="Repartos Realizados Hoy" value={String(stats.deliveriesToday)} sub={`${stats.effectivenessPct}% efectividad`} icon="local_shipping" accent="text-command-800" />
              <StatCard label="Tiempo Prom. de Entrega" value={`${stats.avgDeliveryMin} min`} sub="por viaje" icon="schedule" accent="text-blue-600" />
              <StatCard label="Total Comisiones Turno" value={formatPesos(stats.totalCommissions)} icon="payments" accent="text-orange-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-3">
                <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  Equipo de Reparto
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-semibold">{fleet.length} registrados</span>
                </h2>
                <div className="space-y-2">
                  {fleet.map((c) => {
                    const meta = STATUS_META[c.status];
                    const initials = `${c.firstName[0] ?? ''}${c.lastName[0] ?? ''}`.toUpperCase();
                    return (
                      <div key={c.id} className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex items-center gap-3 hover:shadow-md transition-shadow animate-in fade-in ${!c.isActiveToday ? 'opacity-50' : ''}`}>
                        <span className="w-10 h-10 rounded-full bg-command-800/10 text-command-800 font-bold text-sm flex items-center justify-center shrink-0">{initials}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-slate-800 truncate">
                            {c.firstName} {c.lastName}
                          </div>
                          <div className={`text-[11px] flex items-center gap-1 ${meta.className}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                            {meta.label}
                            {c.vehicle && <span className="text-slate-400">· {c.vehicle}</span>}
                            {c.plate && <span className="text-slate-400">{c.plate}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0 text-xs">
                          <div className="font-mono font-semibold text-slate-700">{c.deliveriesToday} envíos ({formatPesos(c.earnedToday)})</div>
                          {c.cashPending > 0 && <div className="text-amber-600 font-mono">Rinde {formatPesos(c.cashPending)}</div>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {c.phone && (
                            <a href={waLink(c.phone)} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center transition-colors">
                              <span className="material-symbols-rounded text-base">chat</span>
                            </a>
                          )}
                          <button
                            onClick={() => toggleActive(c)}
                            title={c.isActiveToday ? 'Desactivar para hoy' : 'Activar'}
                            className={`w-10 h-6 rounded-full transition-colors relative ${c.isActiveToday ? 'bg-emerald-500' : 'bg-slate-300'}`}
                          >
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${c.isActiveToday ? 'left-4.5' : 'left-0.5'}`} style={{ left: c.isActiveToday ? '18px' : '2px' }} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {fleet.length === 0 && (
                    <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                      Sin cadetes registrados — dalos de alta con el botón de arriba.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-700">Rendición de Caja</h2>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">Pendiente</span>
                  </div>
                  <div className="space-y-1.5">
                    {fleet
                      .filter((c) => c.cashPending > 0)
                      .map((c) => (
                        <div key={c.id} className="flex justify-between text-xs text-slate-600">
                          <span>
                            {c.firstName} {c.lastName}
                          </span>
                          <span className="font-mono">{formatPesos(c.cashPending)}</span>
                        </div>
                      ))}
                    {fleet.every((c) => c.cashPending === 0) && <p className="text-xs text-slate-400">Nada pendiente de rendir.</p>}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <span className="text-sm font-bold text-slate-800">Total a Rendir</span>
                    <span className="font-mono font-bold text-command-950">{formatPesos(stats.totalCashPending)}</span>
                  </div>
                  <button
                    onClick={settleAll}
                    disabled={settling || stats.totalCashPending === 0}
                    className="w-full py-2.5 rounded-xl bg-command-800 hover:bg-command-900 text-white text-xs font-bold uppercase transition-all hover:scale-[1.01] disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-rounded text-base">savings</span>
                    Recibir y Cerrar Rendición
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
