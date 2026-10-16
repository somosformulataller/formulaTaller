import type { createServiceClient } from '@/lib/supabase/server';
import { parseAmount } from '@/lib/budget';
import { waNumber } from '@/lib/whatsapp';
import { estaOcupado, type Cita, type Quote, type QuoteItem } from '@/lib/presupuestos';

// ============================================================================
// Presupuestos sueltos y citas (0028) — lo que usan las API del servidor.
// ============================================================================

type Service = ReturnType<typeof createServiceClient>;

const MAX_DESC = 120;
const MAX_AMOUNT = 1_000_000;
const MAX_NOTA = 500;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export const CITA_SELECT = '*, client:clients(first_name, last_name, whatsapp)';
export const QUOTE_SELECT = '*';

export interface DatosPresupuesto {
  client_first_name: string;
  client_last_name: string;
  client_whatsapp: string;
  car_model: string;
  items: QuoteItem[];
  labor_general_usd: number;
}

export interface DatosCita {
  day: string;
  at_time: string | null;
}

/** Valida lo que llega del formulario «Enviar presupuesto». */
export function limpiarPresupuesto(
  body: Record<string, unknown>
): { datos: DatosPresupuesto; cita: DatosCita | null; error?: never } | { error: string } {
  const texto = (k: string, max = 80) => String(body[k] ?? '').trim().slice(0, max);
  const client_first_name = texto('client_first_name');
  const client_last_name = texto('client_last_name');
  const client_whatsapp = texto('client_whatsapp', 32);
  const car_model = texto('car_model', 120);
  if (!client_first_name) return { error: 'Escribe el nombre del cliente.' };
  const digitos = waNumber(client_whatsapp);
  if (!digitos || digitos.length < 10) return { error: 'Escribe el WhatsApp del cliente.' };

  const crudos = Array.isArray(body.items) ? body.items : [];
  if (crudos.length > 100) return { error: 'Demasiados ítems.' };
  const items: QuoteItem[] = [];
  for (const it of crudos as Array<Record<string, unknown>>) {
    const description = String(it?.description ?? '').trim().slice(0, MAX_DESC);
    if (!description) continue;
    const amount = parseAmount((it?.amount as string | number | null) ?? 0);
    const labor_amount = parseAmount((it?.labor_amount as string | number | null) ?? 0);
    if (amount === null || labor_amount === null) return { error: `El precio de «${description}» no es válido.` };
    if (amount > MAX_AMOUNT || labor_amount > MAX_AMOUNT) return { error: `El precio de «${description}» es demasiado alto.` };
    items.push({ description, amount, labor_amount });
  }
  const crudoMano = body.labor_general_usd;
  const labor_general_usd =
    crudoMano === '' || crudoMano === null || crudoMano === undefined ? 0 : parseAmount(crudoMano as string | number);
  if (labor_general_usd === null || labor_general_usd > MAX_AMOUNT) return { error: 'Mano de obra general inválida.' };

  let cita: DatosCita | null = null;
  const c = body.cita as { day?: unknown; at_time?: unknown } | null | undefined;
  if (c && c.day) {
    const day = String(c.day);
    const at_time = c.at_time ? String(c.at_time).slice(0, 5) : null;
    if (!FECHA.test(day)) return { error: 'Fecha de la cita inválida.' };
    if (at_time && !HORA.test(at_time)) return { error: 'Hora de la cita inválida.' };
    cita = { day, at_time };
  }

  return {
    datos: { client_first_name, client_last_name, client_whatsapp, car_model, items, labor_general_usd },
    cita,
  };
}

/** Valida una cita u horario ocupado creado desde el calendario. */
export function limpiarCita(
  body: Record<string, unknown>
):
  | { datos: { kind: 'cita' | 'ocupado'; client_id: string | null; day: string; at_time: string | null; note: string | null }; error?: never }
  | { error: string } {
  const kind = body.kind === 'ocupado' ? 'ocupado' : 'cita';
  const day = String(body.day ?? '');
  const at_time = body.at_time ? String(body.at_time).slice(0, 5) : null;
  const note = String(body.note ?? '').trim().slice(0, MAX_NOTA) || null;
  const client_id = body.client_id ? String(body.client_id) : null;
  if (!FECHA.test(day)) return { error: 'Elige el día.' };
  if (at_time && !HORA.test(at_time)) return { error: 'Hora inválida.' };
  if (kind === 'cita' && !client_id) return { error: 'Elige el cliente de la cita.' };
  return { datos: { kind, client_id, day, at_time, note } };
}

