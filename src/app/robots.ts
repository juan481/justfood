import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/login', disallow: ['/api/', '/kds', '/menu', '/pagos', '/cadetes', '/ajustes', '/arqueo', '/historial', '/estadisticas', '/salon', '/menu-qr'] },
    ],
    sitemap: 'https://food.justcreate.com.ar/sitemap.xml',
  };
}
