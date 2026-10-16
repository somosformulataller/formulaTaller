import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { soloAdmin } from '@/lib/admin-taller';
import { QUOTE_SELECT, vincularAOrden } from '@/lib/presupuestos-servidor';
import type { Quote } from '@/lib/presupuestos';

type Params = { params: { id: string } };

// POST /api/quotes/:id/vincular — { order_id }
// Une un presupuesto suelto a una orden que ya existe: sus ítems y su mano de
// obra general se suman al presupuesto de la orden.
export async function POST(req: Request, { params }: Params) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;
  const body = (await req.json().catch(() => null)) as { order_id?: string } | null;
  if (!body?.order_id) return NextResponse.json({ error: 'Falta la orden' }, { status: 400 });
  const service = createServiceClient();

  const [{ data: q }, { data: o }] = await Promise.all([
    service.from('quotes').select(QUOTE_SELECT).eq('id', params.id).eq('workshop_id', caller.workshopId).maybeSingle(),
    service.from('orders').select('id').eq('id', body.order_id).eq('workshop_id', caller.workshopId).maybeSingle(),
  ]);
  if (!q) return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
  if (!o) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  const quote = q as unknown as Quote;
  if (quote.order_id) {
    return NextResponse.json({ error: 'Este presupuesto ya está vinculado a una orden.' }, { status: 409 });
  }

  const fallo = await vincularAOrden(service, { quote, orderId: body.order_id, userId: caller.userId, copiarItems: true });
  if (fallo) return NextResponse.json({ error: fallo }, { status: 500 });
  return NextResponse.json({ ok: true });
}
