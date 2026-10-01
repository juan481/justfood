// Reemplaza el catálogo ESTÁNDAR (no congelado) de pizzazeka por una lista
// fija, tal como la pasó Juan el 2026-10-01. Borra todo producto no-congelado
// existente (se acumuló basura de testing: productos renombrados/duplicados
// durante las pruebas de sincronización) y recrea desde cero en el orden
// exacto de la lista. Los productos congelados NO se tocan.
//
// Uso: npm run set:pizzazeka-menu
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MenuItem {
  name: string;
  price: number;
  description?: string;
}

const MENU: Record<string, MenuItem[]> = {
  entradas: [
    { name: 'Burrata', price: 23000, description: 'Queso fresco y cremoso con pesto de albahaca, tomates cherrys confitados y colchón de rúcula.' },
    { name: 'Arancini x 2', price: 16000, description: 'Albóndiga de arroz rellena de ragú, arvejas, con corazón de fior di latte.' },
    { name: 'Empanada de Mamá', price: 3000, description: 'Empanada de carne frita.' },
  ],
  panuozzo: [
    { name: 'Jamón Crudo', price: 23000, description: 'Jamón crudo con rúcula, parmesano y mozzarella fior di latte (opcional: cherrys confitados).' },
    { name: 'Mortadella', price: 23000, description: 'Mortadella con pistacho, mozzarella fior di latte, mascarpone y pesto (opcional: cherrys confitados).' },
  ],
  pizzas: [
    { name: 'Marinara', price: 20000, description: 'Pomodoro italiano, orégano y láminas de ajo.' },
    { name: 'Margherita', price: 21000, description: 'Pomodoro italiano, mozzarella fior di latte, albahaca.' },
    { name: 'Patate', price: 21000, description: 'Base de mascarpone, mozzarella fior di latte, papas con romero y oliva.' },
    { name: 'Antonio', price: 22000, description: 'Base de pesto, mozzarella fior di latte, cherrys confitados.' },
    { name: 'Cipolla', price: 22000, description: 'Mozzarella fior di latte, cebolla blanca, morada y verdeo.' },
    { name: '4 Formaggi', price: 22000, description: 'Mozzarella fior di latte, queso parmesano, provolone y azul.' },
    { name: 'Mamma Mía', price: 22000, description: 'Pomodoro italiano, rodajas de tomate, ajo, stracciatella, albahaca y oliva.' },
    { name: 'Jamón Crudo', price: 23000, description: 'Pomodoro italiano, mozzarella fior di latte, rúcula y jamón crudo.' },
    { name: 'Mortadella', price: 23000, description: 'Mozzarella fior di latte, mortadella con pistachos, pesto y mascarpone.' },
    { name: 'Pepperoni', price: 23000, description: 'Pomodoro italiano, mozzarella fior di latte y longaniza (picante).' },
    { name: 'Tricolore', price: 23000, description: 'Base de mozzarella fior di latte, provolone ahumado, pomodoro italiano, pesto y albahaca.' },
  ],
  postres: [
    { name: 'Tiramisú', price: 9500, description: 'Postre tradicional italiano a base de café y mascarpone.' },
    { name: 'Pizza de Nutella', price: 17000, description: 'Pizza dulce con base de Nutella.' },
    { name: 'Bombón Suizo (Rampoldi)', price: 9000, description: 'Postre helado bombón suizo.' },
    { name: 'Bombón Escocés (Rampoldi)', price: 9000, description: 'Postre helado bombón escocés.' },
    { name: 'Franui (Leche / Amargo)', price: 10000, description: 'Frambuesas bañadas en chocolate con leche o amargo.' },
    { name: 'Helado 1 bocha (Rampoldi)', price: 4500, description: 'Helado artesanal Rampoldi. Consultar disponibilidad de opción vegana.' },
    { name: 'Helado 2 bochas (Rampoldi)', price: 8000, description: 'Helado artesanal Rampoldi. Consultar disponibilidad de opción vegana.' },
    { name: 'Helado 3 bochas (Rampoldi)', price: 10000, description: 'Helado artesanal Rampoldi. Consultar disponibilidad de opción vegana.' },
    { name: 'Café Nespresso', price: 5500, description: 'Café espresso servido en máquina Nespresso.' },
  ],
  bebidas: [
    { name: 'Agua con o sin gas', price: 3000 },
    { name: 'Levité (pomelo / naranja / manzana / limonada)', price: 3500 },
    { name: 'Gaseosas (Coca / Sprite / 7up / Fanta / Schweppes)', price: 4000 },
  ],
  cervezas: [
    { name: 'Cerveza sin alcohol', price: 5500 },
    { name: 'Heineken (330 cc)', price: 5500 },
    { name: 'Corona (330 cc)', price: 6000 },
    { name: 'Cerveza negra', price: 6000 },
    { name: 'Cerveza roja', price: 6000 },
    { name: 'Cerveza artesanal pilsen', price: 7000 },
    { name: 'Cerveza artesanal ipa', price: 7000 },
    { name: 'Cerveza tirada pilsen', price: 7000 },
    { name: 'Cerveza tirada ipa', price: 7000 },
    { name: 'Cerveza Blue Moon', price: 7500 },
    { name: 'Menabrea (Italiana) 330 cc', price: 8500 },
    { name: 'Peroni (Italiana) 330 cc', price: 8500 },
  ],
  vinos: [
    { name: 'Chardonnay Trivento', price: 19000 },
    { name: 'Malbec Tomero', price: 22000 },
    { name: 'Pinot Noir Saurus', price: 27000 },
    { name: 'On the Road E80 (Italiano)', price: 48000 },
    { name: 'On the Road SR69 (Italiano)', price: 58000 },
  ],
  tragos: [
    { name: 'Vermut', price: 8000, description: 'Vermut rosso, soda y rodaja de naranja.' },
    { name: 'Fernet con Coca', price: 8000, description: 'Fernet Branca y Coca Cola.' },
    { name: 'Campari', price: 8500, description: 'Campari con jugo de naranja.' },
    { name: 'Gin Tonic', price: 9000, description: 'Gin, agua tónica y una rodaja de limón.' },
    { name: 'Gin Tonic de Arándanos', price: 9000, description: 'Gin de arándanos, agua tónica y frutos rojos.' },
    { name: 'Aperol Spritz', price: 9500, description: 'Aperol, espumante prosecco, soda, rodaja de naranja.' },
  ],
};

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'pizzazeka' } });
  if (!tenant) throw new Error('Tenant pizzazeka no existe.');

  const categories = await prisma.category.findMany({ where: { tenantId: tenant.id } });
  const categoryIdByName: Record<string, string> = {};
  for (const catKey of Object.keys(MENU)) {
    const cat = categories.find((c) => c.name.toLowerCase() === catKey);
    if (!cat) throw new Error(`Categoría "${catKey}" no existe en JustFood — abortando sin tocar nada.`);
    categoryIdByName[catKey] = cat.id;
  }

  const existing = await prisma.product.findMany({ where: { tenantId: tenant.id } });
  const toDelete = existing.filter((p) => !p.isFrozen);
  console.log(`Borrando ${toDelete.length} productos no-congelados existentes (incluye basura de testing)...`);
  if (toDelete.length) {
    await prisma.product.deleteMany({ where: { id: { in: toDelete.map((p) => p.id) } } });
  }

  const maxLegacyRow = await prisma.product.aggregate({ where: { tenantId: tenant.id }, _max: { legacyProductId: true } });
  let nextLegacyId = (maxLegacyRow._max.legacyProductId ?? 0) + 1;

  let created = 0;
  for (const [catKey, items] of Object.entries(MENU)) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await prisma.product.create({
        data: {
          tenantId: tenant.id,
          categoryId: categoryIdByName[catKey],
          name: item.name,
          description: item.description ?? null,
          price: item.price,
          isActive: true,
          isFrozen: false,
          sortOrder: i,
          legacyProductId: nextLegacyId++,
        },
      });
      created++;
    }
  }
  console.log(`Creados ${created} productos nuevos, en el orden exacto de la lista.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
