import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCaller, canManageOrder } from '@/lib/api-auth';

type Params = { params: { id: string; sid: string } };

const BUCKET = 'stage-files';

// POST /api/orders/:id/stages/:sid/attachments/sign
// Returns a signed upload URL so the browser can upload the file bytes
// straight to Supabase Storage — bypassing the serverless request-body limit
// (important for videos/voice notes). The metadata row is created afterwards
// via POST .../attachments (JSON mode).
export async function POST(req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canManageOrder(caller, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const rawName = typeof body?.name === 'string' && body.name ? body.name : 'archivo';
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'archivo';
  const path = `${params.id}/${params.sid}/${Date.now()}-${safeName}`;

  const service = createServiceClient();
  const { data, error } = await service.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ path: data.path, token: data.token }, { status: 200 });
}
