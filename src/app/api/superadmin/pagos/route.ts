import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getPlatformAdmin } from '@/lib/api-auth';
import { STAGE_FILES_BUCKET } from '@/lib/storage';
import { MINUTOS_ANTES_DE_REVISION, saludValidacion } from '@/lib/pagos/conciliar';

export const dynamic = 'force-dynamic';

const COLUMNAS =
  'id, workshop_id, amount_usd, amount_ves, credited_usd, exchange_rate, reference, proof_path, status, note, revision, bank_note, bank_response, approved_origin, ocr_reference, ocr_amount, ocr_bank, check_count, last_checked_at, created_at, reviewed_at, workshop:workshops(name, slug, whatsapp, balance_usd)';

// GET /api/superadmin/pagos?estado=revisar|validando|aprobado|rechazado|todos&q=texto
//  revisar   → pendientes que tiene que decidir una persona (con motivo, o que
//              llevan más de 10 min sin aparecer en el banco)
//  validando → pendientes que el sistema todavía está buscando en el banco
// Con `q` busca en todo el histórico por referencia o nombre del taller.
// Devuelve también el semáforo de la validación automática.
export async function GET(req: Request) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const estado = url.searchParams.get('estado') ?? 'revisar';
  const busqueda = (url.searchParams.get('q') ?? '').trim().replace(/[,()%*]/g, ' ').slice(0, 60);
  const service = createServiceClient();
  const corte = new Date(Date.now() - MINUTOS_ANTES_DE_REVISION * 60_000).toISOString();

  let q = service.from('balance_purchases').select(COLUMNAS);
  if (busqueda) {
    const digitos = busqueda.replace(/\D/g, '');
    const { data: talleres } = await service.from('workshops').select('id').ilike('name', `%${busqueda}%`).limit(50);
    const ids = ((talleres ?? []) as { id: string }[]).map((t) => t.id);
    const filtros = [
      ...(digitos.length >= 3 ? [`reference.ilike.%${digitos}%`] : []),
      ...(ids.length ? [`workshop_id.in.(${ids.join(',')})`] : []),
    ];
    if (!filtros.length) return NextResponse.json({ pagos: [], cuentas: await contar(service, corte), salud: await saludValidacion(service) });
    q = q.or(filtros.join(','));
  } else if (estado === 'revisar') {
    q = q.eq('status', 'pendiente').or(`revision.not.is.null,created_at.lt.${corte}`);
  } else if (estado === 'validando') {
    q = q.eq('status', 'pendiente').is('revision', null).gte('created_at', corte);
  } else if (estado === 'aprobado' || estado === 'rechazado') {
    q = q.eq('status', estado);
  }
  q = q.order('created_at', { ascending: estado === 'revisar' || estado === 'validando' }).limit(100);

  const [{ data, error }, cuentas, salud] = await Promise.all([q, contar(service, corte), saludValidacion(service)]);
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
    cuentas,
    salud,
    // compatibilidad con el contador anterior
    pendientes: cuentas.revisar + cuentas.validando,
  });
}

async function contar(service: ReturnType<typeof createServiceClient>, corte: string) {
  const [{ count: revisar }, { count: validando }] = await Promise.all([
    service
      .from('balance_purchases')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pendiente')
      .or(`revision.not.is.null,created_at.lt.${corte}`),
    service
      .from('balance_purchases')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pendiente')
      .is('revision', null)
      .gte('created_at', corte),
  ]);
  return { revisar: revisar ?? 0, validando: validando ?? 0 };
}
