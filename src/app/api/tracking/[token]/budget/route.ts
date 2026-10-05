import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { BudgetDecision } from '@/lib/types';

type Params = { params: { token: string } };

export const dynamic = 'force-dynamic';

// Freno contra abuso: el enlace es público (basta el token), así que un
// programa podría martillar este endpoint. Una persona real no pasa de unas
// pocas decisiones por minuto.
const MAX_POR_MINUTO = 40;

const ITEM_COLS =
  'id, order_id, description, amount, labor_amount, position, client_decision, decided_at, revised_at, created_by, created_at, updated_at';

// POST /api/tracking/:token/budget — el cliente aprueba o rechaza.
//
// Cuerpo: { item_id: string, decision } para un ítem, o { all: true,
// decision: 'aprobado' } para el botón «Aprobar todo». Puede cambiar de idea
// mientras la orden no esté lista; cada cambio queda en budget_decisions y
// le llega al taller como notificación.
export async function POST(req: Request, { params }: Params) {
  const body = (await req.json().catch(() => null)) as
    | { item_id?: string; all?: boolean; decision?: BudgetDecision }
    | null;
  const decision = body?.decision;
  if (decision !== 'aprobado' && decision !== 'rechazado') {
    return NextResponse.json({ error: 'Decisión inválida' }, { status: 400 });
  }
  if (!body?.all && typeof body?.item_id !== 'string') {
    return NextResponse.json({ error: 'Falta el ítem' }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: ord } = await service
    .from('orders')
    .select('id, workshop_id, status, client_first_name, client_last_name, car_model')
    .eq('public_token', params.token)
    .maybeSingle();
  const order = ord as unknown as {
    id: string;
    workshop_id: string;
    status: string;
    client_first_name: string;
    client_last_name: string;
    car_model: string;
  } | null;
  if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  if (order.status === 'lista') {
    return NextResponse.json(
      { error: 'El vehículo ya está listo; el presupuesto no se puede cambiar.' },
      { status: 409 }
    );
  }

  const haceUnMinuto = new Date(Date.now() - 60_000).toISOString();
  const { count } = await service
    .from('budget_decisions')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', order.id)
    .gte('created_at', haceUnMinuto);
  if ((count ?? 0) >= MAX_POR_MINUTO) {
    return NextResponse.json({ error: 'Espera un momento antes de seguir.' }, { status: 429 });
  }

  // Los ítems a cambiar: el pedido, o todos los que no tienen ya esa decisión.
  // El .eq('order_id') impide decidir sobre un ítem de OTRA orden.
  let q = service
    .from('order_budget_items')
    .select('id, description, client_decision')
    .eq('order_id', order.id);
  if (!body.all) q = q.eq('id', body.item_id as string);
  const { data: filas } = await q;
  const objetivo = ((filas ?? []) as unknown as Array<{
    id: string;
    description: string;
    client_decision: BudgetDecision;
  }>).filter((i) => i.client_decision !== decision);

  if (!body.all && (filas ?? []).length === 0) {
    return NextResponse.json({ error: 'Ítem no encontrado' }, { status: 404 });
  }

  if (objetivo.length > 0) {
    const ahora = new Date().toISOString();
    const { error } = await service
      .from('order_budget_items')
      .update({ client_decision: decision, decided_at: ahora, revised_at: null })
      .in('id', objetivo.map((i) => i.id))
      .eq('order_id', order.id);
    if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });

    await service.from('budget_decisions').insert(
      objetivo.map((i) => ({
        item_id: i.id,
        order_id: order.id,
        description: i.description,
        decision,
      }))
    );

    const cliente = `${order.client_first_name} ${order.client_last_name}`.trim();
    const verbo = decision === 'aprobado' ? 'aprobó' : 'rechazó';
    const que =
      body.all || objetivo.length > 1
        ? `${objetivo.length} ítems del presupuesto`
        : `«${objetivo[0].description}»`;
    await service.from('notifications').insert({
      workshop_id: order.workshop_id,
      order_id: order.id,
      kind: 'presupuesto',
      message: `${cliente} ${verbo} ${que} (${order.car_model}).`,
    });
  }

  const { data: items } = await service
    .from('order_budget_items')
    .select(ITEM_COLS)
    .eq('order_id', order.id)
    .order('position', { ascending: true });

  return NextResponse.json(items ?? []);
}
