import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getPlatformAdmin } from '@/lib/api-auth';
import { TAG_COLORS } from '@/lib/recordatorios';

const COLS = 'id, workshop_id, label, color, sort, active';

// GET /api/superadmin/reminder-tags — etiquetas de la plataforma (workshop_id null).
export async function GET() {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const service = createServiceClient();
  const { data, error } = await service
    .from('reminder_tags')
    .select(COLS)
    .is('workshop_id', null)
    .order('sort', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/superadmin/reminder-tags — { label, color? }
export async function POST(req: Request) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const label = String(body?.label ?? '').trim().slice(0, 40);
  const color = TAG_COLORS.includes(body?.color) ? body.color : 'gold';
  if (!label) return NextResponse.json({ error: 'Escribe el nombre de la etiqueta.' }, { status: 400 });

  const service = createServiceClient();
  const { count } = await service
    .from('reminder_tags')
    .select('id', { count: 'exact', head: true })
    .is('workshop_id', null);

  const { data, error } = await service
    .from('reminder_tags')
    .insert({ workshop_id: null, label, color, sort: (count ?? 0) + 1 })
    .select(COLS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
