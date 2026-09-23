import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCaller, canManageOrder } from '@/lib/api-auth';
import { parseAmount } from '@/lib/budget';
import type { UpdateBudgetItemPayload } from '@/lib/types';

type Params = { params: { id: string; itemId: string } };

const MAX_DESC = 120;
const MAX_AMOUNT = 1_000_000;

// PATCH /api/orders/:id/budget/:itemId — editar nombre o precio de un ítem
export async function PATCH(req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canManageOrder(caller, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as UpdateBudgetItemPayload | null;
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });

  const patch: { description?: string; amount?: number } = {};

  if (body.description !== undefined) {
    const d = String(body.description).trim().slice(0, MAX_DESC);
    if (!d) return NextResponse.json({ error: 'El nombre no puede quedar vacío' }, { status: 400 });
    patch.description = d;
  }
  if (body.amount !== undefined) {
    const a = parseAmount(body.amount);
    if (a === null) return NextResponse.json({ error: 'Precio inválido' }, { status: 400 });
    if (a > MAX_AMOUNT) return NextResponse.json({ error: 'Precio demasiado alto' }, { status: 400 });
    patch.amount = a;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nada que cambiar' }, { status: 400 });
  }

  const service = createServiceClient();
  // El .eq('order_id') no es decorativo: impide editar un ítem de OTRA orden
  // pasando un itemId ajeno junto a un id de orden que sí se puede gestionar.
  const { data, error } = await service
    .from('order_budget_items')
    .update(patch)
    .eq('id', params.itemId)
    .eq('order_id', params.id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Ítem no encontrado' }, { status: 404 });
  return NextResponse.json(data);
}

// DELETE /api/orders/:id/budget/:itemId
export async function DELETE(_: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canManageOrder(caller, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from('order_budget_items')
    .delete()
    .eq('id', params.itemId)
    .eq('order_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
