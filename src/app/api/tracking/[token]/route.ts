import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type Params = { params: { token: string } };

// GET /api/tracking/:token — public, no auth required
export async function GET(_: Request, { params }: Params) {
  const service = createServiceClient();

  const { data: order, error } = await service
    .from('orders')
    .select(`
      id,
      public_token,
      client_first_name,
      client_last_name,
      car_model,
      status,
      created_at,
      updated_at,
      assigned_mechanic:profiles!assigned_mechanic_id(full_name),
      workshop:workshops(name),
      stages:order_stages(id, name, position, status, completed_at),
      budget:order_budget_items(id, description, amount, position)
    `)
    .eq('public_token', params.token)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  }

  // Sort stages by position
  if (order.stages) {
    (order.stages as Array<{position: number}>).sort((a, b) => a.position - b.position);
  }
  // Y el presupuesto igual, en el orden en que lo armó el taller.
  if (order.budget) {
    (order.budget as Array<{ position: number }>).sort((a, b) => a.position - b.position);
  }

  return NextResponse.json(order);
}
