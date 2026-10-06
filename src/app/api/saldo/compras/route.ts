import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { soloAdmin } from '@/lib/admin-taller';
import { STAGE_FILES_BUCKET } from '@/lib/storage';
import { fetchExchangeRateSafe } from '@/lib/tasa-bcv';
import {
  COMPRA_MAX_USD,
  COMPRA_MIN_USD,
  COMPROBANTE_MAX_BYTES,
  carpetaComprobantes,
  centavos,
} from '@/lib/saldo';

export const dynamic = 'force-dynamic';

const YA_HAY_PENDIENTE = 'Ya tienes un pago en revisión. Espera a que lo aprobemos para enviar otro.';

// POST /api/saldo/compras — FormData { amount_usd, reference, file }
// El taller avisa que pagó por Pago Móvil. La compra queda PENDIENTE hasta que
// la plataforma la revisa a mano en el superadmin: aquí no se valida nada
// contra el banco. El monto en Bs y la tasa se calculan en el servidor.
export async function POST(req: Request) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const monto = centavos(Number(String(form.get('amount_usd') ?? '').replace(',', '.')));
  if (!Number.isFinite(monto) || monto < COMPRA_MIN_USD || monto > COMPRA_MAX_USD) {
    return NextResponse.json(
      { error: `El monto debe estar entre $${COMPRA_MIN_USD} y $${COMPRA_MAX_USD}.` },
      { status: 400 }
    );
  }

  const referencia = String(form.get('reference') ?? '').trim().slice(0, 40);
  if (referencia.replace(/\D/g, '').length < 4) {
    return NextResponse.json({ error: 'Escribe el número de referencia del pago.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Sube la captura del comprobante.' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'El comprobante debe ser una imagen.' }, { status: 400 });
  }
  if (file.size > COMPROBANTE_MAX_BYTES) {
    return NextResponse.json({ error: 'La imagen es muy pesada (máximo 4 MB).' }, { status: 400 });
  }

  const service = createServiceClient();

  // Una compra en revisión a la vez (la base también lo impide).
  const { count: pendientes } = await service
    .from('balance_purchases')
    .select('id', { count: 'exact', head: true })
    .eq('workshop_id', caller.workshopId)
    .eq('status', 'pendiente');
  if ((pendientes ?? 0) > 0) return NextResponse.json({ error: YA_HAY_PENDIENTE }, { status: 409 });

  // Referencia repetida: no se bloquea, se avisa a quien revisa.
  const cola = referencia.replace(/\D/g, '').slice(-6);
  const { data: repetidas } = await service
    .from('balance_purchases')
    .select('id')
    .eq('reference_tail', cola)
    .neq('status', 'rechazado')
    .limit(1);
  const nota = (repetidas ?? []).length > 0 ? '⚠ Referencia repetida: ya hay otro pago con esos 6 dígitos.' : null;

  const tasa = await fetchExchangeRateSafe();
  const montoBs = tasa ? centavos(monto * tasa.rate) : null;

  const ext = file.type.includes('png') ? 'png' : file.type.includes('webp') ? 'webp' : 'jpg';
  const path = `${carpetaComprobantes(caller.workshopId)}${crypto.randomUUID()}.${ext}`;
  const { error: errSubida } = await service.storage
    .from(STAGE_FILES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (errSubida) {
    console.error('[saldo] comprobante', errSubida.message);
    return NextResponse.json({ error: 'No se pudo subir el comprobante. Inténtalo de nuevo.' }, { status: 502 });
  }

  const { data, error } = await service
    .from('balance_purchases')
    .insert({
      workshop_id: caller.workshopId,
      amount_usd: monto,
      amount_ves: montoBs,
      exchange_rate: tasa?.rate ?? null,
      reference: referencia,
      proof_path: path,
      note: nota,
      created_by: caller.userId,
    })
    .select('id, amount_usd, amount_ves, exchange_rate, reference, status, note, created_at, reviewed_at')
    .single();

  if (error) {
    await service.storage.from(STAGE_FILES_BUCKET).remove([path]);
    // La base impide dos pendientes a la vez (índice único).
    if (error.code === '23505') return NextResponse.json({ error: YA_HAY_PENDIENTE }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
