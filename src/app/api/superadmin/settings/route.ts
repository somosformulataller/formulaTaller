import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getPlatformAdmin } from '@/lib/api-auth';

// PATCH /api/superadmin/settings — cambia el límite GLOBAL del plan gratuito.
// Solo superadmins de plataforma.
export async function PATCH(req: Request) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const value = body?.free_order_limit;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return NextResponse.json(
      { error: 'free_order_limit debe ser un entero mayor o igual a 0' },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('platform_settings')
    .update({ free_order_limit: value })
    .eq('id', 1)
    .select('free_order_limit')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
