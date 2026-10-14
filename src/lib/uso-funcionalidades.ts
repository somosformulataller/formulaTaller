// ============================================================================
// Cuánto usa cada taller la app (pestaña Talleres del superadmin).
// Lo puro vive aquí (lo usa también el navegador); la lectura de la base está
// en lib/superadmin-uso.ts.
// ============================================================================

/** Las funcionalidades que cuentan para el 100 %. El orden es el del flujo. */
export const FUNCIONALIDADES = [
  { clave: 'orden', texto: 'Crear órdenes' },
  { clave: 'mecanicos', texto: 'Agregar mecánicos' },
  { clave: 'asignar', texto: 'Asignar mecánico a una orden' },
  { clave: 'avances', texto: 'Marcar avances de las etapas' },
  { clave: 'fotos', texto: 'Subir fotos o archivos' },
  { clave: 'presupuesto', texto: 'Hacer presupuestos' },
  { clave: 'cliente_respondio', texto: 'El cliente respondió un presupuesto' },
  { clave: 'terminar', texto: 'Terminar órdenes (lista)' },
  { clave: 'recordatorios', texto: 'Recordatorios' },
  { clave: 'asistente', texto: 'Asistente IA' },
  { clave: 'logo', texto: 'Logo del taller' },
  { clave: 'recarga', texto: 'Comprar saldo' },
] as const;

export type ClaveFuncionalidad = (typeof FUNCIONALIDADES)[number]['clave'];

export interface UsoTaller {
  primera_orden: string | null;
  ultima_orden: string | null;
  /** Las funcionalidades que usó, en el orden de FUNCIONALIDADES. */
  usadas: ClaveFuncionalidad[];
  /** 0–100 */
  porcentaje: number;
  flujo: 'real' | 'debil';
  /** Por qué es débil (vacío si es real). */
  motivos: string[];
}

/** Un flujo real: el taller trabaja de verdad con la app, no solo la probó. */
export const FLUJO_REAL = {
  minOrdenes: 3,
  minDias: 2,
} as const;

/**
 * Flujo REAL cuando se cumplen las tres cosas:
 *  1. al menos 3 órdenes,
 *  2. creadas en al menos 2 días distintos (no todas de una sentada probando),
 *  3. alguna orden avanzó: marcó avances en las etapas o la terminó.
 * Si falta cualquiera, es DÉBIL y se dice qué falta.
 */
export function evaluarFlujo(
  ordenes: { created_at: string }[],
  usadas: Set<ClaveFuncionalidad>
): { flujo: 'real' | 'debil'; motivos: string[] } {
  const motivos: string[] = [];
  if (ordenes.length === 0) return { flujo: 'debil', motivos: ['No ha creado órdenes'] };
  if (ordenes.length < FLUJO_REAL.minOrdenes) {
    motivos.push(`Solo ${ordenes.length} ${ordenes.length === 1 ? 'orden' : 'órdenes'}`);
  }
  const dias = new Set(ordenes.map((o) => diaVenezuela(o.created_at)));
  if (dias.size < FLUJO_REAL.minDias) motivos.push('Todas las órdenes son del mismo día');
  if (!usadas.has('avances') && !usadas.has('terminar')) motivos.push('Ninguna orden avanzó ni se terminó');
  return { flujo: motivos.length ? 'debil' : 'real', motivos };
}

export function diaVenezuela(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}
