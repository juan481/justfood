import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

const SITE_URL = 'https://food.justcreate.com.ar';
const TITLE = 'JustFood — Sistema de Gestión Gastronómica en Tiempo Real';
const DESCRIPTION =
  'JustFood es el panel de gestión para restaurantes y pizzerías: comandero de cocina en tiempo real, menú y stock, pagos por transferencia y Mercado Pago, cadetes y delivery, todo en un solo sistema. Desarrollado por Just Create.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s · JustFood' },
  description: DESCRIPTION,
  keywords: [
    'sistema para restaurantes',
    'software gastronómico',
    'comandero de cocina',
    'KDS restaurante',
    'gestión de pedidos delivery',
    'sistema de pedidos WhatsApp',
    'software para pizzerías',
    'Just Create',
  ],
  authors: [{ name: 'Just Create', url: 'https://justcreate.com.ar' }],
  applicationName: 'JustFood',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: SITE_URL,
    siteName: 'JustFood',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'JustFood — Gestión Gastronómica' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="bg-canvas text-slate-800 font-sans antialiased min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
