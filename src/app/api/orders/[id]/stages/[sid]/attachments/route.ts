import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCaller, canManageOrder } from '@/lib/api-auth';

type Params = { params: { id: string; sid: string } };

const BUCKET = 'stage-files';

// POST /api/orders/:id/stages/:sid/attachments — register or upload a file
//
// Two modes:
//  1. JSON  { path, name, mime } → the browser already uploaded the bytes to
//     Storage via a signed URL; here we just record the metadata row.
//  2. multipart (field `file`) → server-side upload (fallback for small files).
export async function POST(req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canManageOrder(caller, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient();
  const contentType = req.headers.get('content-type') || '';

  // --- Mode 1: metadata for a file already uploaded via signed URL ---------
  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => null);
    const path = typeof body?.path === 'string' ? body.path : '';
    // The path must live under this order/stage folder (the sign endpoint
    // builds it that way); reject anything else.
    if (!path.startsWith(`${params.id}/${params.sid}/`)) {
      return NextResponse.json({ error: 'Ruta no válida' }, { status: 400 });
    }

    const { data: pub } = service.storage.from(BUCKET).getPublicUrl(path);
    const { data, error } = await service
      .from('stage_attachments')
      .insert({
        stage_id: params.sid,
        order_id: params.id,
        path,
        url: pub.publicUrl,
        name: typeof body?.name === 'string' ? body.name : null,
        mime: typeof body?.mime === 'string' ? body.mime : null,
        created_by: caller.userId,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  // --- Mode 2: multipart upload through the server -------------------------
  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Archivo no válido' }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${params.id}/${params.sid}/${Date.now()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: pub } = service.storage.from(BUCKET).getPublicUrl(path);

  const { data, error } = await service
    .from('stage_attachments')
    .insert({
      stage_id: params.sid,
      order_id: params.id,
      path,
      url: pub.publicUrl,
      name: file.name,
      mime: file.type || null,
      created_by: caller.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// DELETE /api/orders/:id/stages/:sid/attachments?id=<attachmentId>
export async function DELETE(req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canManageOrder(caller, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const attachmentId = new URL(req.url).searchParams.get('id');
  if (!attachmentId) {
    return NextResponse.json({ error: 'Falta el id del adjunto' }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: att } = await service
    .from('stage_attachments')
    .select('path')
    .eq('id', attachmentId)
    .eq('stage_id', params.sid)
    .single();

  const path = (att as unknown as { path: string } | null)?.path;
  if (path) {
    await service.storage.from(BUCKET).remove([path]);
  }

  const { error } = await service
    .from('stage_attachments')
    .delete()
    .eq('id', attachmentId)
    .eq('stage_id', params.sid);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
