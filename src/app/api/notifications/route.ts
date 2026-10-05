import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { soloAdmin } from '@/lib/admin-taller';
import { hoyVE } from '@/lib/recordatorios';
import { REMINDER_SELECT } from '@/lib/recordatorios-servidor';

export const dynamic = 'force-dynamic';

// GET /api/notifications — lo que ve la campana del admin:
//  • las respuestas de los clientes al presupuesto (tabla notifications), y
//  • los recordatorios cuyo día de aviso ya llegó y todavía no se enviaron.
// Los recordatorios se calculan al vuelo por fecha, así que no hace falta un
// proceso diario que los «dispare»: el día que toca, aparecen solos.
// ?order_id= devuelve solo las de esa orden (para el aviso dentro de la orden).
export async function GET(req: Request) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;
  const service = createServiceClient();
  const orderId = new URL(req.url).searchParams.get('order_id');

  let q = service
    .from('notifications')
    .select('id, order_id, kind, message, read_at, created_at')
    .eq('workshop_id', caller.workshopId);
  if (orderId) q = q.eq('order_id', orderId);
  const [notifs, unread, due] = await Promise.all([
    q.order('created_at', { ascending: false }).limit(30),
    service
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('workshop_id', caller.workshopId)
      .is('read_at', null),
    orderId
      ? Promise.resolve({ data: [] })
      : service
          .from('reminders')
          .select(REMINDER_SELECT)
          .eq('workshop_id', caller.workshopId)
          .eq('status', 'pendiente')
          .lte('notify_on', hoyVE())
          .order('due_date', { ascending: true })
          .limit(50),
  ]);

  return NextResponse.json({
    notifications: notifs.data ?? [],
    unread_count: unread.count ?? 0,
    due_reminders: due.data ?? [],
  });
}

// PATCH /api/notifications — { ids?: string[], order_id?: string, all?: true }
// Marca como leídas.
export async function PATCH(req: Request) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;
  const body = await req.json().catch(() => null);
  const service = createServiceClient();

  let q = service
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('workshop_id', caller.workshopId)
    .is('read_at', null);
  if (Array.isArray(body?.ids) && body.ids.length) q = q.in('id', body.ids.slice(0, 200).map(String));
  else if (typeof body?.order_id === 'string') q = q.eq('order_id', body.order_id);
  else if (body?.all !== true) return NextResponse.json({ error: 'Nada que marcar' }, { status: 400 });

  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
