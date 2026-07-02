import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { UpdateOrderPayload } from '@/lib/types';
import { getCaller, canManageOrder } from '@/lib/api-auth';

type Params = { params: { id: string } };

const ORDER_SELECT = `
  *,
  assigned_mechanic:profiles!assigned_mechanic_id(id, full_name, phone),
  stages:order_stages(*),
  workshop:workshops(name)
`;

// GET /api/orders/:id — scoped to the caller's workshop.
export async function GET(_: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!caller.workshopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const service = createServiceClient();
  const { data, error } = await service
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', params.id)
    .eq('workshop_id', caller.workshopId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// PATCH /api/orders/:id
export async function PATCH(req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Must be able to manage this order (belongs to the workshop; admin, or
  // assigned mechanic).
  if (!(await canManageOrder(caller, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body: UpdateOrderPayload = await req.json();

  // Auto-set status from mechanic assignment unless status is explicit.
  const updates: UpdateOrderPayload = { ...body };
  if ('assigned_mechanic_id' in body && !('status' in body)) {
    updates.status = body.assigned_mechanic_id ? 'con_mecanico' : 'sin_mecanico';
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('orders')
    .update(updates)
    .eq('id', params.id)
    .eq('workshop_id', caller.workshopId)
    .select(ORDER_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/orders/:id  (admin of the order's workshop only)
export async function DELETE(_: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (caller.role !== 'admin' || !caller.workshopId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from('orders')
    .delete()
    .eq('id', params.id)
    .eq('workshop_id', caller.workshopId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
