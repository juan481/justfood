'use client';

import Image from 'next/image';
import { useState } from 'react';

const features = [
  ['local_fire_department', 'Cocina en tiempo real', 'Cada pedido entra al comandero apenas se confirma.'],
  ['menu_book', 'Menú y stock', 'Precios y disponibilidad siempre actualizados.'],
  ['two_wheeler', 'Delivery bajo control', 'Asigná cadetes y controlá cada entrega.'],
  ['payments', 'Caja ordenada', 'Pagos, transferencias y efectivo en un solo lugar.'],
  ['qr_code_2', 'Menú QR que vende', 'Tus clientes piden desde la mesa o el celular.'],
  ['insights', 'Decisiones con datos', 'Ventas, productos y horarios pico en vivo.'],
];

const faqs = [
  ['¿Sirve para delivery, salón y retiro?', 'Sí. JustFood concentra todos tus pedidos para que cocina, caja y repartidores operen con la misma información.'],
  ['¿Puedo usarlo desde una tablet?', 'Sí. Está pensado para computadoras, tablets y celulares durante el servicio.'],
  ['¿Qué ocurre si un producto se queda sin stock?', 'Lo pausás con un toque y el menú se actualiza para tu equipo y tus clientes.'],
  ['¿El comandero se actualiza solo?', 'Sí. Los pedidos nuevos aparecen en tiempo real en la pantalla de cocina.'],
];

function Icon({ children, className = '' }: { children: string; className?: string }) {
  return <span className={'material-symbols-rounded ' + className}>{children}</span>;
}

