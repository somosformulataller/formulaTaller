import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCaller, canManageOrder } from '@/lib/api-auth';

type Params = { params: { id: string } };

// POST /api/orders/:id/stages/reorder  { ids: string[] }
// Sets each stage's position to its index in the given order (1-based).
export async function POST(req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canManageOrder(caller, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? (body!.ids as unknown[]).filter((x) => typeof x === 'string') : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'Orden inválido' }, { status: 400 });
  }

  const service = createServiceClient();
  for (let i = 0; i < ids.length; i++) {
    const { error } = await service
      .from('order_stages')
      .update({ position: i + 1 })
      .eq('id', ids[i] as string)
      .eq('order_id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
