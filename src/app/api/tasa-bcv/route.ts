import { NextResponse } from 'next/server';
import { fetchExchangeRateSafe } from '@/lib/tasa-bcv';

export const dynamic = 'force-dynamic';

// GET /api/tasa-bcv — tasa BCV para el modal de compra de saldo (USD → Bs).
// Si dolarapi falla, rate llega null y el modal no muestra el monto en Bs.
export async function GET() {
  const rate = await fetchExchangeRateSafe();
  return NextResponse.json({ rate: rate?.rate ?? null, fetchedAt: rate?.fetchedAt ?? null });
}
