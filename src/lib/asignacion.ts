import type { Profile } from '@/lib/types';
import { COMO_TALLER } from '@/components/orders/MechanicSelect';

/**
 * La asignación de una orden son DOS datos, no uno:
 *   · `assigned_mechanic_id` — quién trabaja el carro;
 *   · `show_workshop_as_mechanic` — si al CLIENTE, en su seguimiento, se le
 *     enseña el nombre del taller en vez del de esa persona.
 *
 * En la lista de asignación eso se ve como dos entradas para el dueño (el
 * taller y él mismo), y aquí están las tres conversiones que hacen falta para
 * que las pantallas no tengan que repetir la misma lógica (migración 0020).
 */

// Sirve igual para una orden guardada que para el formulario a medio llenar,
// donde el mecánico todavía puede no existir como campo.
type OrdenAsignada = {
  assigned_mechanic_id?: string | null;
  show_workshop_as_mechanic?: boolean | null;
};

/** De la orden guardada → qué entrada de la lista hay que mostrar marcada. */
export function valorDeAsignacion(order: OrdenAsignada | null | undefined): string | null {
  if (!order) return null;
  if (order.show_workshop_as_mechanic && order.assigned_mechanic_id) return COMO_TALLER;
  return order.assigned_mechanic_id ?? null;
}

/**
 * De lo que eligió el usuario → los dos campos que hay que guardar.
 * Elegir el taller asigna la orden al dueño; si el taller no tuviera dueño en
 * la lista (no debería pasar, la entrada ni se ofrece), se deja sin asignar en
 * vez de inventar a quién dársela.
 */
export function cambioDeAsignacion(
  elegido: string | null,
  mechanics: Profile[]
): { assigned_mechanic_id: string | null; show_workshop_as_mechanic: boolean } {
  if (elegido === COMO_TALLER) {
    const dueno = mechanics.find((m) => m.role === 'admin');
    return {
      assigned_mechanic_id: dueno?.id ?? null,
      show_workshop_as_mechanic: !!dueno,
    };
  }
  return {
    assigned_mechanic_id: elegido || null,
    show_workshop_as_mechanic: false,
  };
}

/**
 * El nombre que corresponde enseñar como responsable de la orden. Se usa tanto
 * adentro (para que el taller vea lo mismo que decidió) como en el seguimiento
 * del cliente. Devuelve null cuando la orden no tiene a nadie.
 */
export function nombreDelAsignado(
  order: (OrdenAsignada & { assigned_mechanic?: { full_name: string } | null }) | null | undefined,
  workshopName?: string | null
): string | null {
  if (!order?.assigned_mechanic_id) return null;
  if (order.show_workshop_as_mechanic && workshopName) return workshopName;
  return order.assigned_mechanic?.full_name ?? null;
}
