import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { soloAdmin } from '@/lib/admin-taller';
import {
  QUOTE_SELECT,
  clienteDe,
  conCitas,
  guardarCitaDePresupuesto,
  limpiarPresupuesto,
} from '@/lib/presupuestos-servidor';
import type { Quote } from '@/lib/presupuestos';

type Params = { params: { id: string } };
export const dynamic = 'force-dynamic';

async function leer(service: ReturnType<typeof createServiceClient>, id: string, workshopId: string) {
  const { data } = await service
    .from('quotes')
    .select(QUOTE_SELECT)
    .eq('id', id)
    .eq('workshop_id', workshopId)
    .maybeSingle();
  if (!data) return null;
  const [q] = await conCitas(service, [data as unknown as Quote]);
  return q;
}

// GET /api/quotes/:id
export async function GET(_: Request, { params }: Params) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;
  const q = await leer(createServiceClient(), params.id, caller.workshopId);
  if (!q) return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
  return NextResponse.json(q);
}

// PATCH /api/quotes/:id — edita el presupuesto y su cita (no cobra otra vez).
// Mismo cuerpo que el POST. Con { solo_enviado: true } solo marca que se envió.
export async function PATCH(req: Request, { params }: Params) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });
  const service = createServiceClient();

  const actual = await leer(service, params.id, caller.workshopId);
  if (!actual) return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });

  if (body.solo_enviado) {
    await service.from('quotes').update({ sent_at: new Date().toISOString() }).eq('id', params.id);
    return NextResponse.json(await leer(service, params.id, caller.workshopId));
  }
  if (actual.order_id) {
    return NextResponse.json(
      { error: 'Este presupuesto ya está en una orden: edítalo desde la orden.' },
      { status: 409 }
    );
  }

  const limpio = limpiarPresupuesto(body);
  if (limpio.error !== undefined) return NextResponse.json({ error: limpio.error }, { status: 400 });
  const { datos, cita } = limpio;

  // Si cambió lo que cuesta, el cliente tiene que volver a aprobarlo (0030).
  const cambioPrecio =
    JSON.stringify(datos.items) !== JSON.stringify(actual.items.map((i) => ({ description: i.description, amount: Number(i.amount), labor_amount: Number(i.labor_amount) }))) ||
    datos.labor_general_usd !== actual.labor_general_usd;

  const clientId = await clienteDe(service, caller.workshopId, datos);
  const { error } = await service
    .from('quotes')
    .update({
      ...datos,
      client_id: clientId,
      ...(cambioPrecio && actual.client_decision !== 'pendiente' ? { client_decision: 'pendiente', decided_at: null } : {}),
      ...(body.enviado ? { sent_at: new Date().toISOString() } : {}),
    })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const r = await guardarCitaDePresupuesto(service, {
    workshopId: caller.workshopId,
    quoteId: params.id,
    clientId,
    userId: caller.userId,
    cita,
    eligeCliente: datos.client_picks_date,
  });
  const q = await leer(service, params.id, caller.workshopId);
  return NextResponse.json({ ...q, citaError: r.error ?? null });
}

// DELETE /api/quotes/:id — borra el presupuesto y su cita (no devuelve saldo).
export async function DELETE(_: Request, { params }: Params) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;
  const service = createServiceClient();
  await service
    .from('appointments')
    .delete()
    .eq('quote_id', params.id)
    .eq('workshop_id', caller.workshopId)
    .is('order_id', null);
  const { error } = await service.from('quotes').delete().eq('id', params.id).eq('workshop_id', caller.workshopId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
