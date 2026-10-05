import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { soloAdmin } from '@/lib/admin-taller';
import { sumarTotal } from '@/lib/budget';
import type { OrderStatus } from '@/lib/types';

type Params = { params: { id: string } };
export const dynamic = 'force-dynamic';

// GET /api/clients/:id — ficha del cliente con su historial de órdenes.
export async function GET(_: Request, { params }: Params) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;
  const service = createServiceClient();

  const { data: cli } = await service
    .from('clients')
    .select('id, workshop_id, first_name, last_name, whatsapp, notes, created_at')
    .eq('id', params.id)
    .eq('workshop_id', caller.workshopId)
    .maybeSingle();
  if (!cli) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });

  const { data: ords, error } = await service
    .from('orders')
    .select(
      'id, car_model, status, created_at, notes, mileage, budget:order_budget_items(amount, labor_amount, client_decision)'
    )
    .eq('workshop_id', caller.workshopId)
    .eq('client_id', params.id)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Fila = {
    id: string;
    car_model: string;
    status: OrderStatus;
    created_at: string;
    notes: string | null;
    mileage: number | null;
    budget: Array<{ amount: number; labor_amount: number; client_decision: string }> | null;
  };
  const orders = ((ords ?? []) as unknown as Fila[]).map(({ budget, ...o }) => ({
    ...o,
    budget_total: sumarTotal(budget ?? []),
    budget_items: (budget ?? []).length,
  }));

  return NextResponse.json({ client: cli, orders });
}
