'use client';

import { useEffect, useState } from 'react';
import { Download, Share } from 'lucide-react';

// "Instalar app" button. On Android/Chrome it uses the browser's install
// prompt (beforeinstallprompt). iPhone/iPad never fire that event and no web
// page can install itself there, so on iOS the button shows a one-line hint
// for Safari's Share → "Añadir a pantalla de inicio" instead.
interface BIPEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: string }>;
}

function esIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ se presenta como Mac; se distingue por la pantalla táctil.
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function yaInstalada(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const estiloBoton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  marginTop: 16,
  padding: '9px 16px',
  background: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  color: 'var(--color-text-primary)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

export default function InstallButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [ayuda, setAyuda] = useState(false);

  useEffect(() => {
    if (esIOS() && !yaInstalada()) setIos(true);
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (ios) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 320 }}>
        <button type="button" onClick={() => setAyuda((v) => !v)} aria-expanded={ayuda} style={estiloBoton}>
          <Download size={15} />
          Descargar app
        </button>
        {ayuda && (
          <p
            style={{
              marginTop: 10,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
              fontSize: 12.5,
              lineHeight: 1.45,
              textAlign: 'center',
            }}
          >
            En Safari toca Compartir{' '}
            <Share size={13} style={{ verticalAlign: '-2px', color: 'var(--color-brand-400)' }} /> y elige{' '}
            <b style={{ color: 'var(--color-text-primary)' }}>«Añadir a pantalla de inicio»</b>.
          </p>
        )}
      </div>
    );
  }

  if (!deferred) return null;

  return (
    <button
      onClick={async () => {
        deferred.prompt();
        await deferred.userChoice;
        setDeferred(null);
      }}
      style={estiloBoton}
    >
      <Download size={15} />
      Instalar app
    </button>
  );
}
