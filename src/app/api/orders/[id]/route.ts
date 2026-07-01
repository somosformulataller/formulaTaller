import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { UpdateOrderPayload } from '@/lib/types';
import { getCaller, canManageOrder } from '@/lib/api-auth';

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
  if (!(await canManageOrder(caller, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body: UpdateOrderPayload = await req.json();

  let updates: UpdateOrderPayload;
  if (caller.role === 'admin') {
    // Admins may edit any field; auto-set status from mechanic assignment.
    updates = { ...body };
    if ('assigned_mechanic_id' in body && !('status' in body)) {
      updates.status = body.assigned_mechanic_id ? 'con_mecanico' : 'sin_mecanico';
    }
  } else {
    // Mechanics may only change the status of their assigned order.
    if (!body.status) {
      return NextResponse.json(
        { error: 'Solo puedes cambiar el estado de la orden' },
        { status: 403 }
      );
    }
    updates = { status: body.status };
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
