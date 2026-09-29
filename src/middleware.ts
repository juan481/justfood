import { withAuth } from 'next-auth/middleware';

// The bare `export { default } from 'next-auth/middleware'` form doesn't
// pick up authOptions.pages.signIn (middleware runs separately from the
// route handler) — it must be passed explicitly here, or unauthenticated
// requests get redirected to NextAuth's unstyled default /api/auth/signin
// instead of our own /login screen.
export default withAuth({
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized: ({ token, req }) => {
      const path = req.nextUrl.pathname;
      return path === '/' || path === '/landing' || !!token;
    },
  },
});

// Gates PAGE routes only. /api/v1/public/* handles its own auth (per-tenant
// API key, or no key for read endpoints — plan section 3) and /api/v1/admin/*
// each call requireSession() themselves and return a proper 401 JSON body —
// letting this middleware also match them would 307-redirect a fetch() call
// to the login HTML page instead, which breaks the SPA's error handling.
// Also excludes everything a crawler/browser fetches unauthenticated: the
// favicon/app-icon routes, robots.txt, sitemap.xml and the OG/share image —
// without this they 307 to /login instead of serving the asset, which
// breaks the browser tab icon, link previews and search indexing.
// Fase 1+ adds role-based path rules (e.g. /kds is cocina+admin only).
export const config = {
  matcher: [
    '/((?!api|login|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|robots.txt|sitemap.xml|og-image.png|logo-justfood.*\\.png).*)',
  ],
};
