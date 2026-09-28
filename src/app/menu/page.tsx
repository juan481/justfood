'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AppHeader } from '@/components/AppHeader';
import { Footer } from '@/components/Footer';
import { GuideCard } from '@/components/GuideCard';
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
  isFrozen: boolean;
  categoryId: string | null;
  category: Category | null;
}

export default function MenuPage() {
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/v1/admin/products');
    const data = await res.json();
    if (data.ok) {
      setProducts(data.products);
      setCategories(data.categories);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }

  async function savePrice(product: Product) {
    const price = parseInt(priceDraft, 10);
    if (Number.isNaN(price) || price < 0) {
      setEditingPriceId(null);
      return;
    }
    const res = await fetch(`/api/v1/admin/products/${product.id}/price`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price }),
    });
    const data = await res.json();
    if (data.ok) {
      setProducts((prev) => prev.map((p) => (p.id === product.id ? data.product : p)));
      showToast(`Precio de "${product.name}" actualizado`);
    }
    setEditingPriceId(null);
  }

  async function toggleStock(product: Product) {
    const res = await fetch(`/api/v1/admin/products/${product.id}/toggle-stock`, { method: 'PATCH' });
    const data = await res.json();
    if (data.ok) {
      setProducts((prev) => prev.map((p) => (p.id === product.id ? data.product : p)));
      showToast(`"${product.name}" ${data.product.isActive ? 'vuelve a la carta' : 'pausado'}`);
    }
  }

  async function createProduct() {
    if (!newName || !newPrice) return;
    setCreating(true);
    const res = await fetch('/api/v1/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName,
        price: Number(newPrice),
        categoryId: newCategoryId || undefined,
        description: newDescription || undefined,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (data.ok) {
      setProducts((prev) => [...prev, { ...data.product, category: categories.find((c) => c.id === data.product.categoryId) ?? null }]);
      setShowNewProduct(false);
      setNewName('');
      setNewPrice('');
      setNewDescription('');
      showToast(`"${data.product.name}" agregado al menú`);
    }
  }

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [products, categoryFilter, search]);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader tenantName={session?.user?.tenantSlug ?? ''} activeNav="menu" />

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 sm:px-8 py-6 space-y-4 animate-in fade-in duration-300">
        <GuideCard
          question="¿Cómo funciona este panel de menú?"
          tips={[
            { icon: 'bolt', title: 'Cambiar precio en 1 clic', body: 'Escribí el nuevo valor directo en el recuadro y presioná Enter o el botón verde. Impacta en vivo.' },
            { icon: 'visibility_off', title: 'Pausar por falta de stock', body: 'Hacé clic en la cápsula En Carta para ocultarlo del cotizador al instante sin borrarlo.' },
            { icon: 'add_circle', title: 'Nueva variedad', body: 'Creá pizzas, bebidas o promos con el botón verde. Podés duplicar ingredientes y etiquetas al instante.' },
          ]}
        />

        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-command-950">Menú & Precios</h1>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              className="flex-1 sm:w-64 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-command-800 transition-shadow"
              placeholder="Buscar por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              onClick={() => setShowNewProduct(true)}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-command-800 hover:bg-command-900 text-white text-sm font-semibold transition-all hover:scale-105"
            >
              <span className="material-symbols-rounded text-base">add_circle</span>
              Nueva Variedad
            </button>
          </div>
        </div>

        {showNewProduct && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Nuevo producto</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <input className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" placeholder="Precio" value={newPrice} onChange={(e) => setNewPrice(e.target.value.replace(/\D/g, ''))} />
              <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm capitalize" value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)}>
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Descripción / ingredientes (opcional)" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNewProduct(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-semibold uppercase transition-colors">
                Cancelar
              </button>
              <button
                onClick={createProduct}
                disabled={creating || !newName || !newPrice}
                className="flex-1 px-4 py-2 rounded-xl bg-command-800 hover:bg-command-900 text-white text-xs font-bold uppercase transition-all hover:scale-[1.01] disabled:opacity-50"
              >
                {creating ? 'Creando...' : 'Agregar al menú'}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all hover:scale-105 ${
              categoryFilter === 'all' ? 'bg-command-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-command-300'
            }`}
          >
            Todas
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap capitalize transition-all hover:scale-105 ${
                categoryFilter === c.id ? 'bg-command-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-command-300'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Producto</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Categoría</th>
                <th className="text-right px-4 py-3 font-semibold">Precio</th>
                <th className="text-center px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    Sin productos.
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${!p.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{p.name}</div>
                    {p.description && <div className="text-xs text-slate-400 line-clamp-1">{p.description}</div>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell capitalize text-slate-500">{p.category?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {editingPriceId === p.id ? (
                      <input
                        autoFocus
                        className="w-24 text-right px-2 py-1 border border-command-800 rounded-lg font-mono"
                        value={priceDraft}
                        onChange={(e) => setPriceDraft(e.target.value.replace(/\D/g, ''))}
                        onBlur={() => savePrice(p)}
                        onKeyDown={(e) => e.key === 'Enter' && savePrice(p)}
                      />
                    ) : (
                      <button
                        className="hover:text-command-800 hover:underline"
                        onClick={() => {
                          setEditingPriceId(p.id);
                          setPriceDraft(String(p.price));
                        }}
                      >
                        {formatPesos(p.price)}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleStock(p)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all hover:scale-105 ${
                        p.isActive ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {p.isActive ? 'En Carta' : 'Pausado'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <Footer />

      {toast && (
        <div className="fixed bottom-6 right-6 bg-command-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm z-50 animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  );
}
