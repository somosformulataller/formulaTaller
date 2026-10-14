import { NextRequest, NextResponse } from 'next/server';
import { conciliar } from '@/lib/pagos/conciliar';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET /api/cron/pagos?key=CRON_SECRET  (o Authorization: Bearer CRON_SECRET)
// Lo llama cron-job.org cada minuto, igual que en La Mejor Llave. Si no hay
// compras pendientes termina al instante con una sola consulta.
export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET ?? '').trim();
  if (!secret) return NextResponse.json({ error: 'Falta CRON_SECRET' }, { status: 503 });
  const autorizado =
    req.headers.get('authorization') === `Bearer ${secret}` || req.nextUrl.searchParams.get('key') === secret;
  if (!autorizado) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const informe = await conciliar({ origen: 'cron' });
  return NextResponse.json(informe);
}
