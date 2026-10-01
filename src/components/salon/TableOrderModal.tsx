'use client';

import { useEffect, useMemo, useState } from 'react';
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

// Bifurcado de NewOrderModal.tsx (Comandero) — mismo picker táctil
// (tap-para-sumar, nota por ítem), sin los campos de delivery/canal/pago
// que no aplican a sumar una ronda de ítems a una mesa ya abierta.
interface TableOrderModalProps {
  tableId: string;
  tableNumber: number;
  onClose: () => void;
  onConfirmed: (orderId: string, itemsByStation: Record<string, { id: string }[]>) => void;
}

export function TableOrderModal({ tableId, tableNumber, onClose, onConfirmed }: TableOrderModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | 'all'>('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/admin/products')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setProducts(d.products.filter((p: Product) => p.isActive));
          setCategories(d.categories);
        }
      });
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (activeCategory !== 'all' && p.categoryId !== activeCategory) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [products, activeCategory, search]);

  const cartByProductId = useMemo(() => new Map(cart.map((l) => [l.productId, l])), [cart]);
  const subtotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);

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

    const res = await fetch(`/api/v1/admin/salon/tables/${tableId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity, notes: l.note || undefined })),
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!data.ok) {
      setError(data.error || 'Error al sumar los ítems');
      return;
    }
    onConfirmed(data.order.id, data.newItemsByStation);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md animate-in fade-in" onClick={onClose} />
      <div className="relative w-full max-w-3xl h-[80vh] max-h-[700px] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <div className="bg-gradient-to-r from-command-950 via-command-900 to-command-800 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <span className="material-symbols-rounded text-limeaccent text-lg">restaurant_menu</span>
            </span>
            <h2 className="font-bold text-base">Mesa {tableNumber} — Sumar ítems</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          <div className="min-w-0 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-2">
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
            <div className="grid grid-cols-2 gap-2 h-80 overflow-y-auto content-start custom-scrollbar pr-1">
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

          <div className="min-w-0 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-2 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Ronda a confirmar</h3>
              <span className="px-2 py-0.5 rounded-full bg-command-800 text-white text-[10px] font-bold">{cart.length} items</span>
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
            <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-command-950 text-base">
              <span>Subtotal ronda</span>
              <span className="font-mono">{formatPesos(subtotal)}</span>
            </div>
          </div>
        </div>

        {error && <p className="px-5 pt-2 text-xs text-red-600 shrink-0">{error}</p>}

        <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-semibold uppercase transition-colors">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={submitting || cart.length === 0}
            className="px-6 py-2.5 rounded-xl bg-command-800 hover:bg-command-900 text-white font-bold text-xs uppercase tracking-wide transition-all hover:scale-[1.02] disabled:opacity-50 flex items-center gap-2"
          >
            <span className="material-symbols-rounded text-base">local_fire_department</span>
            {submitting ? 'Enviando...' : 'Confirmar → Cocina/Barra'}
          </button>
        </div>
      </div>
    </div>
  );
}
