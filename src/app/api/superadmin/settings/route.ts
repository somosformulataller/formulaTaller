import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getPlatformAdmin } from '@/lib/api-auth';

// Cota superior de los límites de órdenes: la columna es int4 (máx 2.147.483.647);
// sin tope, un número enorme desborda en Postgres y devuelve 500. Un millón es
// muy superior a cualquier taller real y deja margen de sobra.
const MAX_ORDER_LIMIT = 1_000_000;
// Cotas de la lista de teléfonos de atención (se muestran en el paywall).
const MAX_SUPPORT_PHONES = 20;
const MAX_PHONE_LEN = 32;
// Cotas del onboarding (video tutorial).
const MAX_VIDEO_URL_LEN = 2000;
const MAX_TUTORIAL_MSG_LEN = 1500;

// PATCH /api/superadmin/settings — configuración global de la plataforma.
// Solo superadmins de plataforma.
// Body admite: { free_order_limit?, support_phones?, tutorial_video_url?, tutorial_message? }
export async function PATCH(req: Request) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const updates: {
    free_order_limit?: number;
    support_phones?: string[];
    tutorial_video_url?: string | null;
    tutorial_message?: string;
  } = {};

  if ('free_order_limit' in (body ?? {})) {
    const value = body.free_order_limit;
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > MAX_ORDER_LIMIT
    ) {
      return NextResponse.json(
        { error: `free_order_limit debe ser un entero entre 0 y ${MAX_ORDER_LIMIT}` },
        { status: 400 }
      );
    }
    updates.free_order_limit = value;
  }

  if ('support_phones' in (body ?? {})) {
    const phones = body.support_phones;
    if (
      !Array.isArray(phones) ||
      phones.some((p: unknown) => typeof p !== 'string')
    ) {
      return NextResponse.json(
        { error: 'support_phones debe ser una lista de textos' },
        { status: 400 }
      );
    }
    // Normalizar: quitar espacios y descartar vacíos.
    const cleaned = (phones as string[]).map((p) => p.trim()).filter((p) => p.length > 0);
    if (cleaned.length > MAX_SUPPORT_PHONES) {
      return NextResponse.json(
        { error: `Máximo ${MAX_SUPPORT_PHONES} números de atención` },
        { status: 400 }
      );
    }
    if (cleaned.some((p) => p.length > MAX_PHONE_LEN)) {
      return NextResponse.json(
        { error: `Cada número debe tener ${MAX_PHONE_LEN} caracteres o menos` },
        { status: 400 }
      );
    }
    updates.support_phones = cleaned;
  }

  if ('tutorial_video_url' in (body ?? {})) {
    const raw = body.tutorial_video_url;
    if (raw === null || raw === '') {
      updates.tutorial_video_url = null;
    } else if (typeof raw !== 'string' || raw.length > MAX_VIDEO_URL_LEN) {
      return NextResponse.json(
        { error: `tutorial_video_url debe ser texto de ${MAX_VIDEO_URL_LEN} caracteres o menos` },
        { status: 400 }
      );
    } else if (!/^https?:\/\//i.test(raw.trim())) {
      return NextResponse.json(
        { error: 'El enlace del video debe empezar por http:// o https://' },
        { status: 400 }
      );
    } else {
      updates.tutorial_video_url = raw.trim();
    }
  }

  if ('tutorial_message' in (body ?? {})) {
    const msg = body.tutorial_message;
    if (typeof msg !== 'string' || msg.trim().length === 0) {
      return NextResponse.json({ error: 'El mensaje no puede estar vacío' }, { status: 400 });
    }
    if (msg.length > MAX_TUTORIAL_MSG_LEN) {
      return NextResponse.json(
        { error: `El mensaje debe tener ${MAX_TUTORIAL_MSG_LEN} caracteres o menos` },
        { status: 400 }
      );
    }
    updates.tutorial_message = msg.trim();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('platform_settings')
    .update(updates)
    .eq('id', 1)
    .select('free_order_limit, support_phones, tutorial_video_url, tutorial_message')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
