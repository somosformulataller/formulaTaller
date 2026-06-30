import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { UpdateStagePayload } from '@/lib/types';

type Params = { params: { id: string; sid: string } };

// PATCH /api/orders/:id/stages/:sid
export async function PATCH(req: Request, { params }: Params) {
  const supabase = await createClient();
  const service = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body: UpdateStagePayload = await req.json();

  const updates = {
    status: body.status,
    completed_at: body.status === 'done' ? new Date().toISOString() : null,
  };

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
  const supabase = await createClient();
  const service = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await service
    .from('order_stages')
    .delete()
    .eq('id', params.sid)
    .eq('order_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
