import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Order, OrderStatus } from '@/lib/types';
import { MECHANICS_EMBED } from '@/lib/mecanicos-orden';

// ============================================================================
// Lista de órdenes del administrador, por páginas
// ============================================================================
//
// Antes el inicio y «Órdenes» traían TODAS las órdenes del taller con todas sus
// etapas: cada visita pesaba más a medida que el taller trabajaba. Ahora:
//  • solo se traen PAGINA órdenes a la vez («Ver más» pide las siguientes);
//  • sin las etapas, que la tarjeta de la lista no usa (las ve el detalle);
//  • los totales por estado salen de conteos, sin traer filas.
// Filtrar y buscar se hace en la base (API GET /api/orders), no en el teléfono.

export const PAGINA = 30;

export const LISTA_SELECT = `
  *,
  assigned_mechanic:profiles!assigned_mechanic_id(id, full_name, phone),
  ${MECHANICS_EMBED},
  workshop:workshops(name)
`;

export type FiltroEstado = 'all' | OrderStatus;
export const ESTADOS: OrderStatus[] = ['sin_mecanico', 'con_mecanico', 'lista'];

export interface Conteos {
  total: number;
  sin_mecanico: number;
  con_mecanico: number;
  lista: number;
}

export interface PaginaOrdenes {
  orders: Order[];
  hayMas: boolean;
}

type Cliente = SupabaseClient<Database>;

export function estadoValido(v: unknown): FiltroEstado {
  return ESTADOS.includes(v as OrderStatus) ? (v as OrderStatus) : 'all';
}

/**
 * Una página de órdenes del taller, más recientes primero. `q` busca cada
 * palabra en nombre, apellido, vehículo o teléfono («juan corolla» encuentra
 * el Corolla de Juan).
 */
export async function paginaOrdenes(
  supabase: Cliente,
  workshopId: string,
  { estado = 'all', q = '', desde = 0, ids }: { estado?: FiltroEstado; q?: string; desde?: number; ids?: string[] } = {}
): Promise<PaginaOrdenes> {
  let query = supabase.from('orders').select(LISTA_SELECT).eq('workshop_id', workshopId);
  if (estado !== 'all') query = query.eq('status', estado);
  if (ids) query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

  // Fuera los caracteres que tienen significado en el filtro de PostgREST.
  const palabras = q
    .replace(/[,()*%\\:"']/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
  for (const p of palabras) {
    query = query.or(
      `client_first_name.ilike.*${p}*,client_last_name.ilike.*${p}*,car_model.ilike.*${p}*,client_whatsapp.ilike.*${p}*`
    );
  }

  // Se pide una de más para saber si hay otra página sin contar aparte.
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(desde, desde + PAGINA);
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as unknown as Order[];
  return { orders: filas.slice(0, PAGINA), hayMas: filas.length > PAGINA };
}

/** Cuántas órdenes tiene el taller en total y por estado, sin traer filas. */
export async function contarOrdenes(supabase: Cliente, workshopId: string): Promise<Conteos> {
  const contar = (estado?: OrderStatus) => {
    let q = supabase.from('orders').select('id', { count: 'exact', head: true }).eq('workshop_id', workshopId);
    if (estado) q = q.eq('status', estado);
    return q.then((r) => r.count ?? 0);
  };
  const [total, sin_mecanico, con_mecanico, lista] = await Promise.all([
    contar(),
    contar('sin_mecanico'),
    contar('con_mecanico'),
    contar('lista'),
  ]);
  return { total, sin_mecanico, con_mecanico, lista };
}
