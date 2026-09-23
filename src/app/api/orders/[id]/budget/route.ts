import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCaller, canManageOrder } from '@/lib/api-auth';
import { parseAmount } from '@/lib/budget';
import type { CreateBudgetItemPayload } from '@/lib/types';

type Params = { params: { id: string } };

const MAX_DESC = 120;
// Tope por ítem: atrapa el dedazo (un cero de más) antes de que llegue a un
// presupuesto que ve el cliente. Un repuesto de más de un millón no existe.
const MAX_AMOUNT = 1_000_000;

// GET /api/orders/:id/budget — ítems del presupuesto de la orden
export async function GET(_: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canManageOrder(caller, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('order_budget_items')
    .select('*')
    .eq('order_id', params.id)
    .order('position', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/orders/:id/budget — agrega uno o varios ítems.
//
// Acepta un objeto o un array. El array es para el alta de la orden: el
// formulario arma el presupuesto ANTES de que la orden exista, así que se
// manda entero de un viaje apenas se crea, en vez de una petición por ítem.
export async function POST(req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canManageOrder(caller, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | CreateBudgetItemPayload
    | CreateBudgetItemPayload[]
    | null;
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });

  const entrada = Array.isArray(body) ? body : [body];
  if (entrada.length === 0) return NextResponse.json([]);
  if (entrada.length > 100) {
    return NextResponse.json({ error: 'Demasiados ítems de una vez' }, { status: 400 });
  }

  const limpios: Array<{ description: string; amount: number }> = [];
  for (const it of entrada) {
    const description = String(it?.description ?? '').trim().slice(0, MAX_DESC);
    const amount = parseAmount(it?.amount);
    if (!description) {
      return NextResponse.json({ error: 'Cada ítem necesita un nombre' }, { status: 400 });
    }
    if (amount === null) {
      return NextResponse.json(
        { error: `El precio de "${description}" no es un número válido` },
        { status: 400 }
      );
    }
    if (amount > MAX_AMOUNT) {
      return NextResponse.json(
        { error: `El precio de "${description}" es demasiado alto` },
        { status: 400 }
      );
    }
    limpios.push({ description, amount });
  }

  const service = createServiceClient();

  // Posición de partida: se agregan al final de lo que ya haya.
  const { data: ultima } = await service
    .from('order_budget_items')
    .select('position')
    .eq('order_id', params.id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const desde = ((ultima as unknown as { position: number } | null)?.position ?? 0) + 1;

  const { data, error } = await service
    .from('order_budget_items')
    .insert(
      limpios.map((it, i) => ({
        order_id: params.id,
        description: it.description,
        amount: it.amount,
        position: desde + i,
        created_by: caller.userId,
      }))
    )
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? [], { status: 201 });
}