/** El cliente con ese WhatsApp en el taller; se crea si no existe (como hace el trigger de las órdenes). */
export async function clienteDe(service: Service, workshopId: string, d: DatosPresupuesto): Promise<string | null> {
  const whatsapp = waNumber(d.client_whatsapp);
  if (!whatsapp) return null;
  const { data, error } = await service
    .from('clients')
    .upsert(
      { workshop_id: workshopId, first_name: d.client_first_name, last_name: d.client_last_name, whatsapp },
      { onConflict: 'workshop_id,whatsapp' }
    )
    .select('id')
    .single();
  if (error) {
    console.error('[presupuestos] cliente', error.message);
    return null;
  }
  return (data as unknown as { id: string }).id;
}

/** Las citas y horarios ocupados de un día del taller. */
export async function citasDelDia(service: Service, workshopId: string, day: string): Promise<Cita[]> {
  const { data } = await service.from('appointments').select('*').eq('workshop_id', workshopId).eq('day', day);
  return (data ?? []) as unknown as Cita[];
}

/**
 * Deja la cita del presupuesto como se pidió: la anterior se borra y, si hay
 * día, se crea la nueva. Falla si el taller marcó ocupado ese día u hora.
 */
export async function guardarCitaDePresupuesto(
  service: Service,
  opts: { workshopId: string; quoteId: string; clientId: string | null; userId: string; cita: DatosCita | null }
): Promise<{ cita: Cita | null; error?: string }> {
  if (opts.cita) {
    const delDia = await citasDelDia(service, opts.workshopId, opts.cita.day);
    if (estaOcupado(delDia, opts.cita.day, opts.cita.at_time)) {
      return { cita: null, error: 'El taller marcó ocupado ese día u hora. Elige otro.' };
    }
  }
  await service.from('appointments').delete().eq('quote_id', opts.quoteId).eq('kind', 'cita');
  if (!opts.cita || !opts.clientId) return { cita: null };
  const { data, error } = await service
    .from('appointments')
    .insert({
      workshop_id: opts.workshopId,
      kind: 'cita',
      client_id: opts.clientId,
      quote_id: opts.quoteId,
      day: opts.cita.day,
      at_time: opts.cita.at_time,
      created_by: opts.userId,
    })
    .select(CITA_SELECT)
    .single();
  if (error) return { cita: null, error: error.message };
  return { cita: normalizarCita(data as unknown as Cita) };
}

/** `time` llega como «09:00:00»: se deja en «09:00». */
export function normalizarCita(c: Cita): Cita {
  return { ...c, at_time: c.at_time ? c.at_time.slice(0, 5) : null };
}

/** Presupuestos con su cita (una por presupuesto). */
export async function conCitas(service: Service, quotes: Quote[]): Promise<Quote[]> {
  if (quotes.length === 0) return quotes;
  const { data } = await service
    .from('appointments')
    .select(CITA_SELECT)
    .in('quote_id', quotes.map((q) => q.id))
    .eq('kind', 'cita');
  const porQuote = new Map<string, Cita>();
  for (const c of (data ?? []) as unknown as Cita[]) if (c.quote_id) porQuote.set(c.quote_id, normalizarCita(c));
  return quotes.map((q) => ({
    ...q,
    labor_general_usd: Number(q.labor_general_usd) || 0,
    cita: porQuote.get(q.id) ?? null,
  }));
}

/**
 * Pasa el presupuesto a la orden: copia los ítems al final de los que ya
 * tenga, suma la mano de obra general y lo marca vinculado. La cita queda
 * también con la orden.
 */
export async function vincularAOrden(
  service: Service,
  opts: { quote: Quote; orderId: string; userId: string; copiarItems: boolean }
): Promise<string | null> {
  const { quote, orderId } = opts;
  if (opts.copiarItems) {
    if (quote.items.length > 0) {
      const { data: ultima } = await service
        .from('order_budget_items')
        .select('position')
        .eq('order_id', orderId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();
      const desde = ((ultima as unknown as { position: number } | null)?.position ?? 0) + 1;
      const { error } = await service.from('order_budget_items').insert(
        quote.items.map((it, i) => ({
          order_id: orderId,
          description: it.description,
          amount: it.amount,
          labor_amount: it.labor_amount,
          position: desde + i,
          created_by: opts.userId,
        }))
      );
      if (error) return error.message;
    }
    const general = Number(quote.labor_general_usd) || 0;
    if (general > 0) {
      const { data: o } = await service.from('orders').select('labor_general_usd').eq('id', orderId).single();
      const antes = Number((o as unknown as { labor_general_usd: number | null } | null)?.labor_general_usd ?? 0);
      const { error } = await service
        .from('orders')
        .update({ labor_general_usd: (Math.round(antes * 100) + Math.round(general * 100)) / 100 })
        .eq('id', orderId);
      if (error) return error.message;
    }
  }
  const { error } = await service
    .from('quotes')
    .update({ order_id: orderId, linked_at: new Date().toISOString() })
    .eq('id', quote.id);
  if (error) return error.message;
  await service.from('appointments').update({ order_id: orderId }).eq('quote_id', quote.id);
  return null;
}
