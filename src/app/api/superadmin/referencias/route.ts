import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getPlatformAdmin } from '@/lib/api-auth';
import {
  bancoConfigurado,
  buscarPorReferencia,
  leerEstadoDeCuenta,
  refrescarEstadoDeCuenta,
  referenciaImposible,
  type Movimiento,
} from '@/lib/pagos/banco';
import { cola6 } from '@/lib/pagos/reglas';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET /api/superadmin/referencias?q=<referencia>[&refrescar=1]
// «¿Este pago existe y ya se usó?» Cruza el estado de cuenta del banco con las
// compras de saldo de Formula Taller (adaptado de La Mejor Llave).
//
// La cuenta la comparte La Mejor Llave: un pago marcado como USADO en el banco
// sin ninguna compra nuestra aprobada casi siempre es un pago de La Mejor Llave.
// Sin `q`: los últimos créditos que entraron a la cuenta, con a quién pertenecen.

const MIN_DIGITOS = 4;
const RECIENTES = 15;

type Veredicto =
  | 'sin_dinero' //     el banco no tiene ningún pago con esa referencia
  | 'libre' //          el pago existe y nadie lo ha usado
  | 'aprobada' //       ya acreditó saldo en Formula Taller
  | 'coincide_otra' //  la compra aprobada con esa terminación se pagó con OTRO movimiento
  | 'esperando' //      hay una compra de Formula Taller pendiente con esa referencia
  | 'rechazada' //      hubo una compra con esa referencia y se rechazó
  | 'otra_app'; //      usado en el banco sin compra nuestra: casi seguro La Mejor Llave

interface CompraFila {
  id: string;
  reference: string;
  status: string;
  revision: string | null;
  amount_usd: number;
  amount_ves: number | null;
  credited_usd: number | null;
  approved_origin: string | null;
  created_at: string;
  bank_tx_id: number | null;
  ocr_reference: string | null;
  ocr_amount: number | null;
  ocr_bank: string | null;
  workshop: { name: string; whatsapp: string | null } | null;
}

const COLUMNAS =
  'id, reference, status, revision, amount_usd, amount_ves, credited_usd, approved_origin, created_at, bank_tx_id, ocr_reference, ocr_amount, ocr_bank, workshop:workshops(name, whatsapp)';

export async function GET(req: Request) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const digitos = (url.searchParams.get('q') ?? '').replace(/\D/g, '');
  const service = createServiceClient();
  const configurado = bancoConfigurado();

  // «Actualizar»: una entrada al banco, respetando el turno compartido.
  let latido: string | null = null;
  if (url.searchParams.get('refrescar') && configurado) {
    const { data: turno } = await service.rpc('tomar_turno_banco', { p_segundos: 60 });
    latido = turno === true ? await refrescarEstadoDeCuenta(referenciaImposible(await leerEstadoDeCuenta(200))) : 'turno_ocupado';
  }

  if (!digitos) return NextResponse.json(await recientes(service, configurado, latido));
  if (digitos.length < MIN_DIGITOS) {
    return NextResponse.json({ error: `Escribe al menos ${MIN_DIGITOS} dígitos de la referencia.` }, { status: 400 });
  }
  const cola = digitos.slice(-6);

  const [movimientos, ultimo, { data }] = await Promise.all([
    configurado ? buscarPorReferencia(cola) : Promise.resolve([] as Movimiento[]),
    configurado ? leerEstadoDeCuenta(1) : Promise.resolve([] as Movimiento[]),
    service
      .from('balance_purchases')
      .select(COLUMNAS)
      .eq('reference_tail', cola)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);
  const creditos = movimientos.filter((m) => m.tipo === 'CREDITO' && String(m.referencia).endsWith(cola));
  const compras = (data ?? []) as unknown as CompraFila[];

  const aprobadas = compras.filter((c) => c.status === 'aprobado');
  const idsMov = new Set(creditos.map((m) => m.id));
  const aprobadaConEste = aprobadas.some((c) => c.bank_tx_id !== null && idsMov.has(Number(c.bank_tx_id)));
  const libres = creditos.filter((m) => !m.used);
  const usados = creditos.filter((m) => m.used);

  let veredicto: Veredicto;
  if (aprobadas.length && !aprobadaConEste && libres.length && aprobadas.every((c) => c.bank_tx_id !== null)) {
    veredicto = 'coincide_otra';
  } else if (aprobadas.length) veredicto = 'aprobada';
  else if (compras.some((c) => c.status === 'pendiente')) veredicto = 'esperando';
  else if (compras.some((c) => c.status === 'rechazado')) veredicto = libres.length ? 'libre' : 'rechazada';
  else if (!creditos.length) veredicto = 'sin_dinero';
  else if (libres.length) veredicto = 'libre';
  else veredicto = usados.length ? 'otra_app' : 'sin_dinero';

  // A cuál de nuestras compras corresponde cada movimiento (si alguna)
  const dueno = new Map<number, CompraFila>();
  for (const c of aprobadas) if (c.bank_tx_id !== null) dueno.set(Number(c.bank_tx_id), c);

  return NextResponse.json({
    cola,
    veredicto,
    banco_configurado: configurado,
    ultimo_escaneo: ultimo[0]?.scrapedAt ?? null,
    latido,
    movimientos: creditos.map((m) => ({
      ...m,
      de: dueno.has(m.id) ? 'formula_taller' : m.used ? 'otra_app' : 'libre',
      taller: dueno.get(m.id)?.workshop?.name ?? null,
    })),
    compras,
  });
}

/** Los últimos créditos de la cuenta y de quién es cada uno. */
async function recientes(service: ReturnType<typeof createServiceClient>, configurado: boolean, latido: string | null) {
  if (!configurado) return { modo: 'recientes', banco_configurado: false, latido, recientes: [] };
  const movs = (await leerEstadoDeCuenta(60)).filter((m) => m.tipo === 'CREDITO').slice(0, RECIENTES);
  const colas = Array.from(new Set(movs.map((m) => cola6(m.referencia))));
  const { data } = colas.length
    ? await service.from('balance_purchases').select(COLUMNAS).in('reference_tail', colas).limit(100)
    : { data: [] };
  const compras = (data ?? []) as unknown as CompraFila[];
  const porMov = new Map<number, CompraFila>();
  const porCola = new Map<string, CompraFila>();
  for (const c of compras) {
    if (c.status === 'aprobado' && c.bank_tx_id !== null) porMov.set(Number(c.bank_tx_id), c);
    if (c.status === 'pendiente') porCola.set(cola6(c.reference), c);
  }
  return {
    modo: 'recientes',
    banco_configurado: true,
    latido,
    ultimo_escaneo: movs.map((m) => m.scrapedAt ?? '').sort().at(-1) || null,
    recientes: movs.map((m) => {
      const nuestra = porMov.get(m.id);
      const pendiente = porCola.get(cola6(m.referencia));
      return {
        ...m,
        cola: cola6(m.referencia),
        de: nuestra ? 'formula_taller' : pendiente ? 'pendiente' : m.used ? 'otra_app' : 'libre',
        taller: nuestra?.workshop?.name ?? pendiente?.workshop?.name ?? null,
      };
    }),
  };
}
