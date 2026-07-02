import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/api-auth';
import type { CreateOrderPayload } from '@/lib/types';

const ORDER_SELECT = `
  *,
  assigned_mechanic:profiles!assigned_mechanic_id(id, full_name, phone),
  stages:order_stages(*),
  workshop:workshops(name)
`;

// GET /api/orders — orders of the caller's workshop only.
export async function GET() {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!caller.workshopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const service = createServiceClient();
  const { data, error } = await service
    .from('orders')
    .select(ORDER_SELECT)
    .eq('workshop_id', caller.workshopId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

// POST /api/orders
export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!caller.workshopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body: CreateOrderPayload = await req.json();
  const service = createServiceClient();

  const { data, error } = await service
    .from('orders')
    .insert({
      workshop_id: caller.workshopId,
      client_first_name: body.client_first_name,
      client_last_name: body.client_last_name,
      client_whatsapp: body.client_whatsapp,
      car_model: body.car_model,
      assigned_mechanic_id: body.assigned_mechanic_id ?? null,
      notes: body.notes ?? null,
      created_by: caller.userId,
      status: body.assigned_mechanic_id ? 'con_mecanico' : 'sin_mecanico',
    })
    .select(ORDER_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
