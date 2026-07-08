import type { Metadata, Viewport } from 'next';
import './globals.css';
import FacebookPixel from '@/components/FacebookPixel';

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
        {/* Meta Pixel: script inline garantizado (se sirve en el HTML y ejecuta al
            cargar). Solo INICIALIZA el pixel. El PageView (inicial y en cada
            navegación) lo dispara <FacebookPixel /> una sola vez por ruta, para
            no duplicar el evento. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
              fbq('set','autoConfig',false,'1688453135751029');
              fbq('init','1688453135751029');
            `,
          }}
        />
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            alt=""
            src="https://www.facebook.com/tr?id=1688453135751029&ev=PageView&noscript=1"
          />
        </noscript>
        <FacebookPixel />
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