export function JustFoodLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const crmLogin = 'https://crm.justcreate.com.ar/login';
  const demoUrl = 'https://wa.me/5491124527669?text=Hola%20JustFood%2C%20quiero%20coordinar%20una%20demo.';

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6f1] font-['Poppins'] text-slate-900 selection:bg-limeaccent selection:text-command-950">
      <header className="sticky top-3 z-50 px-3 sm:top-5 sm:px-6">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between rounded-full border border-white/80 bg-white/95 px-4 shadow-[0_16px_45px_-16px_rgba(4,38,16,.45)] backdrop-blur-xl sm:h-20 sm:px-7">
          <a href="#inicio" aria-label="JustFood inicio"><Image src="/logo-justfood.png" alt="JustFood" width={186} height={57} priority className="h-9 w-auto transition-transform hover:scale-[1.02] sm:h-11" /></a>
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex"><a href="#funciones" className="hover:text-command-800">Funciones</a><a href="#operacion" className="hover:text-command-800">Cómo funciona</a><a href="#preguntas" className="hover:text-command-800">Preguntas</a></nav>
          <div className="flex items-center gap-2"><a href={crmLogin} className="inline-flex items-center gap-2 rounded-full bg-command-800 px-3.5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-command-800/20 transition-all hover:-translate-y-0.5 hover:bg-command-900 sm:px-5 sm:text-sm"><Icon className="text-base text-limeaccent">login</Icon>Ingreso clientes</a><button onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menú" className="rounded-full border border-slate-200 bg-slate-50 p-2.5 md:hidden"><Icon>{menuOpen ? 'close' : 'menu'}</Icon></button></div>
        </div>
        {menuOpen && <nav className="mx-auto mt-2 max-w-6xl rounded-3xl border border-white bg-white p-3 shadow-xl md:hidden">{['funciones', 'operacion', 'preguntas'].map((item) => <a key={item} href={'#' + item} onClick={() => setMenuOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-limeaccent/20">{item === 'funciones' ? 'Funciones' : item === 'operacion' ? 'Cómo funciona' : 'Preguntas frecuentes'}</a>)}</nav>}
      </header>

      <section id="inicio" className="relative isolate overflow-hidden px-4 pb-16 pt-14 text-center sm:px-6 sm:pb-24 sm:pt-24">
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(159,247,153,.7),rgba(244,246,241,0)_66%)] blur-2xl" />
        <div className="mx-auto max-w-6xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-command-800/10 bg-white/80 px-4 py-2 text-xs font-semibold text-command-800 shadow-sm"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-lime-500" />Gestión gastronómica en tiempo real</p>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold leading-[1.06] tracking-tight text-command-950 sm:text-5xl lg:text-7xl">Tu local no para. <span className="bg-gradient-to-r from-command-700 via-emerald-600 to-command-950 bg-clip-text text-transparent">Tu gestión tampoco.</span></h1>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-lg">Pedidos, cocina, menú, pagos, cadetes y caja conectados en un solo sistema para que tu equipo trabaje rápido y tus clientes vuelvan.</p>
          <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center"><a href={demoUrl} target="_blank" rel="noreferrer" className="group inline-flex items-center justify-center gap-2 rounded-full bg-command-800 px-7 py-4 text-sm font-semibold text-white shadow-xl shadow-command-800/25 transition-all hover:-translate-y-1 hover:bg-command-900">Quiero una demo para mi local <Icon className="transition-transform group-hover:translate-x-1">arrow_forward</Icon></a><a href="#funciones" className="inline-flex items-center justify-center gap-2 rounded-full border border-command-800/15 bg-white px-7 py-4 text-sm font-semibold text-command-800 transition-all hover:-translate-y-1 hover:bg-limeaccent/15"><Icon>visibility</Icon>Conocer JustFood</a></div>
          <div className="mx-auto mt-9 flex max-w-2xl flex-col items-center gap-3 rounded-3xl bg-command-950 px-5 py-4 text-white shadow-2xl sm:flex-row sm:rounded-full"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-limeaccent text-command-950"><Icon>storefront</Icon></span><p className="text-xs text-white/75 sm:text-sm">¿Ya usás JustFood en tu restaurante? <strong className="text-white">Ingresá a tu espacio de trabajo.</strong></p><a href={crmLogin} className="rounded-full bg-white px-4 py-2 text-xs font-bold text-command-800 transition-transform hover:scale-105">Ingresar</a></div>
          <div className="mx-auto mt-12 grid max-w-5xl grid-cols-2 gap-3 text-left md:grid-cols-4">{[['bolt', 'Tiempo real', 'Pedidos al instante'], ['dashboard', 'Un panel', 'Toda la operación'], ['verified', 'Más control', 'Menos errores'], ['devices', 'Flexible', 'PC, tablet o móvil']].map(([icon, title, text]) => <div key={title} className="landing-rise rounded-2xl border border-white bg-white/75 p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"><Icon className="text-command-700">{icon}</Icon><p className="mt-3 text-sm font-bold text-command-950">{title}</p><p className="mt-1 text-[11px] text-slate-500">{text}</p></div>)}</div>
        </div>
      </section>

      <section id="funciones" className="bg-command-950 px-4 py-16 text-white sm:px-6 sm:py-24"><div className="mx-auto max-w-6xl"><div className="max-w-2xl"><p className="text-sm font-semibold text-limeaccent">TODO CONECTADO</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">La operación completa, sin cambiar de pantalla.</h2><p className="mt-5 text-sm leading-relaxed text-white/65 sm:text-base">JustFood acompaña el ritmo real de una cocina y ordena cada parte de tu negocio.</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{features.map(([icon, title, text]) => <article key={title} className="group rounded-3xl border border-white/10 bg-white/[.055] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-limeaccent/50 hover:bg-white/[.09]"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-limeaccent text-command-950 transition-transform group-hover:rotate-6 group-hover:scale-110"><Icon>{icon}</Icon></span><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-white/60">{text}</p></article>)}</div></div></section>

      <section id="operacion" className="px-4 py-16 sm:px-6 sm:py-24"><div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[.9fr_1.1fr]"><div><p className="text-sm font-bold text-command-700">DEL PEDIDO A LA ENTREGA</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-command-950 sm:text-5xl">Cada área sabe qué hacer, justo cuando tiene que hacerlo.</h2><p className="mt-5 text-sm leading-relaxed text-slate-600 sm:text-base">Una operación más clara se nota en el tiempo de entrega, la calidad del servicio y el cierre de caja.</p><div className="mt-8 space-y-4">{[['1', 'Entra el pedido', 'Web, WhatsApp, salón o mostrador: todo llega al mismo lugar.'], ['2', 'Cocina lo ve en vivo', 'El KDS ordena las comandas y avisa cuando hay algo nuevo.'], ['3', 'Entregás y controlás', 'Seguís el pago, el reparto y el resultado del día.']].map(([number, title, text]) => <div key={number} className="flex gap-4 rounded-2xl p-3 transition-colors hover:bg-white"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-command-800 text-sm font-bold text-limeaccent">{number}</span><div><h3 className="font-bold text-command-950">{title}</h3><p className="mt-1 text-sm text-slate-500">{text}</p></div></div>)}</div></div><div className="rounded-[2rem] bg-command-950 p-4 shadow-2xl shadow-command-950/25 sm:p-6"><div className="rounded-[1.5rem] border border-white/10 bg-[#08391c] p-5 sm:p-7"><div className="flex items-center justify-between border-b border-white/10 pb-4"><span className="text-xs font-semibold text-white">● Cocina en vivo</span><span className="rounded-full bg-white/10 px-3 py-1 text-[10px] text-white/65">3 pedidos activos</span></div><div className="mt-5 space-y-3">{[['#042', '2 x Hamburguesa doble', 'Hace 1 min'], ['#041', '1 x Pizza muzzarella', 'En preparación'], ['#040', 'Combo familiar', 'Listo para enviar']].map(([code, order, status], index) => <div key={code} className={'rounded-2xl border p-4 transition-transform hover:scale-[1.02] ' + (index === 0 ? 'border-limeaccent/50 bg-limeaccent/10' : 'border-white/10 bg-white/5')}><p className="font-mono text-sm font-bold text-limeaccent">{code}</p><p className="mt-2 text-sm font-semibold text-white">{order}</p><p className="mt-1 text-xs text-white/45">{status}</p></div>)}</div></div></div></div></section>

      <section id="preguntas" className="bg-white px-4 py-16 sm:px-6 sm:py-24"><div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[.75fr_1.25fr]"><div><p className="text-sm font-bold text-command-700">PREGUNTAS FRECUENTES</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-command-950 sm:text-4xl">Una forma más simple de trabajar todos los días.</h2><a href={demoUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-command-800">Hablemos de tu local <Icon>arrow_forward</Icon></a></div><div className="space-y-3">{faqs.map(([question, answer], index) => <div key={question} className="overflow-hidden rounded-2xl border border-slate-200"><button onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between gap-4 p-5 text-left text-sm font-bold text-slate-800"><span>{question}</span><Icon className={'text-command-700 transition-transform ' + (openFaq === index ? 'rotate-180' : '')}>expand_more</Icon></button>{openFaq === index && <p className="px-5 pb-5 text-sm leading-relaxed text-slate-500">{answer}</p>}</div>)}</div></div></section>
      <section className="bg-command-950 px-4 py-16 text-center text-white sm:px-6 sm:py-24"><Image src="/logo-justfood.png" alt="JustFood" width={186} height={57} className="mx-auto h-11 w-auto brightness-0 invert" /><h2 className="mx-auto mt-7 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">Hacé que tu operación siga el ritmo de tu cocina.</h2><p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">Conocé cómo JustFood puede ordenar tu local, liberar tiempo de tu equipo y mejorar cada pedido.</p><a href={demoUrl} target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center gap-2 rounded-full bg-limeaccent px-7 py-4 text-sm font-bold text-command-950 transition-all hover:-translate-y-1">Solicitar una demo <Icon>arrow_forward</Icon></a></section>
      <footer className="bg-[#031b0b] px-4 py-8 text-center text-xs text-white/45">© 2026 JustFood · Gestión gastronómica · <a href="https://justcreate.com.ar" className="hover:text-limeaccent">Just Create</a></footer>
    </main>
  );
}
