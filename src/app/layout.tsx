import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Formula Taller',
  description: 'Sistema de gestión de órdenes para taller mecánico',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Formula Taller',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  keywords: ['taller', 'mecánico', 'órdenes', 'vehículos'],
  robots: 'noindex',
};

export const viewport: Viewport = {
  themeColor: '#F59E0B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        {/* Service Worker: register in production only. In development we
            actively unregister it and clear its caches, since a cache-first SW
            breaks hot-reload by serving stale /_next/ chunks. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              process.env.NODE_ENV === 'production'
                ? `if ('serviceWorker' in navigator) {
                     window.addEventListener('load', () => {
                       navigator.serviceWorker.register('/sw.js').catch(() => {});
                     });
                   }`
                : `if ('serviceWorker' in navigator) {
                     navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
                     if (window.caches) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
                   }`,
          }}
        />
      </body>
    </html>
  );
}
