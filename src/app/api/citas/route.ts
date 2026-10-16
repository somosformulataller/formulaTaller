import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { soloAdmin } from '@/lib/admin-taller';
import { hoyVE } from '@/lib/recordatorios';
import { CITA_SELECT, citasDelDia, limpiarCita, normalizarCita } from '@/lib/presupuestos-servidor';
import { estaOcupado, type Cita } from '@/lib/presupuestos';

export const dynamic = 'force-dynamic';
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/citas — citas y horarios ocupados (0028).
// Filtros: ?from=AAAA-MM-DD&to=AAAA-MM-DD  ?client_id= (sus citas de hoy en adelante)
export async function GET(req: Request) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;
  const sp = new URL(req.url).searchParams;
  const service = createServiceClient();

  let q = service.from('appointments').select(CITA_SELECT).eq('workshop_id', caller.workshopId);
  const from = sp.get('from');
  const to = sp.get('to');
  const clientId = sp.get('client_id');
  if (from && FECHA.test(from)) q = q.gte('day', from);
  if (to && FECHA.test(to)) q = q.lte('day', to);
  if (clientId) q = q.eq('client_id', clientId).gte('day', hoyVE());
  const { data, error } = await q
    .order('day', { ascending: true })
    .order('at_time', { ascending: true, nullsFirst: true })
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(((data ?? []) as unknown as Cita[]).map(normalizarCita));
}

// POST /api/citas — { kind: 'cita'|'ocupado', client_id?, day, at_time?, note? }
export async function POST(req: Request) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });
  const limpio = limpiarCita(body);
  if (limpio.error !== undefined) return NextResponse.json({ error: limpio.error }, { status: 400 });
  const { datos } = limpio;
  const service = createServiceClient();

  if (datos.kind === 'cita' && datos.client_id) {
    const { data: cli } = await service
      .from('clients')
      .select('id')
      .eq('id', datos.client_id)
      .eq('workshop_id', caller.workshopId)
      .maybeSingle();
    if (!cli) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    const delDia = await citasDelDia(service, caller.workshopId, datos.day);
    if (estaOcupado(delDia, datos.day, datos.at_time)) {
      return NextResponse.json({ error: 'Ese día u hora está marcado como ocupado.' }, { status: 409 });
    }
  }

  const { data, error } = await service
    .from('appointments')
    .insert({
      ...datos,
      client_id: datos.kind === 'cita' ? datos.client_id : null,
      workshop_id: caller.workshopId,
      created_by: caller.userId,
    })
    .select(CITA_SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(normalizarCita(data as unknown as Cita), { status: 201 });
}
