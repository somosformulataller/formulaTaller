import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getPlatformAdmin } from '@/lib/api-auth';
import { STAGE_FILES_BUCKET } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const ESTADOS = ['pendiente', 'aprobado', 'rechazado'] as const;

// GET /api/superadmin/pagos?estado=pendiente|aprobado|rechazado|todos
// Las compras de saldo para revisar a mano, con el taller y el comprobante
// (URL firmada por 1 h). Solo superadmins de plataforma.
export async function GET(req: Request) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const estado = new URL(req.url).searchParams.get('estado') ?? 'pendiente';
  const service = createServiceClient();

  let q = service
    .from('balance_purchases')
    .select(
      'id, workshop_id, amount_usd, amount_ves, exchange_rate, reference, proof_path, status, note, created_at, reviewed_at, workshop:workshops(name, slug, whatsapp, balance_usd)'
    )
    .order('created_at', { ascending: estado === 'pendiente' })
    .limit(100);
  if ((ESTADOS as readonly string[]).includes(estado)) q = q.eq('status', estado);

  const [{ data, error }, { count: pendientes }] = await Promise.all([
    q,
    service.from('balance_purchases').select('id', { count: 'exact', head: true }).eq('status', 'pendiente'),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filas = (data ?? []) as unknown as Array<{ proof_path: string } & Record<string, unknown>>;
  const paths = filas.map((f) => f.proof_path);
  const firmadas = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await service.storage.from(STAGE_FILES_BUCKET).createSignedUrls(paths, 60 * 60);
    (urls ?? []).forEach((u, i) => u.signedUrl && firmadas.set(paths[i], u.signedUrl));
  }

  return NextResponse.json({
    pagos: filas.map((f) => ({ ...f, proof_url: firmadas.get(f.proof_path) ?? null })),
    pendientes: pendientes ?? 0,
  });
}
