import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getPlatformAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const MAX_AJUSTE_USD = 1000;

// POST /api/superadmin/workshops/[id]/saldo — { monto, nota }
// Ajuste manual del saldo de un taller: positivo regala o corrige a favor,
// negativo descuenta. Queda en el libro de movimientos con su nota.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const monto = Math.round(Number(String(body?.monto ?? '').replace(',', '.')) * 100) / 100;
  if (!Number.isFinite(monto) || monto === 0 || Math.abs(monto) > MAX_AJUSTE_USD) {
    return NextResponse.json(
      { error: `El ajuste debe ser distinto de 0 y de hasta $${MAX_AJUSTE_USD}.` },
      { status: 400 }
    );
  }
  const nota = typeof body?.nota === 'string' ? body.nota.trim().slice(0, 200) : '';
  if (!nota) return NextResponse.json({ error: 'Escribe el motivo del ajuste.' }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service.rpc('mover_saldo', {
    p_workshop: params.id,
    p_monto: monto,
    p_kind: 'ajuste',
    p_note: nota,
    p_user: admin.userId,
  });
  if (error) {
    const msg = error.message.includes('SALDO_INSUFICIENTE')
      ? 'El taller no tiene tanto saldo para descontar.'
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ saldo: Number(data) });
}
