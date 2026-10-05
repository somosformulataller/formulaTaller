import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { soloAdmin, firmarArchivos } from '@/lib/admin-taller';
import { REMINDER_SELECT, limpiarRecordatorio } from '@/lib/recordatorios-servidor';
import { STAGE_FILES_BUCKET } from '@/lib/storage';
import type { Reminder } from '@/lib/types';

type Params = { params: { id: string } };

// PATCH /api/reminders/:id — editar, marcar como enviado o hecho.
export async function PATCH(req: Request, { params }: Params) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });

  const service = createServiceClient();
  const { data: antes } = await service
    .from('reminders')
    .select('id, audio_path, image_path')
    .eq('id', params.id)
    .eq('workshop_id', caller.workshopId)
    .maybeSingle();
  if (!antes) return NextResponse.json({ error: 'Recordatorio no encontrado' }, { status: 404 });

  const { datos, error: invalido } = await limpiarRecordatorio(service, caller.workshopId, body, true);
  if (invalido) return NextResponse.json({ error: invalido }, { status: 400 });
  if (Object.keys(datos).length === 0) return NextResponse.json({ error: 'Nada que cambiar' }, { status: 400 });

  const { data, error } = await service
    .from('reminders')
    .update(datos)
    .eq('id', params.id)
    .eq('workshop_id', caller.workshopId)
    .select(REMINDER_SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Archivos que se quitaron o reemplazaron: fuera del bucket.
  const viejo = antes as unknown as { audio_path: string | null; image_path: string | null };
  const sobran = (['audio_path', 'image_path'] as const)
    .filter((k) => k in datos && viejo[k] && viejo[k] !== datos[k])
    .map((k) => viejo[k] as string);
  if (sobran.length) await service.storage.from(STAGE_FILES_BUCKET).remove(sobran);

  const [fila] = await firmarArchivos(service, [data as unknown as Reminder]);
  return NextResponse.json(fila);
}

// DELETE /api/reminders/:id — borra también su audio y su imagen.
export async function DELETE(_: Request, { params }: Params) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;
  const service = createServiceClient();

  const { data } = await service
    .from('reminders')
    .delete()
    .eq('id', params.id)
    .eq('workshop_id', caller.workshopId)
    .select('audio_path, image_path')
    .maybeSingle();
  if (!data) return NextResponse.json({ error: 'Recordatorio no encontrado' }, { status: 404 });

  const f = data as unknown as { audio_path: string | null; image_path: string | null };
  const paths = [f.audio_path, f.image_path].filter((p): p is string => !!p);
  if (paths.length) await service.storage.from(STAGE_FILES_BUCKET).remove(paths);
  return NextResponse.json({ ok: true });
}
