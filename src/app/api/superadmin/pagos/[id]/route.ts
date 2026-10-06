import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getPlatformAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// POST /api/superadmin/pagos/[id] — { accion: 'aprobar' | 'rechazar', motivo? }
// Aprobar acredita el saldo una sola vez (aunque se pulse dos veces). Rechazar
// exige motivo, que le llega al taller; si la compra ya estaba aprobada,
// retira ese saldo. Al taller le llega el aviso a la campana.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const accion = body?.accion;
  const service = createServiceClient();

  if (accion === 'aprobar') {
    const { data, error } = await service.rpc('aprobar_recarga', {
      p_purchase: params.id,
      p_admin: admin.userId,
    });
    if (error) return NextResponse.json({ error: traducir(error.message) }, { status: 400 });
    return NextResponse.json({ ok: true, status: 'aprobado', saldo: Number(data) });
  }

  if (accion === 'rechazar') {
    const motivo = typeof body?.motivo === 'string' ? body.motivo.trim().slice(0, 300) : '';
    if (!motivo) return NextResponse.json({ error: 'Escribe el motivo del rechazo.' }, { status: 400 });
    const { error } = await service.rpc('rechazar_recarga', {
      p_purchase: params.id,
      p_note: motivo,
      p_admin: admin.userId,
    });
    if (error) return NextResponse.json({ error: traducir(error.message) }, { status: 400 });
    return NextResponse.json({ ok: true, status: 'rechazado', note: motivo });
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
}

function traducir(msg: string): string {
  if (msg.includes('SALDO_INSUFICIENTE')) {
    return 'El taller ya gastó parte de ese saldo: no se puede anular la recarga completa. Ajusta el saldo a mano.';
  }
  if (msg.includes('COMPRA_NO_EXISTE')) return 'Esa compra ya no existe.';
  return msg;
}
