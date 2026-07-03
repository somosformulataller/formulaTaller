import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getPlatformAdmin } from '@/lib/api-auth';

// PATCH /api/superadmin/settings — configuración global de la plataforma.
// Solo superadmins de plataforma.
// Body admite: { free_order_limit?: number, support_phones?: string[] }
export async function PATCH(req: Request) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const updates: { free_order_limit?: number; support_phones?: string[] } = {};

  if ('free_order_limit' in (body ?? {})) {
    const value = body.free_order_limit;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      return NextResponse.json(
        { error: 'free_order_limit debe ser un entero mayor o igual a 0' },
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
    updates.support_phones = (phones as string[])
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('platform_settings')
    .update(updates)
    .eq('id', 1)
    .select('free_order_limit, support_phones')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
