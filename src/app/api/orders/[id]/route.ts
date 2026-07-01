import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { UpdateOrderPayload } from '@/lib/types';
import { getCaller } from '@/lib/api-auth';

type Params = { params: { id: string } };

// GET /api/orders/:id
export async function GET(_: Request, { params }: Params) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      assigned_mechanic:profiles!assigned_mechanic_id(id, full_name, phone),
      stages:order_stages(*)
    `)
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// PATCH /api/orders/:id
export async function PATCH(req: Request, { params }: Params) {
  const service = createServiceClient();

  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Any staff member (admin or mechanic) may create/assign/edit orders.
  if (caller.role !== 'admin' && caller.role !== 'mechanic') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body: UpdateOrderPayload = await req.json();

  // Auto-set status from mechanic assignment unless status is explicit.
  const updates: UpdateOrderPayload = { ...body };
  if ('assigned_mechanic_id' in body && !('status' in body)) {
    updates.status = body.assigned_mechanic_id ? 'con_mecanico' : 'sin_mecanico';
  }

  // Use service client for mutations (any-typed, avoids TS never issues)
  const { data, error } = await service
    .from('orders')
    .update(updates)
    .eq('id', params.id)
    .select(`
      *,
      assigned_mechanic:profiles!assigned_mechanic_id(id, full_name, phone),
      stages:order_stages(*)
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/orders/:id
export async function DELETE(_: Request, { params }: Params) {
  const supabase = await createClient();
  const service = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profileResult = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const callerRole = (profileResult.data as unknown as { role: string } | null)?.role;

  if (callerRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await service.from('orders').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
