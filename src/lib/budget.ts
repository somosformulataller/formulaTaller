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
export function sumarTotal(items: Array<Pick<BudgetItem, 'amount'>>): number {
  // En centavos para no arrastrar error de coma flotante al sumar.
  const centavos = items.reduce((acc, i) => acc + Math.round(Number(i.amount || 0) * 100), 0);
  return centavos / 100;
}

/** "$1.234,50" — formato de moneda que lee un taller venezolano. */
export function formatUsd(n: number): string {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}
