import type { BudgetItem } from '@/lib/types';

// ============================================================================
// Presupuesto — helpers compartidos (servidor y navegador)
// ============================================================================

/**
 * Normaliza lo que escribe el usuario en el campo de precio.
 *
 * Acepta coma o punto como decimal, porque en Venezuela se teclean las dos
 * ("12,50" y "12.50"), e ignora símbolos y espacios ("$ 12,50"). Devuelve
 * null si no hay un número válido o si es negativo, para que quien llame
 * decida qué hacer en vez de guardar un NaN.
 */
export function parseAmount(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? redondear(raw) : null;
  }
  const limpio = raw.replace(/[^0-9.,-]/g, '').replace(',', '.');
  if (limpio === '' || limpio === '.' || limpio === '-') return null;
  const n = Number(limpio);
  if (!Number.isFinite(n) || n < 0) return null;
  return redondear(n);
}

/** Dos decimales exactos. Evita los 12.340000000000001 de coma flotante. */
function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Suma los ítems. Se hace SIEMPRE así, nunca guardando un total en la base:
 * un total guardado se desfasa del detalle en cuanto alguien edita un ítem
 * desde otra pestaña.
 */
export function sumarTotal(
  items: Array<Pick<BudgetItem, 'amount'> & { labor_amount?: number | null }>
): number {
  // En centavos para no arrastrar error de coma flotante al sumar.
  const centavos = items.reduce((acc, i) => acc + centavosDe(i.amount) + centavosDe(i.labor_amount), 0);
  return centavos / 100;
}

/** Solo repuestos o servicios (la columna `amount`). */
export function sumarRepuestos(items: Array<Pick<BudgetItem, 'amount'>>): number {
  return items.reduce((acc, i) => acc + centavosDe(i.amount), 0) / 100;
}

/** Solo mano de obra (0023). */
export function sumarManoDeObra(items: Array<{ labor_amount?: number | null }>): number {
  return items.reduce((acc, i) => acc + centavosDe(i.labor_amount), 0) / 100;
}

/** Repuesto + mano de obra de un ítem. */
export function subtotalItem(i: { amount: number | null; labor_amount?: number | null }): number {
  return (centavosDe(i.amount) + centavosDe(i.labor_amount)) / 100;
}

function centavosDe(n: number | string | null | undefined): number {
  const v = Number(n || 0);
  return Number.isFinite(v) ? Math.round(v * 100) : 0;
}

export const DECISION_LABELS: Record<'pendiente' | 'aprobado' | 'rechazado', string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

export const DECISION_COLORS: Record<'pendiente' | 'aprobado' | 'rechazado', string> = {
  pendiente: 'var(--color-text-muted)',
  aprobado: '#34d399',
  rechazado: '#f87171',
};

/** "$1.234,50" — formato de moneda que lee un taller venezolano. */
/** Como formatUsd, pero con hasta 3 decimales: para precios como $0,035. */
export function formatPrecioUsd(n: number): string {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

/**
 * Mensaje de WhatsApp con el presupuesto para el cliente: cada ítem con su
 * subtotal (repuesto o servicio + mano de obra), el total y el enlace de
 * seguimiento, donde puede aprobar o rechazar cada uno.
 */
export function buildBudgetMessage(
  clientFirstName: string,
  carModel: string,
  items: Array<{ description: string; amount: number; labor: number }>,
  token: string,
  siteUrl: string,
  workshopName?: string
): string {
  const lineas = items.map((i) => `• ${i.description || 'Servicio'}: ${formatUsd(i.amount + i.labor)}`);
  const total = items.reduce((acc, i) => acc + Math.round((i.amount + i.labor) * 100), 0) / 100;
  const encabezado = `Hola ${clientFirstName}! Este es el presupuesto de tu ${carModel}${workshopName ? ` en ${workshopName}` : ''}:`;
  return [
    encabezado,
    lineas.join('\n'),
    `Total: ${formatUsd(total)}`,
    `Puedes aprobar o rechazar cada servicio aquí:\n${siteUrl}/tracking/${token}`,
  ].join('\n\n');
}
