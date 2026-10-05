import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { soloAdmin } from '@/lib/admin-taller';
import { TAG_COLORS } from '@/lib/recordatorios';

const COLS = 'id, workshop_id, label, color, sort, active';

// GET /api/reminder-tags — las de la plataforma + las creadas por este taller.
export async function GET() {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;

  const service = createServiceClient();
  const { data, error } = await service
    .from('reminder_tags')
    .select(COLS)
    .eq('active', true)
    .or(`workshop_id.is.null,workshop_id.eq.${caller.workshopId}`)
    .order('sort', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Primero las de la plataforma, luego las del taller.
  const lista = (data ?? []) as Array<{ workshop_id: string | null }>;
  lista.sort((a, b) => Number(a.workshop_id !== null) - Number(b.workshop_id !== null));
  return NextResponse.json(lista);
}

// POST /api/reminder-tags — { label, color? } crea una etiqueta propia del taller.
export async function POST(req: Request) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;

  const body = await req.json().catch(() => null);
  const label = String(body?.label ?? '').trim().slice(0, 40);
  const color = TAG_COLORS.includes(body?.color) ? body.color : 'neutral';
  if (!label) return NextResponse.json({ error: 'Escribe el nombre de la etiqueta.' }, { status: 400 });

  const service = createServiceClient();
  const { data: existentes } = await service
    .from('reminder_tags')
    .select('id, label')
    .or(`workshop_id.is.null,workshop_id.eq.${caller.workshopId}`);
  const lista = (existentes ?? []) as unknown as Array<{ label: string }>;
  if (lista.some((t) => t.label.toLowerCase() === label.toLowerCase())) {
    return NextResponse.json({ error: 'Ya existe una etiqueta con ese nombre.' }, { status: 409 });
  }
  if (lista.length >= 60) {
    return NextResponse.json({ error: 'Ya tienes demasiadas etiquetas.' }, { status: 400 });
  }

  const { data, error } = await service
    .from('reminder_tags')
    .insert({ workshop_id: caller.workshopId, label, color, sort: 1000 + lista.length })
    .select(COLS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
