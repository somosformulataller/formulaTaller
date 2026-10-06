import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { soloAdmin } from '@/lib/admin-taller';
import { leerPrecios } from '@/lib/saldo';

export const dynamic = 'force-dynamic';

// GET /api/saldo — saldo del taller, precios, datos de Pago Móvil y el
// historial de compras y movimientos.
// ?solo=saldo devuelve solo el saldo (para refrescar el contador de arriba).
export async function GET(req: Request) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;
  const service = createServiceClient();
  const solo = new URL(req.url).searchParams.get('solo');

  const { data: ws } = await service
    .from('workshops')
    .select('balance_usd')
    .eq('id', caller.workshopId)
    .single();
  const saldo = Number((ws as unknown as { balance_usd: number } | null)?.balance_usd ?? 0);
  if (solo === 'saldo') return NextResponse.json({ saldo });

  const [precios, ajustes, compras, movimientos] = await Promise.all([
    leerPrecios(service),
    service
      .from('platform_settings')
      .select('pago_movil_bank, pago_movil_phone, pago_movil_document, pago_movil_holder')
      .eq('id', 1)
      .maybeSingle(),
    service
      .from('balance_purchases')
      .select('id, amount_usd, amount_ves, exchange_rate, reference, status, note, created_at, reviewed_at')
      .eq('workshop_id', caller.workshopId)
      .order('created_at', { ascending: false })
      .limit(20),
    service
      .from('balance_movements')
      .select('id, kind, amount_usd, balance_after, note, created_at')
      .eq('workshop_id', caller.workshopId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const a = ajustes.data as unknown as {
    pago_movil_bank: string | null;
    pago_movil_phone: string | null;
    pago_movil_document: string | null;
    pago_movil_holder: string | null;
  } | null;

  return NextResponse.json({
    saldo,
    precios,
    pagoMovil: {
      bank: a?.pago_movil_bank ?? null,
      phone: a?.pago_movil_phone ?? null,
      document: a?.pago_movil_document ?? null,
      holder: a?.pago_movil_holder ?? null,
    },
    compras: compras.data ?? [],
    movimientos: movimientos.data ?? [],
  });
}
