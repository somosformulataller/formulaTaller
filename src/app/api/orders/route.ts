import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { CreateOrderPayload } from '@/lib/types';

// GET /api/orders
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profileResult = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const profile = profileResult.data as unknown as { role: string } | null;

  let query = supabase
    .from('orders')
    .select(`
      *,
      assigned_mechanic:profiles!assigned_mechanic_id(id, full_name, phone),
      stages:order_stages(*)
    `)
    .order('created_at', { ascending: false });

  // Mechanics only see their own assigned orders
  if (profile?.role === 'mechanic') {
    query = query.eq('assigned_mechanic_id', user.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

// POST /api/orders
export async function POST(req: Request) {
  const supabase = await createClient();
  const service = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body: CreateOrderPayload = await req.json();

  // Use service client for insert to avoid TS never type issues
  const { data, error } = await service
    .from('orders')
    .insert({
      client_first_name: body.client_first_name,
      client_last_name: body.client_last_name,
      client_whatsapp: body.client_whatsapp,
      car_model: body.car_model,
      assigned_mechanic_id: body.assigned_mechanic_id ?? null,
      notes: body.notes ?? null,
      created_by: user.id,
      status: body.assigned_mechanic_id ? 'con_mecanico' : 'sin_mecanico',
    })
    .select(`
      *,
      assigned_mechanic:profiles!assigned_mechanic_id(id, full_name, phone),
      stages:order_stages(*)
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
