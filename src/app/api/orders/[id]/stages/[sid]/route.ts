import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { UpdateStagePayload } from '@/lib/types';
import { getCaller, canManageOrder } from '@/lib/api-auth';

type Params = { params: { id: string; sid: string } };

// PATCH /api/orders/:id/stages/:sid
export async function PATCH(req: Request, { params }: Params) {
  const service = createServiceClient();

  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canManageOrder(caller, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body: UpdateStagePayload = await req.json();

  const updates: Record<string, unknown> = {};
  if (typeof body.name === 'string') updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description || null;
  if (body.status) {
    updates.status = body.status;
    updates.completed_at = body.status === 'done' ? new Date().toISOString() : null;
  }

  const { data, error } = await service
    .from('order_stages')
    .update(updates)
    .eq('id', params.sid)
    .eq('order_id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/orders/:id/stages/:sid
export async function DELETE(_: Request, { params }: Params) {
  const service = createServiceClient();

  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canManageOrder(caller, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await service
    .from('order_stages')
    .delete()
    .eq('id', params.sid)
    .eq('order_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
