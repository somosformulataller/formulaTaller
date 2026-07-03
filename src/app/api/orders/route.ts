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

  // Free-plan limit: block once the workshop reaches its order_limit, salvo que
  // el taller esté suscrito (plan pago) → órdenes ilimitadas.
  const { data: ws } = await service
    .from('workshops')
    .select('order_limit, is_subscribed')
    .eq('id', caller.workshopId)
    .single();
  const workshop = ws as unknown as { order_limit: number; is_subscribed: boolean } | null;
  const limit = workshop?.order_limit ?? 3;

  if (!workshop?.is_subscribed) {
    const { count } = await service
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('workshop_id', caller.workshopId);

    if ((count ?? 0) >= limit) {
      return NextResponse.json(
        {
          error:
            'Alcanzaste el límite de órdenes del plan gratuito. Para seguir usando la app debes pagar la suscripción.',
          limitReached: true,
        },
        { status: 402 }
      );
    }
  }

  const { data: created, error } = await service
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
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orderId = (created as unknown as { id: string }).id;

  // Etapa de "Recepción" (posición 0): contiene los archivos adjuntados al
  // crear la orden (fotos, video, notas de voz, documentos). Es información
  // principal de la orden y se muestra aparte de las etapas del servicio, que
  // van de la posición 1 en adelante (sembradas por un trigger en la BD).
  await service.from('order_stages').insert({
    order_id: orderId,
    name: 'Recepción',
    position: 0,
    status: 'pending',
    completed_at: null,
  });

  // Releer la orden ya con la etapa de recepción incluida.
  const { data, error: selErr } = await service
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', orderId)
    .single();

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
