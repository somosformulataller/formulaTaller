'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { FB_PIXEL_ID } from '@/lib/fbpixel';

/**
 * Carga el Pixel de Facebook y dispara PageView en la carga inicial y en cada
 * navegación interna (la app es una SPA).
 */
export default function FacebookPixel() {
  const pathname = usePathname();
  const firstLoad = useRef(true);

  useEffect(() => {
    if (firstLoad.current) {
      // El snippet ya dispara el PageView inicial; evitar duplicarlo.
      firstLoad.current = false;
      return;
    }
    if (typeof window !== 'undefined' && window.fbq) window.fbq('track', 'PageView');
  }, [pathname]);

  return (
    <Script
      id="fb-pixel"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','${FB_PIXEL_ID}');
          fbq('track','PageView');
        `,
      }}
    />
  );
}
