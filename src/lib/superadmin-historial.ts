import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrdenResumen } from '@/components/superadmin/VerOrdenes';

/**
 * Todas las órdenes de cada taller, de la #1 (la primera que creó) a la última,
 * para desplegarlas en Talleres. Se pagina de a 1000: el tope de PostgREST se
 * aplica solo y sin avisar.
 */
export async function historialPorTaller(service: SupabaseClient): Promise<Record<string, OrdenResumen[]>> {
  type Fila = {
    id: string;
    workshop_id: string;
    created_at: string;
    client_first_name: string | null;
    client_last_name: string | null;
    car_model: string | null;
    status: string;
  };
  const filas: Fila[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await service
      .from('orders')
      .select('id, workshop_id, created_at, client_first_name, client_last_name, car_model, status')
      .order('created_at', { ascending: true })
      .range(desde, desde + 999);
    if (error) break;
    const lote = (data ?? []) as unknown as Fila[];
    filas.push(...lote);
    if (lote.length < 1000) break;
  }

  const historial: Record<string, OrdenResumen[]> = {};
  for (const o of filas) {
    const lista = (historial[o.workshop_id] ??= []);
    lista.push({
      id: o.id,
      workshop_id: o.workshop_id,
      created_at: o.created_at,
      cliente: `${o.client_first_name ?? ''} ${o.client_last_name ?? ''}`.trim(),
      carro: (o.car_model ?? '').trim(),
      status: o.status,
      numero: lista.length + 1,
      total: 0,
    });
  }
  for (const lista of Object.values(historial)) for (const o of lista) o.total = lista.length;
  return historial;
}
