import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';

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

async function getVideoUrl(): Promise<string> {
  try {
    const service = createServiceClient();
    const { data } = await service
      .from('platform_settings')
      .select('tutorial_video_url')
      .eq('id', 1)
      .single();
    const url = (data as { tutorial_video_url: string | null } | null)?.tutorial_video_url;
    return url && url.trim() ? url.trim() : FALLBACK_VIDEO;
  } catch {
    return FALLBACK_VIDEO;
  }
}

export default async function VideoPage() {
  const videoUrl = await getVideoUrl();

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

      <p style={{ fontSize: 13, color: 'var(--color-text-muted, #9aa0b4)', textAlign: 'center', maxWidth: 420, margin: 0 }}>
        Si el video no carga, toca el botón de reproducir. ¿Dudas? Escríbenos por WhatsApp.
      </p>
    </main>
  );
}
