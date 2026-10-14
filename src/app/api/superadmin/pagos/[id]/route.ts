import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getPlatformAdmin } from '@/lib/api-auth';
import { cola6, conciliar, reclamarPagoManual } from '@/lib/pagos/conciliar';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Aprobar a mano espera como mucho esto a que el banco marque el pago como
// usado. Si tarda más se aprueba igual: el equipo no se queda mirando un botón.
const RECLAMO_TIMEOUT_MS = 8_000;

const TRAZA_RECLAMO: Record<string, string> = {
  ninguno: '🏦 El pago no aparece libre en el estado de cuenta: no se marcó como usado.',
  varios: '🏦 Hay varios pagos sin usar con esa referencia: no se marcó ninguno.',
  fallo: '🏦 El banco no aceptó marcar el pago como usado.',
  corte: '🏦 El banco tardó demasiado en marcar el pago como usado.',
};

// POST /api/superadmin/pagos/[id]
//  { accion: 'aprobar', monto? }           acredita (monto en USD; por defecto lo elegido)
//                                          y marca el pago como usado en el banco
//  { accion: 'rechazar', motivo }          el motivo le llega al taller
//  { accion: 'revalidar' }                 vuelve a buscarlo en el banco ahora
//  { accion: 'editar_referencia', referencia }  corrige un dígito mal escrito
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const accion = body?.accion;
  const service = createServiceClient();

  const { data: compra } = await service
    .from('balance_purchases')
    .select('id, status, reference, created_at, amount_usd, amount_ves, bank_note')
    .eq('id', params.id)
    .maybeSingle();
  const c = compra as unknown as {
    id: string;
    status: string;
    reference: string;
    created_at: string;
    amount_usd: number;
    amount_ves: number | null;
    bank_note: string | null;
  } | null;
  if (!c) return NextResponse.json({ error: 'Esa compra ya no existe.' }, { status: 404 });

  if (accion === 'aprobar') {
    let monto: number | null = null;
    if (body?.monto !== undefined && body?.monto !== null && body?.monto !== '') {
      monto = Math.round(Number(String(body.monto).replace(',', '.')) * 100) / 100;
      if (!Number.isFinite(monto) || monto <= 0 || monto > 1000) {
        return NextResponse.json({ error: 'El monto a acreditar debe estar entre $0,01 y $1000.' }, { status: 400 });
      }
    }

    // Marcar el pago como usado en el banco, para que ni esta app ni La Mejor
    // Llave lo vuelvan a tomar. Nunca bloquea la aprobación.
    let traza: string | null = null;
    let banco: Record<string, unknown> | null = null;
    if (c.status === 'pendiente') {
      const r = await Promise.race([
        reclamarPagoManual(c).catch(() => ({ estado: 'fallo' as const })),
        new Promise<{ estado: 'corte' }>((ok) => setTimeout(() => ok({ estado: 'corte' }), RECLAMO_TIMEOUT_MS)),
      ]);
      if (r.estado === 'reclamado') banco = r.movimiento as unknown as Record<string, unknown>;
      else traza = TRAZA_RECLAMO[r.estado] ?? null;
    }

    const { data, error } = await service.rpc('aprobar_recarga', {
      p_purchase: params.id,
      p_admin: admin.userId,
      p_monto: monto,
      p_origen: 'manual',
      p_bank: banco,
    });
    if (error) return NextResponse.json({ error: traducir(error.message) }, { status: 400 });
    if (traza) {
      await service
        .from('balance_purchases')
        .update({ bank_note: c.bank_note ? `${c.bank_note} ${traza}` : traza })
        .eq('id', params.id);
    }
    return NextResponse.json({ ok: true, status: 'aprobado', saldo: Number(data), aviso: traza });
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

  if (accion === 'revalidar') {
    if (c.status !== 'pendiente') return NextResponse.json({ error: 'Solo se revalidan las pendientes.' }, { status: 400 });
    const informe = await conciliar({ origen: 'superadmin', compra: params.id });
    return NextResponse.json({ ok: true, informe });
  }

  if (accion === 'editar_referencia') {
    if (c.status !== 'pendiente') return NextResponse.json({ error: 'Solo se corrigen las pendientes.' }, { status: 400 });
    const referencia = String(body?.referencia ?? '').replace(/\D/g, '').slice(0, 30);
    if (referencia.length < 6) return NextResponse.json({ error: 'La referencia debe tener al menos 6 dígitos.' }, { status: 400 });
    const { data: otras } = await service
      .from('balance_purchases')
      .select('id')
      .eq('reference_tail', cola6(referencia))
      .neq('status', 'rechazado')
      .neq('id', params.id)
      .limit(1);
    const repetida = (otras ?? []).length > 0;
    const traza = `✏️ Referencia corregida: ${c.reference} → ${referencia}.`;
    const { error } = await service
      .from('balance_purchases')
      .update({
        reference: referencia,
        revision: repetida ? 'referencia_repetida' : null,
        bank_note: repetida ? `${traza} Ya hay otra compra con esos 6 dígitos.` : traza,
        note: repetida ? '⚠ Referencia repetida: ya hay otro pago con esos 6 dígitos.' : null,
      })
      .eq('id', params.id)
      .eq('status', 'pendiente');
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    // Con la referencia buena se busca de nuevo al momento.
    const informe = repetida ? null : await conciliar({ origen: 'superadmin', compra: params.id });
    return NextResponse.json({ ok: true, informe });
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
}

function traducir(msg: string): string {
  if (msg.includes('SALDO_INSUFICIENTE')) {
    return 'El taller ya gastó parte de ese saldo: no se puede anular la recarga completa. Ajusta el saldo a mano.';
  }
  if (msg.includes('COMPRA_NO_EXISTE')) return 'Esa compra ya no existe.';
  if (msg.includes('balance_purchases_bank_tx_unico')) {
    return 'Ese pago del banco ya acreditó otra compra. Revisa la referencia antes de aprobar.';
  }
  return msg;
}
