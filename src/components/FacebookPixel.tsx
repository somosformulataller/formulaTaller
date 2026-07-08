'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Dispara PageView del Pixel de Meta en cada navegación interna (la app es una
 * SPA). El Pixel se inicializa con un <script> inline en el layout, que también
 * dispara el PageView de la carga inicial.
 */
export default function FacebookPixel() {
  const pathname = usePathname();
  const firstLoad = useRef(true);

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false; // el PageView inicial lo dispara el script del layout
      return;
    }
    if (typeof window !== 'undefined' && window.fbq) window.fbq('track', 'PageView');
  }, [pathname]);

  return null;
}
