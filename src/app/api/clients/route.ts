import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { soloAdmin, traerTodo } from '@/lib/admin-taller';
import { hoyVE } from '@/lib/recordatorios';
import type { Client, ClientRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

// GET /api/clients — los clientes del taller, con cuántas órdenes tienen, su
// último vehículo y cuántos recordatorios pendientes. El buscador filtra en
// el navegador: un taller tiene cientos de clientes, no cientos de miles.
export async function GET() {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;
  const wid = caller.workshopId;
  const service = createServiceClient();

  try {
    const [clientes, ordenes, recordatorios] = await Promise.all([
      traerTodo<Client>((d, h) =>
        service
          .from('clients')
          .select('id, workshop_id, first_name, last_name, whatsapp, notes, created_at')
          .eq('workshop_id', wid)
          .order('first_name', { ascending: true })
          .range(d, h)
      ),
      traerTodo<{ client_id: string | null; car_model: string; created_at: string }>((d, h) =>
        service
          .from('orders')
          .select('client_id, car_model, created_at')
          .eq('workshop_id', wid)
          .order('created_at', { ascending: false })
          .range(d, h)
      ),
      traerTodo<{ client_id: string }>((d, h) =>
        service
          .from('reminders')
          .select('client_id')
          .eq('workshop_id', wid)
          .neq('status', 'hecho')
          .gte('due_date', hoyVE())
          .range(d, h)
      ),
    ]);

    const stats = new Map<string, { n: number; last: string | null; car: string | null }>();
    for (const o of ordenes) {
      if (!o.client_id) continue;
      const s = stats.get(o.client_id);
      if (s) s.n += 1;
      // Vienen de la más nueva a la más vieja: la primera es la última.
      else stats.set(o.client_id, { n: 1, last: o.created_at, car: o.car_model });
    }
    const pendientes = new Map<string, number>();
    for (const r of recordatorios) pendientes.set(r.client_id, (pendientes.get(r.client_id) ?? 0) + 1);

    const filas: ClientRow[] = clientes.map((c) => {
      const s = stats.get(c.id);
      return {
        ...c,
        order_count: s?.n ?? 0,
        last_order_at: s?.last ?? null,
        last_car_model: s?.car ?? null,
        pending_reminders: pendientes.get(c.id) ?? 0,
      };
    });
    filas.sort((a, b) =>
      `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'es', { sensitivity: 'base' })
    );
    return NextResponse.json(filas);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al cargar los clientes';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
