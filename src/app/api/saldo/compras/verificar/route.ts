import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { soloAdmin } from '@/lib/admin-taller';
import { conciliar } from '@/lib/pagos/conciliar';

export const dynamic = 'force-dynamic';
// Puede tocar entrar al banco (20–45 s).
export const maxDuration = 60;

// POST /api/saldo/compras/verificar
// La pantalla del taller lo llama cada pocos segundos mientras su pago está en
// revisión: busca el pago en el banco y, si cuadra, lo acredita al momento.
// Solo mira las compras de ESTE taller.
export async function POST() {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;

  await conciliar({ origen: 'taller', taller: caller.workshopId });

  const service = createServiceClient();
  const [{ data: compra }, { data: ws }] = await Promise.all([
    service
      .from('balance_purchases')
      .select('id, amount_usd, amount_ves, credited_usd, status, note, revision, created_at, reviewed_at')
      .eq('workshop_id', caller.workshopId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    service.from('workshops').select('balance_usd').eq('id', caller.workshopId).single(),
  ]);
  const c = compra as unknown as Record<string, unknown> | null;

  return NextResponse.json({
    compra: c
      ? {
          id: c.id,
          amount_usd: c.amount_usd,
          amount_ves: c.amount_ves,
          credited_usd: c.credited_usd,
          status: c.status,
          note: c.status === 'rechazado' ? c.note : null,
          // Al taller solo le importa si ya pasó a manos de una persona.
          en_revision_manual: c.status === 'pendiente' && c.revision !== null,
          created_at: c.created_at,
        }
      : null,
    saldo: Number((ws as unknown as { balance_usd: number } | null)?.balance_usd ?? 0),
  });
}
