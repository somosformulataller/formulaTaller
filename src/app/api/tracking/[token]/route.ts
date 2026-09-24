import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { MECHANICS_EMBED } from '@/lib/mecanicos-orden';
import { nombresAsignados } from '@/lib/asignacion';

type Params = { params: { token: string } };

// Este endpoint es público y sin cookies, así que Next.js guardaba tanto la
// respuesta como las consultas a Supabase y las servía viejas: al taller le
// cambiaban los mecánicos y el JSON seguía devolviendo los de antes — incluido
// un nombre que el taller acababa de decidir NO enseñar. La página del
// seguimiento ya llevaba estas dos líneas por el mismo motivo; aquí faltaban.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// GET /api/tracking/:token — public, no auth required
export async function GET(_: Request, { params }: Params) {
  const service = createServiceClient();

  const { data: order, error } = await service
    .from('orders')
    .select(`
      id,
      public_token,
      client_first_name,
      client_last_name,
      car_model,
      status,
      created_at,
      updated_at,
      show_workshop_as_mechanic,
      ${MECHANICS_EMBED},
      workshop:workshops(name),
      stages:order_stages(id, name, position, status, completed_at),
      budget:order_budget_items(id, description, amount, position)
    `)
    .eq('public_token', params.token)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  }

  // Sort stages by position
  if (order.stages) {
    (order.stages as Array<{position: number}>).sort((a, b) => a.position - b.position);
  }
  // Y el presupuesto igual, en el orden en que lo armó el taller.
  if (order.budget) {
    (order.budget as Array<{ position: number }>).sort((a, b) => a.position - b.position);
  }

  // Igual que en la página: los nombres se resuelven aquí y la lista de
  // perfiles no se manda. Este endpoint es PÚBLICO (basta el token), así que
  // dejar dentro un nombre que el taller decidió no enseñar sería regalárselo
  // a quien pidiera el JSON.
  const o = order as unknown as {
    show_workshop_as_mechanic?: boolean;
    mechanics?: { full_name: string }[] | null;
    workshop?: { name: string } | null;
  };
  const mecanicos = nombresAsignados(o, o.workshop?.name ?? 'Taller');
  delete o.mechanics;

  return NextResponse.json({
    ...o,
    mecanicos,
    // Se conserva el campo de siempre —con el primero de la lista— para no
    // romper a quien ya consumía este JSON esperando un solo nombre.
    assigned_mechanic: mecanicos.length ? { full_name: mecanicos[0] } : null,
  });
}
