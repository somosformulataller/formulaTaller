import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCaller, canManageOrder } from '@/lib/api-auth';
import { parseAmount } from '@/lib/budget';

type Params = { params: { id: string } };

const MAX_AMOUNT = 1_000_000;

// GET /api/orders/:id/mano-de-obra — la mano de obra general del presupuesto (0027)
export async function GET(_: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canManageOrder(caller, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('orders')
    .select('labor_general_usd')
    .eq('id', params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const fila = data as unknown as { labor_general_usd: number | string } | null;
  return NextResponse.json({ labor_general_usd: Number(fila?.labor_general_usd ?? 0) });
}

// PATCH /api/orders/:id/mano-de-obra — { labor_general_usd }
export async function PATCH(req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canManageOrder(caller, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { labor_general_usd?: number | string } | null;
  // Vacío = sin mano de obra general.
  const crudo = body?.labor_general_usd;
  const monto = crudo === '' || crudo === null || crudo === undefined ? 0 : parseAmount(crudo);
  if (monto === null) return NextResponse.json({ error: 'Mano de obra inválida' }, { status: 400 });
  if (monto > MAX_AMOUNT) return NextResponse.json({ error: 'Mano de obra demasiado alta' }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from('orders')
    .update({ labor_general_usd: monto })
    .eq('id', params.id)
    .select('labor_general_usd')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  return NextResponse.json({ labor_general_usd: Number((data as { labor_general_usd: number }).labor_general_usd) });
}
