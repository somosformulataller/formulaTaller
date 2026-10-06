import { NextResponse } from 'next/server';
import { getPlatformAdmin } from '@/lib/api-auth';
import { fetchExchangeRateSafe } from '@/lib/tasa-bcv';

export const dynamic = 'force-dynamic';

// GET /api/superadmin/tasa-bcv — la misma tasa de /api/tasa-bcv para la
// pantalla Pagos. Va aparte porque el superadmin no tiene perfil de taller
// y el middleware lo mandaría al login.
export async function GET() {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const rate = await fetchExchangeRateSafe();
  return NextResponse.json({ rate: rate?.rate ?? null, fetchedAt: rate?.fetchedAt ?? null });
}
