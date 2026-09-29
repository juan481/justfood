'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatPesos } from '@/lib/format';

interface Category {
  id: string;
  name: string;
}
interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isActive: boolean;
  categoryId: string | null;
}
interface CartLine {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  note: string;
  showNote: boolean;
}

type OrderKind = 'delivery' | 'mostrador' | 'salon';

const KIND_META: Record<OrderKind, { label: string; sub: string; icon: string }> = {
  delivery: { label: 'Delivery', sub: 'Envío', icon: 'two_wheeler' },
  mostrador: { label: 'Retiro Mostrador', sub: '$0 envío', icon: 'storefront' },
  salon: { label: 'Mesa / Salón', sub: 'Consumo aquí', icon: 'restaurant' },
};

const PAYMENT_METHODS: { key: string; label: string; icon: string }[] = [
  { key: 'efectivo', label: 'Efectivo', icon: 'payments' },
  { key: 'transferencia', label: 'Transferencia', icon: 'account_balance' },
  { key: 'mercadopago', label: 'Mercado Pago', icon: 'credit_card' },
];

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

interface NewOrderModalProps {
  onClose: () => void;
  onCreated: (orderId: string, autoprint: boolean) => void;
}

export function NewOrderModal({ onClose, onCreated }: NewOrderModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | 'all'>('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  const [orderKind, setOrderKind] = useState<OrderKind>('delivery');
  const [channel, setChannel] = useState<'MOSTRADOR' | 'WHATSAPP'>('MOSTRADOR');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [addressExtra, setAddressExtra] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [paymentStatus, setPaymentStatus] = useState<'cobrado' | 'pendiente'>('pendiente');
  const [autoprint, setAutoprint] = useState(true);

  const [frequentInfo, setFrequentInfo] = useState<{ orderCount: number; lastAddress: string | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedPhone = useDebouncedValue(customerPhone, 500);

  useEffect(() => {
    fetch('/api/v1/admin/products')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setProducts(d.products.filter((p: Product) => p.isActive));
          setCategories(d.categories);
        }
      });
    // Prefill from Ajustes — staff shouldn't have to remember/retype the
    // standard delivery cost on every single order.
    fetch('/api/v1/admin/delivery-zone')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setDeliveryFee(d.cost);
      });
  }, []);

  useEffect(() => {
    if (debouncedPhone.trim().length < 6) {
      setFrequentInfo(null);
      return;
    }
    fetch(`/api/v1/admin/customers/lookup?phone=${encodeURIComponent(debouncedPhone.trim())}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.orderCount > 0) {
          setFrequentInfo({ orderCount: d.orderCount, lastAddress: d.lastAddress });
          if (!customerName && d.knownName) setCustomerName(d.knownName);
          if (!address && d.lastAddress) setAddress(d.lastAddress);
        } else {
          setFrequentInfo(null);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedPhone]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (activeCategory !== 'all' && p.categoryId !== activeCategory) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [products, activeCategory, search]);

  const cartByProductId = useMemo(() => new Map(cart.map((l) => [l.productId, l])), [cart]);
  const subtotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const total = subtotal + (orderKind === 'delivery' ? deliveryFee : 0);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) => (l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1, note: '', showNote: false }];
    });
    setJustAddedId(product.id);
    setTimeout(() => setJustAddedId((current) => (current === product.id ? null : current)), 500);
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + delta } : l)).filter((l) => l.quantity > 0)
    );
  }

  function toggleNote(productId: string) {
    setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, showNote: !l.showNote } : l)));
  }

  function setNote(productId: string, note: string) {
    setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, note } : l)));
  }

  async function submit() {
    if (cart.length === 0) {
      setError('Agregá al menos un producto.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/v1/admin/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel,
        items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity, notes: l.note || undefined })),
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        address: orderKind === 'delivery' ? [address, addressExtra].filter(Boolean).join(' — ') : undefined,
        notes: orderNote || undefined,
        payment_method: paymentMethod,
        payment_status: paymentStatus === 'cobrado' ? 'pagado' : orderKind === 'delivery' ? 'por_verificar' : 'pendiente',
        delivery_type: orderKind,
        delivery_fee: orderKind === 'delivery' ? deliveryFee : 0,
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!data.ok) {
      setError(data.error || 'Error al crear el pedido');
      return;
    }
    onCreated(data.order.id, autoprint);
  }

  const now = new Date();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md animate-in fade-in" onClick={onClose} />
      <div className="relative w-full max-w-4xl h-[85vh] max-h-[780px] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-command-950 via-command-900 to-command-800 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <span className="material-symbols-rounded text-limeaccent text-lg">edit_note</span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base">Nuevo Pedido / Comanda Manual</h2>
              </div>
              <p className="text-[11px] text-white/60 flex items-center gap-1">
                <span className="material-symbols-rounded text-xs">schedule</span>
                {now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs · Carga rápida directa para
                cocina y despacho
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        {/* Order kind tabs */}
        <div className="grid grid-cols-3 gap-2 p-3 shrink-0 border-b border-slate-100">
          {(Object.keys(KIND_META) as OrderKind[]).map((kind) => {
            const meta = KIND_META[kind];
            const active = orderKind === kind;
            return (
              <button
                key={kind}
                onClick={() => setOrderKind(kind)}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  active ? 'bg-command-800 text-white scale-[1.02] shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <span className="material-symbols-rounded text-base">{meta.icon}</span>
                <span className="flex flex-col items-start leading-tight">
                  {meta.label}
                  <span className={`text-[10px] font-normal ${active ? 'text-limeaccent' : 'text-slate-400'}`}>{meta.sub}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          {/* LEFT: customer + product picker — its own scroll region, fixed
              size, so switching category never resizes the modal around it. */}
          <div className="min-w-0 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1 w-fit">
                <button
                  onClick={() => setChannel('MOSTRADOR')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    channel === 'MOSTRADOR' ? 'bg-white text-command-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span className="material-symbols-rounded text-sm">storefront</span>
                  Mostrador / Teléfono
                </button>
                <button
                  onClick={() => setChannel('WHATSAPP')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    channel === 'WHATSAPP' ? 'bg-white text-command-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span className="material-symbols-rounded text-sm">chat</span>
                  WhatsApp
                </button>
              </div>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Datos del destino & cliente</h3>
                {frequentInfo && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 animate-in fade-in">
                    <span className="material-symbols-rounded text-sm">verified</span>
                    Cliente frecuente ({frequentInfo.orderCount} pedidos)
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="col-span-2 sm:col-span-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-command-800 transition-shadow"
                  placeholder="Nombre completo"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
                <input
                  className="col-span-2 sm:col-span-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-command-800 transition-shadow"
                  placeholder="Teléfono / WhatsApp"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
                {orderKind === 'delivery' && (
                  <>
                    <input
                      className="col-span-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-command-800 transition-shadow"
                      placeholder="Dirección de entrega"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                    <input
                      className="col-span-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-command-800 transition-shadow"
                      placeholder="Opciones / Piso (entre calles, piso, timbre...)"
                      value={addressExtra}
                      onChange={(e) => setAddressExtra(e.target.value)}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Añadir items al pedido</h3>
              <div className="relative">
                <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                <input
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-command-800 transition-shadow"
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-2 min-w-0">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeCategory === 'all' ? 'bg-command-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  Todas
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCategory(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap capitalize transition-all ${
                      activeCategory === c.id ? 'bg-command-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              {/* Fixed height (not max-height): a category with 2 products
                  must occupy the same space as one with 20, or the whole
                  modal resizes every time you switch categories. */}
              <div className="grid grid-cols-2 gap-2 h-64 overflow-y-auto content-start custom-scrollbar pr-1">
                {filteredProducts.map((p) => {
                  const inCart = cartByProductId.get(p.id);
                  const justAdded = justAddedId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className={`relative text-left p-2.5 rounded-xl border transition-all ${
                        inCart ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:border-command-300 hover:bg-slate-50'
                      } ${justAdded ? 'scale-95 ring-2 ring-limeaccent' : 'scale-100'}`}
                    >
                      {inCart && (
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center animate-in zoom-in">
                          {inCart.quantity}
                        </span>
                      )}
                      <div className="text-xs font-bold text-slate-800 truncate">{p.name}</div>
                      {p.description && <div className="text-[10px] text-slate-400 line-clamp-1">{p.description}</div>}
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-mono text-xs text-command-800 font-semibold">{formatPesos(p.price)}</span>
                        <span className="text-[10px] font-semibold text-command-700">{inCart ? '+ Sumar' : '+ Añadir'}</span>
                      </div>
                    </button>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <p className="col-span-2 text-center text-xs text-slate-400 py-6">Sin productos para este filtro.</p>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: cart + payment */}
          <div className="min-w-0 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-4 bg-slate-50/50">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Comanda en construcción</h3>
                <span className="px-2 py-0.5 rounded-full bg-command-800 text-white text-[10px] font-bold">
                  {cart.length} items
                </span>
              </div>

              <div className="space-y-2 min-h-[60px]">
                {cart.length === 0 && (
                  <p className="text-xs text-slate-400 italic py-4 text-center border-2 border-dashed border-slate-200 rounded-xl">
                    Tocá un producto de la izquierda para agregarlo
                  </p>
                )}
                {cart.map((line) => (
                  <div key={line.productId} className="bg-white rounded-xl border border-slate-200 p-2.5 space-y-1.5 animate-in fade-in slide-in-from-right-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-700 truncate flex-1">{line.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => changeQty(line.productId, -1)} className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors font-bold text-sm">
                          −
                        </button>
                        <span className="w-5 text-center text-sm font-semibold">{line.quantity}</span>
                        <button onClick={() => changeQty(line.productId, 1)} className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors font-bold text-sm">
                          +
                        </button>
                      </div>
                      <span className="font-mono text-xs text-slate-500 w-16 text-right shrink-0">{formatPesos(line.price * line.quantity)}</span>
                    </div>
                    {line.showNote ? (
                      <input
                        autoFocus
                        className="w-full px-2 py-1 text-xs border border-amber-200 bg-amber-50 rounded-lg focus:outline-none"
                        placeholder="Nota para este ítem (ej: sin cebolla)"
                        value={line.note}
                        onChange={(e) => setNote(line.productId, e.target.value)}
                        onBlur={() => !line.note && toggleNote(line.productId)}
                      />
                    ) : (
                      <button onClick={() => toggleNote(line.productId)} className="text-[11px] text-slate-400 hover:text-command-800 transition-colors flex items-center gap-1">
                        <span className="material-symbols-rounded text-xs">{line.note ? 'sticky_note_2' : 'add'}</span>
                        {line.note || 'Agregar nota'}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="relative">
                <span className="material-symbols-rounded absolute left-2.5 top-2.5 text-amber-500 text-sm">sticky_note_2</span>
                <textarea
                  className="w-full pl-8 pr-2.5 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs placeholder-amber-700/50 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none transition-shadow"
                  placeholder="Nota directa de cocina / horno (ej: masa bien dorada, entregar caliente)"
                  rows={2}
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Método & Estado de Cobro</h3>
              <div className="grid grid-cols-3 gap-1.5">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setPaymentMethod(m.key)}
                    className={`flex flex-col items-center gap-1 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                      paymentMethod === m.key ? 'bg-command-800 text-white scale-[1.03]' : 'bg-white border border-slate-200 text-slate-500 hover:border-command-300'
                    }`}
                  >
                    <span className="material-symbols-rounded text-base">{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setPaymentStatus('cobrado')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    paymentStatus === 'cobrado' ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-emerald-300'
                  }`}
                >
                  Ya Cobrado
                </button>
                <button
                  onClick={() => setPaymentStatus('pendiente')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    paymentStatus === 'pendiente' ? 'bg-orange-500 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-orange-300'
                  }`}
                >
                  Pendiente (Cobrar al entregar)
                </button>
              </div>
            </div>

            {orderKind === 'delivery' && (
              <label className="flex items-center justify-between text-xs text-slate-500">
                Costo de envío
                <input
                  type="number"
                  min={0}
                  className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-sm font-mono text-right"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(Number(e.target.value) || 0)}
                />
              </label>
            )}

            <div className="border-t border-slate-200 pt-2 space-y-1 text-sm">
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Subtotal Productos</span>
                <span className="font-mono">{formatPesos(subtotal)}</span>
              </div>
              {orderKind === 'delivery' && (
                <div className="flex justify-between text-slate-500 text-xs">
                  <span>Costo Envío Delivery</span>
                  <span className="font-mono">{formatPesos(deliveryFee)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-command-950 text-base pt-1">
                <span>Total Comanda</span>
                <span className="font-mono">{formatPesos(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {error && <p className="px-5 pt-2 text-xs text-red-600 shrink-0">{error}</p>}

        <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <label className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
            <input type="checkbox" checked={autoprint} onChange={(e) => setAutoprint(e.target.checked)} className="rounded text-command-800 focus:ring-command-800" />
            Imprimir comanda automáticamente
          </label>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-semibold uppercase transition-colors">
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={submitting || cart.length === 0}
              className="px-6 py-2.5 rounded-xl bg-command-800 hover:bg-command-900 text-white font-bold text-xs uppercase tracking-wide transition-all hover:scale-[1.02] disabled:opacity-50 flex items-center gap-2"
            >
              <span className="material-symbols-rounded text-base">local_fire_department</span>
              {submitting ? 'Enviando...' : 'Confirmar → Nuevos / Recibidos'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
