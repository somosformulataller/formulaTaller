import type { Order, Profile } from '@/lib/types';

/**
 * La asignación de una orden son DOS datos, no uno:
 *   · la LISTA de mecánicos que trabajan el carro (tabla `order_mechanics`,
 *     migración 0021) — todos iguales, sin principal ni ayudante;
 *   · `show_workshop_as_mechanic` — si al CLIENTE, en su seguimiento, se le
 *     enseña el nombre del taller en vez de esos nombres (migración 0020).
 *
 * Aquí están las conversiones que hacen falta para que ninguna pantalla tenga
 * que repetir la misma lógica.
 */

// Sirve igual para una orden guardada que para el formulario a medio llenar.
type OrdenAsignada = {
  assigned_mechanic_id?: string | null;
  show_workshop_as_mechanic?: boolean | null;
  // El `id` no siempre viene: el seguimiento público pide solo los nombres,
  // porque un identificador de más en un JSON público es un dato de más.
  mechanics?: { id?: string; full_name: string }[] | null;
  mechanic_ids?: string[] | null;
};

/**
 * Los ids de los mecánicos asignados.
 *
 * Lee la lista nueva y, si no viene (una consulta vieja que solo trajo la
 * columna espejo), cae en `assigned_mechanic_id`. Así ninguna pantalla se
 * queda en blanco mientras se termina de migrar todo.
 */
export function idsAsignados(order: OrdenAsignada | null | undefined): string[] {
  if (!order) return [];
  if (order.mechanic_ids) return order.mechanic_ids.filter(Boolean);
  if (order.mechanics) return order.mechanics.map((m) => m.id).filter((id): id is string => !!id);
  return order.assigned_mechanic_id ? [order.assigned_mechanic_id] : [];
}

/**
 * Los nombres que corresponde ENSEÑAR como responsables de la orden. Se usa
 * adentro (para que el taller vea lo mismo que decidió) y en el seguimiento
 * del cliente, que es donde importa: si la orden se marcó «como el taller»,
 * sale un solo nombre, el del taller, y no el de las personas.
 */
export function nombresAsignados(
  order:
    | (OrdenAsignada & { assigned_mechanic?: { full_name: string } | null })
    | null
    | undefined,
  workshopName?: string | null
): string[] {
  if (!order) return [];

  const nombres = order.mechanics?.length
    ? order.mechanics.map((m) => m.full_name)
    : order.assigned_mechanic?.full_name
    ? [order.assigned_mechanic.full_name]
    : [];

  if (nombres.length === 0) return [];
  if (order.show_workshop_as_mechanic && workshopName) return [workshopName];
  return nombres;
}

/** Los mismos nombres en una sola línea, para listas y tarjetas apretadas. */
export function textoAsignados(
  order: Parameters<typeof nombresAsignados>[0],
  workshopName?: string | null
): string | null {
  const nombres = nombresAsignados(order, workshopName);
  return nombres.length ? nombres.join(' · ') : null;
}

/** ¿Esta persona trabaja esta orden? Es la pregunta de «¿es mía?». */
export function esMio(order: OrdenAsignada | null | undefined, userId?: string | null): boolean {
  if (!userId) return false;
  return idsAsignados(order).includes(userId);
}

/**
 * Lo que hay que mandarle a la API cuando cambia la asignación. Va junto
 * porque los dos campos se deciden en la misma pantalla y guardarlos por
 * separado dejaría la orden un instante en un estado que nadie pidió.
 */
export function cambioDeAsignacion(
  ids: string[],
  mostrarComoTaller: boolean
): { mechanic_ids: string[]; show_workshop_as_mechanic: boolean } {
  return {
    mechanic_ids: ids,
    // Sin nadie asignado no hay nombre que tapar: la bandera se apaga sola
    // para que no quede encendida y olvidada en una orden vacía.
    show_workshop_as_mechanic: ids.length > 0 && mostrarComoTaller,
  };
}

/** Atajo para las pantallas que reciben una `Order` completa. */
export function nombresDeLaOrden(order: Order, workshopName?: string | null): string[] {
  return nombresAsignados(order, order.workshop?.name ?? workshopName);
}
