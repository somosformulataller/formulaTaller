import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getPlatformAdmin } from '@/lib/api-auth';

type Params = { params: { id: string } };

// POST /api/superadmin/workshops/:id/tags — asigna una etiqueta al taller.
// Body: { tag_id }
export async function POST(req: Request, { params }: Params) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const tagId = typeof body?.tag_id === 'string' ? body.tag_id : '';
  if (!tagId) return NextResponse.json({ error: 'Falta tag_id' }, { status: 400 });

  const service = createServiceClient();
  // upsert: asignar dos veces la misma etiqueta no es un error.
  const { error } = await service
    .from('workshop_tags')
    .upsert({ workshop_id: params.id, tag_id: tagId }, { onConflict: 'workshop_id,tag_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

// DELETE /api/superadmin/workshops/:id/tags?tag_id=... — quita la etiqueta.
export async function DELETE(req: Request, { params }: Params) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  let tagId = url.searchParams.get('tag_id') ?? '';
  if (!tagId) {
    const body = await req.json().catch(() => null);
    tagId = typeof body?.tag_id === 'string' ? body.tag_id : '';
  }
  if (!tagId) return NextResponse.json({ error: 'Falta tag_id' }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service
    .from('workshop_tags')
    .delete()
    .eq('workshop_id', params.id)
    .eq('tag_id', tagId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
