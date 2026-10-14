import { NextResponse } from 'next/server';
import { soloAdmin } from '@/lib/admin-taller';
import { COMPROBANTE_MAX_BYTES } from '@/lib/saldo';
import { leerComprobanteCacheado, ocrConfigurado } from '@/lib/pagos/ocr';

export const dynamic = 'force-dynamic';

// POST /api/saldo/comprobante — FormData { file }
// Lee la captura en cuanto el taller la elige, para mostrarle la referencia y
// el monto antes de enviar. No guarda nada; al enviar la compra el servidor la
// vuelve a leer (sale de la caché) porque no se fía del navegador.
export async function POST(req: Request) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;
  if (!ocrConfigurado()) return NextResponse.json({ estado: 'sin_ocr' });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || file.size === 0 || !file.type.startsWith('image/') || file.size > COMPROBANTE_MAX_BYTES) {
    return NextResponse.json({ error: 'Sube una captura del pago (imagen de hasta 4 MB).' }, { status: 400 });
  }

  const r = await leerComprobanteCacheado(caller.workshopId, await file.arrayBuffer(), file.name);
  if (r.estado !== 'leido') return NextResponse.json({ estado: r.estado });
  return NextResponse.json({
    estado: 'leido',
    referencia: r.datos.full_reference || r.datos.reference,
    monto: r.datos.amount,
    banco: r.datos.bank,
  });
}
