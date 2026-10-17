import type { createServiceClient } from '@/lib/supabase/server';
import { CITA_SELECT, normalizarCita } from '@/lib/presupuestos-servidor';
import type { Cita, DecisionQuote, QuoteItem } from '@/lib/presupuestos';

// ============================================================================
// El presupuesto en el enlace público del cliente (0030). Solo sale de aquí lo
// que el cliente necesita ver: nada del taller más allá de su nombre y logo.
// ============================================================================

type Service = ReturnType<typeof createServiceClient>;

export interface CitaPublica {
  day: string;
  at_time: string | null;
  status: Cita['status'];
  chosen_by_client: boolean;
}

export interface PresupuestoPublico {
  token: string;
  client_first_name: string;
  client_last_name: string;
  car_model: string;
  items: QuoteItem[];
  labor_general_usd: number;
  client_picks_date: boolean;
  client_decision: DecisionQuote;
  created_at: string;
  cita: CitaPublica | null;
  workshop: { name: string; logo_url: string | null };
  /** Ya pasó a una orden: el enlace del seguimiento de esa orden. */
  orderToken: string | null;
}

/** Lo que el servidor necesita además (no se manda al navegador). */
export interface PresupuestoInterno {
  id: string;
  workshop_id: string;
  client_id: string | null;
  order_id: string | null;
  citaId: string | null;
}

export async function leerPresupuestoPublico(
  service: Service,
  token: string
): Promise<{ publico: PresupuestoPublico; interno: PresupuestoInterno } | null> {
  // Un token que no es uuid haría fallar la consulta: se descarta antes.
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data } = await service
    .from('quotes')
    .select(
      'id, workshop_id, client_id, order_id, public_token, client_first_name, client_last_name, car_model, items, labor_general_usd, client_picks_date, client_decision, created_at, workshop:workshops(name, logo_url), order:orders(public_token)'
    )
    .eq('public_token', token)
    .maybeSingle();
  if (!data) return null;
  const q = data as unknown as {
    id: string;
    workshop_id: string;
    client_id: string | null;
    order_id: string | null;
    public_token: string;
    client_first_name: string;
    client_last_name: string;
    car_model: string;
    items: QuoteItem[];
    labor_general_usd: number;
    client_picks_date: boolean;
    client_decision: DecisionQuote;
    created_at: string;
    workshop: { name: string; logo_url: string | null } | null;
    order: { public_token: string } | null;
  };

  const { data: c } = await service
    .from('appointments')
    .select(CITA_SELECT)
    .eq('quote_id', q.id)
    .eq('kind', 'cita')
    .maybeSingle();
  const cita = c ? normalizarCita(c as unknown as Cita) : null;

  return {
    publico: {
      token: q.public_token,
      client_first_name: q.client_first_name,
      client_last_name: q.client_last_name,
      car_model: q.car_model,
      items: (q.items ?? []).map((i) => ({
        description: i.description,
        amount: Number(i.amount) || 0,
        labor_amount: Number(i.labor_amount) || 0,
      })),
      labor_general_usd: Number(q.labor_general_usd) || 0,
      client_picks_date: q.client_picks_date,
      client_decision: q.client_decision,
      created_at: q.created_at,
      cita: cita
        ? { day: cita.day, at_time: cita.at_time, status: cita.status, chosen_by_client: cita.chosen_by_client }
        : null,
      workshop: { name: q.workshop?.name ?? 'Taller', logo_url: q.workshop?.logo_url ?? null },
      orderToken: q.order?.public_token ?? null,
    },
    interno: {
      id: q.id,
      workshop_id: q.workshop_id,
      client_id: q.client_id,
      order_id: q.order_id,
      citaId: cita?.id ?? null,
    },
  };
}

/** Horas (HH:MM) que el taller marcó ocupadas ese día; `todo` = el día entero. */
export async function ocupadoDelDia(
  service: Service,
  workshopId: string,
  day: string
): Promise<{ todo: boolean; horas: string[] }> {
  const { data } = await service
    .from('appointments')
    .select('at_time')
    .eq('workshop_id', workshopId)
    .eq('kind', 'ocupado')
    .eq('day', day);
  const filas = (data ?? []) as unknown as Array<{ at_time: string | null }>;
  return {
    todo: filas.some((f) => f.at_time === null),
    horas: filas.filter((f) => f.at_time).map((f) => `${(f.at_time as string).slice(0, 2)}:00`),
  };
}
