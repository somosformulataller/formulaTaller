import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCaller, canManageOrder } from '@/lib/api-auth';

type Params = { params: { id: string; sid: string; aid: string } };

const BUCKET = 'stage-files';

// DELETE /api/orders/:id/stages/:sid/attachments/:aid
//
// El id del adjunto viaja en la RUTA (no como ?id=...). Un query string se
// puede perder en el camino (service worker, proxys, redirecciones) y dejaba
// el borrado con "Falta el id del adjunto"; en la ruta eso no puede pasar.
export async function DELETE(_req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canManageOrder(caller, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient();

  // Buscar el archivo para borrarlo también de Storage (limitado a esta etapa).
  const { data: att } = await service
    .from('stage_attachments')
    .select('path')
    .eq('id', params.aid)
    .eq('stage_id', params.sid)
    .single();

  const path = (att as unknown as { path: string } | null)?.path;
  if (path) {
    await service.storage.from(BUCKET).remove([path]);
  }

  const { error } = await service
    .from('stage_attachments')
    .delete()
    .eq('id', params.aid)
    .eq('stage_id', params.sid);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
