import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { waNumber } from '@/lib/whatsapp';

// Enlace público, corto y presentable para el video de bienvenida:
// formulataller.com/video. Se comparte por WhatsApp desde Ventas con una
// tarjeta de vista previa (miniatura + título). El video que se muestra sale
// de platform_settings.tutorial_video_url (editable), con respaldo al de
// /public.

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const FALLBACK_VIDEO = '/video/tutorial-formula-taller.mp4';
const POSTER = '/video/tutorial-poster.jpg';
const OG_IMAGE = `${SITE_URL}/video/og-video.jpg`;

const TITLE = 'Formula Taller — Video de bienvenida';
const DESC = 'Mira el video de bienvenida y descubre cómo Formula Taller te ayuda a gestionar tu taller.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: '/video' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/video`,
    title: TITLE,
    description: DESC,
    siteName: 'Formula Taller',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Formula Taller — Video de bienvenida' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESC,
    images: [OG_IMAGE],
  },
};

const SOPORTE_MENSAJE =
  'Hola, acabo de ver el video de bienvenida y tengo una duda sobre Formula Taller.';

async function getSettings(): Promise<{ videoUrl: string; soporteLink: string | null }> {
  try {
    const service = createServiceClient();
    const { data } = await service
      .from('platform_settings')
      .select('tutorial_video_url, support_phones')
      .eq('id', 1)
      .single();
    const row = data as { tutorial_video_url: string | null; support_phones: string[] | null } | null;

    const url = row?.tutorial_video_url;
    const videoUrl = url && url.trim() ? url.trim() : FALLBACK_VIDEO;

    const phone = (row?.support_phones ?? []).find((p) => p && p.trim().length > 0);
    const num = waNumber(phone);
    const soporteLink = num
      ? `https://wa.me/${num}?text=${encodeURIComponent(SOPORTE_MENSAJE)}`
      : null;

    return { videoUrl, soporteLink };
  } catch {
    return { videoUrl: FALLBACK_VIDEO, soporteLink: null };
  }
}

export default async function VideoPage() {
  const { videoUrl, soporteLink } = await getSettings();

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--color-bg, #0d0f1a)',
        color: 'var(--color-text-primary, #f4f5fb)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: '32px 16px calc(32px + env(safe-area-inset-bottom))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="Formula Taller" width={44} height={44} style={{ borderRadius: 10 }} />
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>Formula Taller</span>
      </div>

      <h1 style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', margin: 0 }}>
        Video de bienvenida
      </h1>

      <video
        controls
        autoPlay
        playsInline
        poster={POSTER}
        preload="metadata"
        style={{
          width: '100%',
          maxWidth: 420,
          maxHeight: '72dvh',
          borderRadius: 16,
          border: '1px solid var(--color-border, #23263a)',
          background: '#000',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        }}
      >
        <source src={videoUrl} type="video/mp4" />
        Tu navegador no puede reproducir el video.{' '}
        <a href={videoUrl} style={{ color: 'var(--color-brand-400, #fbbf24)' }}>
          Descárgalo aquí
        </a>
        .
      </video>

      {soporteLink && (
        <a
          href={soporteLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '13px 22px',
            background: '#25D366',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 700,
            boxShadow: '0 6px 20px rgba(37,211,102,0.45)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
            <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.33 4.95L2 22l5.3-1.39a9.86 9.86 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2Zm5.8 14.13c-.24.68-1.42 1.32-1.95 1.36-.52.05-.53.42-3.32-.7-2.8-1.12-4.5-4-4.64-4.19-.13-.19-1.09-1.45-1.09-2.77 0-1.32.69-1.97.94-2.24.24-.27.53-.34.71-.34.18 0 .35 0 .51.01.16.01.39-.06.6.46.24.58.82 2 .89 2.14.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.56.16.27.72 1.19 1.55 1.93 1.07.95 1.96 1.25 2.24 1.39.28.14.44.12.6-.07.16-.19.69-.81.87-1.08.18-.27.36-.23.6-.14.24.09 1.55.73 1.82.86.27.14.45.2.51.31.06.11.06.64-.18 1.32Z" />
          </svg>
          Escríbenos por WhatsApp
        </a>
      )}

      <p style={{ fontSize: 13, color: 'var(--color-text-muted, #9aa0b4)', textAlign: 'center', maxWidth: 420, margin: 0 }}>
        Si el video no carga, toca el botón de reproducir.
        {soporteLink ? ' ¿Dudas? Escríbenos por WhatsApp.' : ''}
      </p>
    </main>
  );
}
