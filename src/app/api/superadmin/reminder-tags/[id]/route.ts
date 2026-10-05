import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getPlatformAdmin } from '@/lib/api-auth';
import { TAG_COLORS } from '@/lib/recordatorios';

type Params = { params: { id: string } };
const COLS = 'id, workshop_id, label, color, sort, active';

// PATCH /api/superadmin/reminder-tags/:id — { label?, color?, active? }
// Solo etiquetas de la plataforma: las de cada taller las maneja ese taller.
export async function PATCH(req: Request, { params }: Params) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = {};
  if (typeof body?.label === 'string') {
    const l = body.label.trim().slice(0, 40);
    if (!l) return NextResponse.json({ error: 'El nombre no puede quedar vacío' }, { status: 400 });
    patch.label = l;
  }
  if (TAG_COLORS.includes(body?.color)) patch.color = body.color;
  if (typeof body?.active === 'boolean') patch.active = body.active;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nada que cambiar' }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from('reminder_tags')
    .update(patch)
    .eq('id', params.id)
    .is('workshop_id', null)
    .select(COLS)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  return NextResponse.json(data);
}

// DELETE /api/superadmin/reminder-tags/:id — los recordatorios que la usaban
// quedan sin etiqueta (on delete set null).
export async function DELETE(_: Request, { params }: Params) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const service = createServiceClient();
  const { error } = await service
    .from('reminder_tags')
    .delete()
    .eq('id', params.id)
    .is('workshop_id', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
