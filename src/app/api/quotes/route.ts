import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { soloAdmin } from '@/lib/admin-taller';
import { cobrar, devolver, leerPrecios } from '@/lib/saldo';
import {
  QUOTE_SELECT,
  clienteDe,
  conCitas,
  guardarCitaDePresupuesto,
  limpiarPresupuesto,
} from '@/lib/presupuestos-servidor';
import type { Quote } from '@/lib/presupuestos';

export const dynamic = 'force-dynamic';

// GET /api/quotes — presupuestos sueltos del taller (0028), con su cita.
// Filtros: ?client_id=  ?libres=1 (solo los que no están vinculados a una orden)
export async function GET(req: Request) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;
  const sp = new URL(req.url).searchParams;
  const service = createServiceClient();

  let q = service.from('quotes').select(QUOTE_SELECT).eq('workshop_id', caller.workshopId);
  const clientId = sp.get('client_id');
  if (clientId) q = q.eq('client_id', clientId);
  if (sp.get('libres') === '1') q = q.is('order_id', null);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(await conCitas(service, (data ?? []) as unknown as Quote[]));
}

// POST /api/quotes — guarda un presupuesto suelto (cobra saldo) y su cita.
// Body: { client_first_name, client_last_name, client_whatsapp, car_model,
//         items: [{ description, amount, labor_amount }], labor_general_usd,
//         cita: { day, at_time } | null, enviado?: boolean }
export async function POST(req: Request) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });

  const limpio = limpiarPresupuesto(body);
  if (limpio.error !== undefined) return NextResponse.json({ error: limpio.error }, { status: 400 });
  const { datos, cita } = limpio;
  const service = createServiceClient();

  // Se cobra ANTES de guardar; si algo falla después, se devuelve.
  const { presupuesto: precio } = await leerPrecios(service);
  const etiqueta = `${datos.car_model} · ${datos.client_first_name} ${datos.client_last_name}`.trim();
  const cobro = await cobrar(service, caller.workshopId, precio, 'presupuesto', {
    userId: caller.userId,
    note: `Presupuesto: ${etiqueta}`.slice(0, 200),
  });
  if (!cobro.ok) {
    return NextResponse.json(
      { error: cobro.error, saldoInsuficiente: cobro.insuficiente },
      { status: cobro.insuficiente ? 402 : 500 }
    );
  }
  const reembolsar = () =>
    devolver(service, caller.workshopId, precio, `No se guardó el presupuesto: ${etiqueta}`.slice(0, 200), caller.userId);

  const clientId = await clienteDe(service, caller.workshopId, datos);
  const { data, error } = await service
    .from('quotes')
    .insert({
      ...datos,
      workshop_id: caller.workshopId,
      client_id: clientId,
      created_by: caller.userId,
      sent_at: body.enviado ? new Date().toISOString() : null,
    })
    .select(QUOTE_SELECT)
    .single();
  if (error) {
    await reembolsar();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const quote = data as unknown as Quote;

  const r = await guardarCitaDePresupuesto(service, {
    workshopId: caller.workshopId,
    quoteId: quote.id,
    clientId,
    userId: caller.userId,
    cita,
    eligeCliente: datos.client_picks_date,
  });
  // El presupuesto ya quedó guardado: si la cita no, se avisa sin deshacerlo.
  return NextResponse.json(
    { ...quote, labor_general_usd: Number(quote.labor_general_usd) || 0, cita: r.cita, citaError: r.error ?? null },
    { status: 201 }
  );
}
