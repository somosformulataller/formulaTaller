import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { soloAdmin, firmarArchivos } from '@/lib/admin-taller';
import { REMINDER_SELECT, limpiarRecordatorio } from '@/lib/recordatorios-servidor';
import type { Reminder } from '@/lib/types';

export const dynamic = 'force-dynamic';
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/reminders — filtros: ?client_id=  ?order_id=  ?from=AAAA-MM-DD&to=AAAA-MM-DD
export async function GET(req: Request) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;
  const url = new URL(req.url);
  const service = createServiceClient();

  let q = service.from('reminders').select(REMINDER_SELECT).eq('workshop_id', caller.workshopId);
  const clientId = url.searchParams.get('client_id');
  const orderId = url.searchParams.get('order_id');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (clientId) q = q.eq('client_id', clientId);
  if (orderId) q = q.eq('order_id', orderId);
  if (from && FECHA.test(from)) q = q.gte('due_date', from);
  if (to && FECHA.test(to)) q = q.lte('due_date', to);

  const { data, error } = await q.order('due_date', { ascending: true }).limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filas = await firmarArchivos(service, (data ?? []) as unknown as Reminder[]);
  return NextResponse.json(filas);
}

// POST /api/reminders — crea un recordatorio para un cliente del taller.
export async function POST(req: Request) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });

  const service = createServiceClient();
  const { datos, error: invalido } = await limpiarRecordatorio(service, caller.workshopId, body, false);
  if (invalido) return NextResponse.json({ error: invalido }, { status: 400 });

  const { data, error } = await service
    .from('reminders')
    .insert({ ...datos, workshop_id: caller.workshopId, created_by: caller.userId })
    .select(REMINDER_SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const [fila] = await firmarArchivos(service, [data as unknown as Reminder]);
  return NextResponse.json(fila, { status: 201 });
}
