'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Única fuente del evento PageView del Pixel de Meta. Lo dispara una sola vez
 * por ruta: en la carga inicial y en cada navegación interna (SPA), evitando
 * disparos duplicados con datos idénticos. El Pixel se inicializa con el
 * <script> inline del layout.
 */
export default function FacebookPixel() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (lastTracked.current === pathname) return; // esta ruta ya se contó
    lastTracked.current = pathname;
    if (typeof window !== 'undefined' && window.fbq) window.fbq('track', 'PageView');
  }, [pathname]);

  return null;
}
