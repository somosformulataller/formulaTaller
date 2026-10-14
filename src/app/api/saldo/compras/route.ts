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
import { leerComprobanteCacheado, ocrConfigurado, type DatosOcr } from '@/lib/pagos/ocr';
import { MAX_AUTO_USD, cola6 } from '@/lib/pagos/conciliar';

export const dynamic = 'force-dynamic';

const YA_HAY_PENDIENTE = 'Ya tienes un pago en revisión. Espera a que lo aprobemos para enviar otro.';

// POST /api/saldo/compras — FormData { amount_usd, reference, file }
// El taller avisa que pagó por Pago Móvil. El OCR lee la referencia y el monto
// de la captura; la compra queda PENDIENTE y la conciliación la busca en el
// banco (la pantalla del taller llama a /verificar y el cron cada minuto). Lo
// que no cuadra pasa a revisión manual en el superadmin. El monto en Bs y la
// tasa se calculan en el servidor.
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

  // La referencia que vale es la que lee el OCR; la escrita solo se usa si la
  // captura no se pudo leer.
  const bytes = await file.arrayBuffer();
  let ocr: DatosOcr | null = null;
  if (ocrConfigurado()) {
    const lectura = await leerComprobanteCacheado(caller.workshopId, bytes, file.name);
    if (lectura.estado === 'leido') ocr = lectura.datos;
  }
  const escrita = String(form.get('reference') ?? '').replace(/\D/g, '').slice(0, 30);
  const referencia = ocr ? ocr.full_reference || ocr.reference : escrita;
  if (referencia.length < 6) {
    return NextResponse.json(
      { error: 'No pudimos leer la referencia de la captura. Escribe el número de referencia completo.' },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  // Una compra en revisión a la vez (la base también lo impide).
  const { count: pendientes } = await service
    .from('balance_purchases')
    .select('id', { count: 'exact', head: true })
    .eq('workshop_id', caller.workshopId)
    .eq('status', 'pendiente');
  if ((pendientes ?? 0) > 0) return NextResponse.json({ error: YA_HAY_PENDIENTE }, { status: 409 });

  // Referencia repetida: no se bloquea, pero la decide una persona (aprobarla
  // sola podría tomar el pago de otra compra).
  const { data: repetidas } = await service
    .from('balance_purchases')
    .select('id')
    .eq('reference_tail', cola6(referencia))
    .neq('status', 'rechazado')
    .limit(1);
  const repetida = (repetidas ?? []).length > 0;

  const tasa = await fetchExchangeRateSafe();
  const montoBs = tasa ? centavos(monto * tasa.rate) : null;

  const ext = file.type.includes('png') ? 'png' : file.type.includes('webp') ? 'webp' : 'jpg';
  const path = `${carpetaComprobantes(caller.workshopId)}${crypto.randomUUID()}.${ext}`;
  const { error: errSubida } = await service.storage
    .from(STAGE_FILES_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (errSubida) {
    console.error('[saldo] comprobante', errSubida.message);
    return NextResponse.json({ error: 'No se pudo subir el comprobante. Inténtalo de nuevo.' }, { status: 502 });
  }

  const revision = repetida ? 'referencia_repetida' : monto > MAX_AUTO_USD ? 'monto_alto' : null;
  const { data, error } = await service
    .from('balance_purchases')
    .insert({
      workshop_id: caller.workshopId,
      amount_usd: monto,
      amount_ves: montoBs,
      exchange_rate: tasa?.rate ?? null,
      reference: referencia,
      proof_path: path,
      note: repetida ? '⚠ Referencia repetida: ya hay otro pago con esos 6 dígitos.' : null,
      revision,
      bank_note: repetida
        ? 'Ya hay otra compra con esos 6 dígitos de referencia. Verificar en el banco antes de aprobar.'
        : revision === 'monto_alto'
          ? `Compra de $${monto.toFixed(2)}: por encima de $${MAX_AUTO_USD} se aprueba a mano.`
          : ocr
            ? null
            : `No se pudo leer la captura: la referencia la escribió el taller (${escrita}).`,
      ocr_reference: ocr?.reference ?? null,
      ocr_amount: ocr?.amount ?? null,
      ocr_bank: ocr?.bank ?? null,
      ocr_raw: ocr?.raw ?? null,
      ocr_at: ocrConfigurado() ? new Date().toISOString() : null,
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
