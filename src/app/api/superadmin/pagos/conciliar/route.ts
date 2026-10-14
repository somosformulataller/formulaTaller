import { NextResponse } from 'next/server';
import { getPlatformAdmin } from '@/lib/api-auth';
import { conciliar } from '@/lib/pagos/conciliar';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/superadmin/pagos/conciliar — botón «Revisar el banco ahora».
export async function POST() {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json(await conciliar({ origen: 'superadmin' }));
}
