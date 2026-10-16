'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

const MI_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';
const CADA_MS = 5 * 60 * 1000;

/**
 * Avisa que hay una versión nueva desplegada. Nunca recarga sola la pantalla
 * en la que está el usuario (puede volver de WhatsApp a medio escribir): solo
 * con el botón «Actualizar» o al pasar a otra pantalla, que ya dejó atrás.
 */
export default function AvisoActualizacion() {
  const [hayNueva, setHayNueva] = useState(false);
  const pathname = usePathname();
  const primeraRuta = useRef(pathname);

  useEffect(() => {
    if (MI_VERSION === 'dev') return;
    let vivo = true;
    async function revisar() {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version?: string };
        if (vivo && version && version !== 'dev' && version !== MI_VERSION) setHayNueva(true);
      } catch {
        /* sin conexión: se revisa en la próxima */
      }
    }
    revisar();
    const t = setInterval(revisar, CADA_MS);
    document.addEventListener('visibilitychange', revisar);
    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', revisar);
    };
  }, []);

  // Al cambiar de pantalla con una versión nueva pendiente: carga completa.
  useEffect(() => {
    if (pathname === primeraRuta.current) return;
    primeraRuta.current = pathname;
    if (hayNueva) window.location.reload();
  }, [pathname, hayNueva]);

  if (!hayNueva) return null;
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(84px + env(safe-area-inset-bottom))',
        zIndex: 1000,
        maxWidth: 480,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 12,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 6px 24px rgba(0,0,0,.25)',
      }}
    >
      <RefreshCw size={18} style={{ flexShrink: 0, color: 'var(--color-brand-500)' }} />
      <span style={{ flex: 1, fontSize: 13.5, lineHeight: 1.3 }}>Hay una actualización de la app.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          flexShrink: 0,
          padding: '8px 14px',
          borderRadius: 8,
          border: 'none',
          background: 'var(--color-brand-500)',
          color: '#fff',
          fontSize: 13.5,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Actualizar
      </button>
    </div>
  );
}
