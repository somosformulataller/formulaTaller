import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { UpdateOrderPayload } from '@/lib/types';
import { getCaller, canManageOrder, canDeleteOrder } from '@/lib/api-auth';

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

  // Lista blanca de campos editables. NO se hace `{ ...body }`: el service
  // client salta el WITH CHECK de RLS (0014) y no hay trigger de columnas en
  // orders, así que un `{ ...body }` dejaría a cualquier staff enviar
  // workshop_id / public_token / created_by / id en el PATCH y moverse la orden
  // a otro taller o pisar el token de seguimiento. Solo se copian estos campos.
  const ALLOWED = [
    'client_first_name',
    'client_last_name',
    'client_whatsapp',
    'car_model',
    'notes',
    'status',
    'assigned_mechanic_id',
  ] as const;
  const updates: UpdateOrderPayload = {};
  for (const k of ALLOWED) {
    if (k in body) (updates as Record<string, unknown>)[k] = (body as Record<string, unknown>)[k];
  }

  // Auto-set status from mechanic assignment unless status is explicit.
  if ('assigned_mechanic_id' in body && !('status' in body)) {
    updates.status = body.assigned_mechanic_id ? 'con_mecanico' : 'sin_mecanico';
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 });
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

// DELETE /api/orders/:id
// Admin: cualquier orden de su taller. Mecánico: solo las suyas (asignadas a
// él o creadas por él). Esto lo resuelve canDeleteOrder (más estricto que
// canManageOrder, que ahora permite a cualquier staff gestionar la orden).
export async function DELETE(_: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDeleteOrder(caller, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient();

  // Limpiar los archivos de Storage ANTES de borrar la orden: el cascade de FK
  // borra las filas de stage_attachments, pero no los objetos del bucket, que
  // quedarían huérfanos (ahora son fotos privadas de clientes: coste + fuga).
  const { data: atts } = await service
    .from('stage_attachments')
    .select('path')
    .eq('order_id', params.id);
  const paths = (atts as unknown as { path: string }[] | null)?.map((a) => a.path) ?? [];
  if (paths.length > 0) {
    await service.storage.from('stage-files').remove(paths);
  }

  const { error } = await service
    .from('orders')
    .delete()
    .eq('id', params.id)
    .eq('workshop_id', caller.workshopId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
