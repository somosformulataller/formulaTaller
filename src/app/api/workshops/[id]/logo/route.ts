import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/api-auth';

type Params = { params: { id: string } };

const BUCKET = 'stage-files';

// POST /api/workshops/:id/logo — upload/replace the workshop logo.
// Small image (compressed client-side), so a multipart upload through the
// server is fine. Admin of that workshop only.
export async function POST(req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (caller.role !== 'admin' || caller.workshopId !== params.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Archivo no válido' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'El logo debe ser una imagen.' }, { status: 400 });
  }

  const service = createServiceClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `logos/${params.id}/${Date.now()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: pub } = service.storage.from(BUCKET).getPublicUrl(path);

  const { data, error } = await service
    .from('workshops')
    .update({ logo_url: pub.publicUrl })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
