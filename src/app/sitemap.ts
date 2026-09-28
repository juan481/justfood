import type { MetadataRoute } from 'next';

// Everything except /login sits behind NextAuth middleware (src/middleware.ts),
// so /login is the only URL worth telling Google about — the rest 302s to it
// for an unauthenticated crawler anyway.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://food.justcreate.com.ar/login',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
