import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { soloAdmin, carpetaRecordatorios } from '@/lib/admin-taller';
import { STAGE_FILES_BUCKET } from '@/lib/storage';

// POST /api/reminders/sign — { name, kind: 'audio' | 'image' }
// URL firmada para que el navegador suba la nota de voz o la imagen directo
// al bucket privado, dentro de la carpeta de SU taller.
export async function POST(req: Request) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;

  const body = await req.json().catch(() => null);
  const kind = body?.kind === 'audio' ? 'audio' : body?.kind === 'image' ? 'image' : null;
  if (!kind) return NextResponse.json({ error: 'Tipo de archivo inválido' }, { status: 400 });
  const rawName = typeof body?.name === 'string' && body.name ? body.name : kind;
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || kind;
  const path = `${carpetaRecordatorios(caller.workshopId)}${kind}-${Date.now()}-${safeName}`;

  const service = createServiceClient();
  const { data, error } = await service.storage.from(STAGE_FILES_BUCKET).createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ path: data.path, token: data.token });
}
