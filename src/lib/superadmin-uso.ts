import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrdenResumen } from '@/components/superadmin/VerOrdenes';
import { evaluarFlujo, FUNCIONALIDADES, type ClaveFuncionalidad, type UsoTaller } from '@/lib/uso-funcionalidades';

/**
 * Trae TODAS las filas de una consulta, de 1000 en 1000: el tope de PostgREST
 * se aplica solo y sin avisar, y un taller que quedara fuera parecería no
 * haber usado algo que sí usó. Ante un error devuelve lo que llevaba.
 */
async function todas<T>(consulta: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta(desde, desde + 999);
    if (error) break;
    const lote = (data ?? []) as T[];
    filas.push(...lote);
    if (lote.length < 1000) break;
  }
  return filas;
}

/**
 * Uso de la app por taller: primera y última orden, qué funcionalidades usó
 * (de FUNCIONALIDADES) y si sigue un flujo real o débil.
 * `historial` ya trae las órdenes de cada taller ordenadas de la primera a la
 * última (lib/superadmin-historial.ts).
 */
export async function usoPorTaller(
  service: SupabaseClient,
  historial: Record<string, OrdenResumen[]>,
  talleres: { id: string; mechanic_count: number; has_logo: boolean }[]
): Promise<Record<string, UsoTaller>> {
  // De qué taller es cada orden (para las tablas que solo traen order_id).
  const tallerDeOrden = new Map<string, string>();
  for (const [taller, ordenes] of Object.entries(historial)) for (const o of ordenes) tallerDeOrden.set(o.id, taller);

  const [asignaciones, avances, fotos, presupuestos, decisiones, recordatorios, preguntas, recargas] = await Promise.all([
    todas<{ order_id: string }>((a, b) => service.from('order_mechanics').select('order_id').range(a, b)),
    todas<{ order_id: string }>((a, b) => service.from('order_stages').select('order_id').neq('status', 'pending').range(a, b)),
    todas<{ order_id: string }>((a, b) => service.from('stage_attachments').select('order_id').range(a, b)),
    todas<{ order_id: string }>((a, b) => service.from('order_budget_items').select('order_id').range(a, b)),
    todas<{ order_id: string }>((a, b) => service.from('budget_decisions').select('order_id').range(a, b)),
    todas<{ workshop_id: string }>((a, b) => service.from('reminders').select('workshop_id').range(a, b)),
    todas<{ workshop_id: string }>((a, b) =>
      service.from('balance_movements').select('workshop_id').eq('kind', 'pregunta_ia').range(a, b)
    ),
    todas<{ workshop_id: string }>((a, b) =>
      service.from('balance_purchases').select('workshop_id').eq('status', 'aprobado').range(a, b)
    ),
  ]);

  const usadas = new Map<string, Set<ClaveFuncionalidad>>();
  const marcar = (taller: string | undefined, clave: ClaveFuncionalidad) => {
    if (!taller) return;
    let s = usadas.get(taller);
    if (!s) usadas.set(taller, (s = new Set()));
    s.add(clave);
  };
  const porOrden = (filas: { order_id: string }[], clave: ClaveFuncionalidad) => {
    for (const f of filas) marcar(tallerDeOrden.get(f.order_id), clave);
  };
  porOrden(asignaciones, 'asignar');
  porOrden(avances, 'avances');
  porOrden(fotos, 'fotos');
  porOrden(presupuestos, 'presupuesto');
  porOrden(decisiones, 'cliente_respondio');
  for (const f of recordatorios) marcar(f.workshop_id, 'recordatorios');
  for (const f of preguntas) marcar(f.workshop_id, 'asistente');
  for (const f of recargas) marcar(f.workshop_id, 'recarga');
  for (const [taller, ordenes] of Object.entries(historial)) {
    if (ordenes.length) marcar(taller, 'orden');
    if (ordenes.some((o) => o.status === 'lista')) marcar(taller, 'terminar');
  }
  for (const t of talleres) {
    if (t.mechanic_count > 0) marcar(t.id, 'mecanicos');
    if (t.has_logo) marcar(t.id, 'logo');
  }

  const uso: Record<string, UsoTaller> = {};
  for (const t of talleres) {
    const ordenes = historial[t.id] ?? [];
    const set = usadas.get(t.id) ?? new Set<ClaveFuncionalidad>();
    const lista = FUNCIONALIDADES.map((f) => f.clave).filter((c) => set.has(c));
    uso[t.id] = {
      primera_orden: ordenes[0]?.created_at ?? null,
      ultima_orden: ordenes[ordenes.length - 1]?.created_at ?? null,
      usadas: lista,
      porcentaje: Math.round((lista.length / FUNCIONALIDADES.length) * 100),
      ...evaluarFlujo(ordenes, set),
    };
  }
  return uso;
}
