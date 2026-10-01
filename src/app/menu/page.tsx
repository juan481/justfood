'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AppHeader } from '@/components/AppHeader';
import { Footer } from '@/components/Footer';
import { GuideCard } from '@/components/GuideCard';
import { formatPesos } from '@/lib/format';

type PrepArea = 'COCINA' | 'BARRA' | 'SIN_IMPRESION';
interface Category {
  id: string;
  name: string;
  prepArea: PrepArea;
}

const PREP_AREA_LABEL: Record<PrepArea, string> = { COCINA: '🔥 Cocina', BARRA: '🍹 Barra', SIN_IMPRESION: '❄️ Sin impresión' };
interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isActive: boolean;
  isFrozen: boolean;
  categoryId: string | null;
  category: Category | null;
  sortOrder: number;
}
interface Section {
  id: string;
  name: string;
  products: Product[];
}

export default function MenuPage() {
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState('');
  const [editingDetailsId, setEditingDetailsId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIsFrozen, setNewIsFrozen] = useState(false);
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

  function startEditingDetails(product: Product) {
    setEditingDetailsId(product.id);
    setNameDraft(product.name);
    setDescriptionDraft(product.description ?? '');
  }

  async function saveDetails(product: Product) {
    const name = nameDraft.trim();
    if (!name) {
      setEditingDetailsId(null);
      return;
    }
    setSavingDetails(true);
    const res = await fetch(`/api/v1/admin/products/${product.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: descriptionDraft.trim() || null }),
    });
    const data = await res.json();
    setSavingDetails(false);
    if (data.ok) {
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, ...data.product } : p)));
      showToast(`"${data.product.name}" actualizado`);
    }
    setEditingDetailsId(null);
  }

  async function toggleStock(product: Product) {
    const res = await fetch(`/api/v1/admin/products/${product.id}/toggle-stock`, { method: 'PATCH' });
    const data = await res.json();
    if (data.ok) {
      setProducts((prev) => prev.map((p) => (p.id === product.id ? data.product : p)));
      showToast(`"${product.name}" ${data.product.isActive ? 'vuelve a la carta' : 'pausado'}`);
    }
  }

  async function toggleFrozen(product: Product) {
    const res = await fetch(`/api/v1/admin/products/${product.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFrozen: !product.isFrozen }),
    });
    const data = await res.json();
    if (data.ok) {
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, ...data.product } : p)));
      showToast(`"${product.name}" ${data.product.isFrozen ? 'marcado como congelado' : 'marcado como estándar'}`);
    }
  }

  async function updateCategory(product: Product, categoryId: string) {
    const res = await fetch(`/api/v1/admin/products/${product.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: categoryId || null }),
    });
    const data = await res.json();
    if (data.ok) {
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, ...data.product } : p)));
      showToast(`Categoría de "${product.name}" actualizada`);
    }
  }

  async function updateCategoryPrepArea(categoryId: string, prepArea: PrepArea) {
    const res = await fetch(`/api/v1/admin/categories/${categoryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prepArea }),
    });
    const data = await res.json();
    if (data.ok) {
      setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, prepArea } : c)));
      showToast(`Estación de preparación actualizada`);
    }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`¿Eliminar "${product.name}" para siempre? Esto no se puede deshacer — si solo querés ocultarlo de la carta, usá "Pausado" en vez de esto.`)) return;
    const res = await fetch(`/api/v1/admin/products/${product.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      showToast(`"${product.name}" eliminado`);
    }
  }

  // Mueve el producto un lugar arriba/abajo DENTRO DE SU PROPIA CATEGORÍA
  // (cada sección de la pantalla es una categoría, así que "la lista" acá es
  // siempre la de esa sección) y renumera el orden de todo ese grupo — la
  // mayoría de los productos comparten sortOrder=0 por default, así que
  // "intercambiar" el valor entre dos que ya son iguales no movería nada;
  // esto lo deja explícito y estable.
  async function moveProduct(product: Product, direction: -1 | 1, sectionProducts: Product[]) {
    const idx = sectionProducts.findIndex((p) => p.id === product.id);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= sectionProducts.length) return;

    const reordered = sectionProducts.slice();
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(swapIdx, 0, moved);

    const changed = reordered
      .map((p, i) => ({ id: p.id, sortOrder: i, prevSortOrder: p.sortOrder }))
      .filter((u) => u.sortOrder !== u.prevSortOrder);
    if (!changed.length) return;

    setProducts((prev) => {
      const byId = new Map(changed.map((u) => [u.id, u.sortOrder]));
      return prev.map((p) => (byId.has(p.id) ? { ...p, sortOrder: byId.get(p.id)! } : p));
    });
    await Promise.all(
      changed.map((u) =>
        fetch(`/api/v1/admin/products/${u.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sortOrder: u.sortOrder }),
        })
      )
    );
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
        isFrozen: newIsFrozen,
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
      setNewIsFrozen(false);
      showToast(`"${data.product.name}" agregado al menú`);
    }
  }

  // Agrupado por categoría, igual que se ve en la web — así editar no es
  // perderse en una lista plana de 60 productos. Mismo orden de categorías
  // que usa pizzazeka.com.ar (alfabético — sortOrder de categoría no se usa
  // hoy, siempre es 0 para todas).
  const sections = useMemo((): Section[] => {
    const bySearch = search ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())) : products;
    const byCategoryId = new Map<string, Product[]>();
    bySearch.forEach((p) => {
      const key = p.categoryId ?? '_none';
      if (!byCategoryId.has(key)) byCategoryId.set(key, []);
      byCategoryId.get(key)!.push(p);
    });
    byCategoryId.forEach((list) => list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));

    const sortedCategories = categories.slice().sort((a, b) => a.name.localeCompare(b.name));
    const result: Section[] = [];
    sortedCategories.forEach((c) => {
      const list = byCategoryId.get(c.id);
      if (list && list.length) result.push({ id: c.id, name: c.name, products: list });
    });
    const noCategory = byCategoryId.get('_none');
    if (noCategory && noCategory.length) result.push({ id: '_none', name: 'Sin categoría', products: noCategory });
    return result;
  }, [products, categories, search]);

  const totalCount = useMemo(() => sections.reduce((sum, s) => sum + s.products.length, 0), [sections]);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader tenantName={session?.user?.tenantSlug ?? ''} activeNav="menu" />

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 sm:px-8 py-6 space-y-4 animate-in fade-in duration-300">
        <GuideCard
          question="¿Cómo funciona este panel de menú?"
          tips={[
            { icon: 'bolt', title: 'Cambiar precio en 1 clic', body: 'Escribí el nuevo valor directo en el recuadro y presioná Enter o el botón verde. Impacta en vivo.' },
            { icon: 'visibility_off', title: 'Pausar por falta de stock', body: 'Hacé clic en la cápsula En Carta para ocultarlo del cotizador al instante sin borrarlo.' },
            { icon: 'swap_vert', title: 'Reordenar el menú', body: 'Las flechas mueven el producto dentro de su propia categoría — ese orden es el que se ve en la web.' },
            { icon: 'delete', title: 'Eliminar para siempre', body: 'El tacho borra el producto por completo. Si solo le faltó stock, mejor pausalo — se puede reactivar.' },
            { icon: 'add_circle', title: 'Nueva variedad', body: 'Creá pizzas, bebidas o promos con el botón verde. Podés duplicar ingredientes y etiquetas al instante.' },
            { icon: 'print', title: 'Estación de impresión', body: 'En el encabezado de cada categoría elegís si imprime en Cocina, Barra, o nada (bebidas de heladera) — define a qué pantalla va cada pedido de mesa.' },
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
              <label className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={newIsFrozen} onChange={(e) => setNewIsFrozen(e.target.checked)} className="w-4 h-4 accent-command-800" />
                Es un producto congelado (radio de envío distinto)
              </label>
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

        {loading && <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-8 text-center text-slate-400 text-sm">Cargando...</div>}
        {!loading && totalCount === 0 && <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-8 text-center text-slate-400 text-sm">Sin productos.</div>}

        {!loading &&
          sections.map((section) => (
            <div key={section.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-command-800/[.07] text-command-900 text-xs font-bold uppercase tracking-wider capitalize flex items-center justify-between gap-2 flex-wrap">
                <span>
                  {section.name} <span className="font-normal text-command-800/60 normal-case">({section.products.length})</span>
                </span>
                {section.id !== '_none' && (
                  <label className="normal-case font-normal flex items-center gap-1.5 text-[11px] text-command-800/70">
                    Estación de impresión
                    <select
                      className="bg-white border border-command-800/20 rounded-lg px-1.5 py-0.5 text-xs text-command-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-command-800"
                      value={categories.find((c) => c.id === section.id)?.prepArea ?? 'COCINA'}
                      onChange={(e) => updateCategoryPrepArea(section.id, e.target.value as PrepArea)}
                    >
                      {(Object.keys(PREP_AREA_LABEL) as PrepArea[]).map((pa) => (
                        <option key={pa} value={pa}>
                          {PREP_AREA_LABEL[pa]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">Producto</th>
                    <th className="text-left px-4 py-2.5 font-semibold hidden md:table-cell">Categoría</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Precio</th>
                    <th className="text-center px-4 py-2.5 font-semibold">Tipo</th>
                    <th className="text-center px-4 py-2.5 font-semibold">Estado</th>
                    <th className="text-center px-4 py-2.5 font-semibold">Orden</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {section.products.map((p) => (
                    <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${!p.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        {editingDetailsId === p.id ? (
                          <div className="space-y-1.5 max-w-sm">
                            <input
                              autoFocus
                              className="w-full px-2 py-1 border border-command-800 rounded-lg font-medium text-slate-800"
                              value={nameDraft}
                              onChange={(e) => setNameDraft(e.target.value)}
                              placeholder="Nombre"
                            />
                            <input
                              className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-500"
                              value={descriptionDraft}
                              onChange={(e) => setDescriptionDraft(e.target.value)}
                              placeholder="Descripción / ingredientes"
                              onKeyDown={(e) => e.key === 'Enter' && saveDetails(p)}
                            />
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => saveDetails(p)}
                                disabled={savingDetails}
                                className="px-2.5 py-1 rounded-lg bg-command-800 hover:bg-command-900 text-white text-[11px] font-semibold uppercase transition-colors disabled:opacity-50"
                              >
                                Guardar
                              </button>
                              <button
                                onClick={() => setEditingDetailsId(null)}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-[11px] font-semibold uppercase transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button className="text-left group" onClick={() => startEditingDetails(p)}>
                            <div className="font-medium text-slate-800 group-hover:text-command-800 group-hover:underline">{p.name}</div>
                            {p.description && <div className="text-xs text-slate-400 line-clamp-1">{p.description}</div>}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <select
                          className="capitalize text-slate-600 bg-transparent border border-transparent hover:border-slate-200 rounded-lg px-1.5 py-1 -mx-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-command-800 focus:border-transparent"
                          value={p.categoryId ?? ''}
                          onChange={(e) => updateCategory(p, e.target.value)}
                        >
                          <option value="">Sin categoría</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
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
                          onClick={() => toggleFrozen(p)}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all hover:scale-105 ${
                            p.isFrozen ? 'bg-sky-100 text-sky-700 hover:bg-sky-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                          title="Clic para cambiar — afecta el radio de envío"
                        >
                          {p.isFrozen ? '❄️ Congelado' : 'Estándar'}
                        </button>
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
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => moveProduct(p, -1, section.products)}
                            disabled={section.products.findIndex((x) => x.id === p.id) === 0}
                            title="Subir dentro de esta categoría"
                            className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-command-800 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                          >
                            <span className="material-symbols-rounded text-base">arrow_upward</span>
                          </button>
                          <button
                            onClick={() => moveProduct(p, 1, section.products)}
                            disabled={section.products.findIndex((x) => x.id === p.id) === section.products.length - 1}
                            title="Bajar dentro de esta categoría"
                            className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-command-800 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                          >
                            <span className="material-symbols-rounded text-base">arrow_downward</span>
                          </button>
                          <button
                            onClick={() => deleteProduct(p)}
                            title="Eliminar para siempre"
                            className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <span className="material-symbols-rounded text-base">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
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
