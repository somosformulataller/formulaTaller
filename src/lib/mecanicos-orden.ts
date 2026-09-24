/**
 * La asignación de mecánicos vista desde el servidor (tabla `order_mechanics`,
 * migración 0021). Todo lo que toca esa tabla pasa por aquí, para que la regla
 * —varios mecánicos, todos iguales, asigna solo el administrador— se escriba
 * una sola vez.
 */

// El cliente de servicio viene sin tipar (ver createServiceClient).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Service = any;

/**
 * Trozo de `select` que trae los mecánicos de la orden. PostgREST reconoce
 * `order_mechanics` como tabla puente (sus dos claves foráneas son su clave
 * primaria) y devuelve los perfiles directamente, sin el nivel intermedio.
 */
export const MECHANICS_EMBED = 'mechanics:profiles!order_mechanics(id, full_name, phone)';

// PostgREST devuelve 1.000 filas como máximo por consulta y no avisa cuando
// corta: hay que pedirlas por tramos hasta que venga uno incompleto.
const TRAMO = 1000;

/**
 * Los ids de las órdenes asignadas a esta persona. Es la respuesta a «¿cuáles
 * son mis órdenes?» y sustituye al viejo `.eq('assigned_mechanic_id', …)`, que
 * desde la 0021 solo veía al primero de la lista.
 */
export async function idsDeMisOrdenes(service: Service, userId: string): Promise<string[]> {
  const ids: string[] = [];
  for (let desde = 0; ; desde += TRAMO) {
    const { data, error } = await service
      .from('order_mechanics')
      .select('order_id')
      .eq('mechanic_id', userId)
      .range(desde, desde + TRAMO - 1);
    if (error) throw new Error(error.message);
    const filas = (data ?? []) as { order_id: string }[];
    ids.push(...filas.map((f) => f.order_id));
    if (filas.length < TRAMO) break;
  }
  return ids;
}

/** Los ids de los mecánicos que hoy tiene la orden. */
export async function mecanicosDeLaOrden(service: Service, orderId: string): Promise<string[]> {
  const { data, error } = await service
    .from('order_mechanics')
    .select('mechanic_id')
    .eq('order_id', orderId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { mechanic_id: string }[]).map((f) => f.mechanic_id);
}

/**
 * Deja la orden con EXACTAMENTE estos mecánicos: agrega los que faltan y quita
 * los que sobran. No borra y vuelve a insertar todo, porque `created_at` marca
 * el orden de la lista (y con él, a quién apunta la columna espejo).
 *
 * Solo acepta gente del mismo taller que la orden: un id de otro taller sería
 * una fuga silenciosa —el nombre de un desconocido apareciendo en el
 * seguimiento de un cliente ajeno—, así que se rechaza la operación entera en
 * vez de guardar a medias.
 *
 * Devuelve un mensaje de error para el usuario, o null si todo salió bien.
 */
export async function guardarMecanicos(
  service: Service,
  orderId: string,
  workshopId: string,
  idsPedidos: string[]
): Promise<string | null> {
  const deseados = [...new Set(idsPedidos.filter(Boolean))];

  if (deseados.length > 0) {
    const { data, error } = await service
      .from('profiles')
      .select('id')
      .eq('workshop_id', workshopId)
      .in('id', deseados);
    if (error) return error.message;
    const validos = new Set(((data ?? []) as { id: string }[]).map((p) => p.id));
    if (deseados.some((id) => !validos.has(id))) {
      return 'Solo puedes asignar mecánicos de tu propio taller.';
    }
  }

  let actuales: string[];
  try {
    actuales = await mecanicosDeLaOrden(service, orderId);
  } catch (e) {
    return e instanceof Error ? e.message : 'No se pudo leer la asignación actual.';
  }

  const aQuitar = actuales.filter((id) => !deseados.includes(id));
  const aPoner = deseados.filter((id) => !actuales.includes(id));

  // Primero se agrega y después se quita: si la orden cambia de manos por
  // completo, así no queda ni un instante sin nadie (el trigger que mantiene
  // el estado la habría devuelto a «sin mecánico» y de vuelta).
  if (aPoner.length > 0) {
    const { error } = await service
      .from('order_mechanics')
      .insert(aPoner.map((mechanic_id) => ({ order_id: orderId, mechanic_id })));
    if (error) return error.message;
  }
  if (aQuitar.length > 0) {
    const { error } = await service
      .from('order_mechanics')
      .delete()
      .eq('order_id', orderId)
      .in('mechanic_id', aQuitar);
    if (error) return error.message;
  }

  return null;
}
