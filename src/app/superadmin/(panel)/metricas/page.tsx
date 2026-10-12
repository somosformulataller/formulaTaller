import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { getPlatformAdmin } from '@/lib/api-auth';
import LoadError from '@/components/ui/LoadError';
import MetricasClient, { type Dia, type FilaOrden, type FilaTaller } from './MetricasClient';

export const dynamic = 'force-dynamic';

const DIAS = 30;
const INACTIVO_DIAS = 3;
const TZ = 'America/Caracas';

type Taller = {
  id: string;
  name: string;
  whatsapp: string | null;
  owner_id: string | null;
  created_at: string;
};

type Orden = {
  id: string;
  workshop_id: string;
  created_at: string;
  client_first_name: string;
  client_last_name: string;
  car_model: string;
  status: string;
};

/** «2026-10-12», el día en hora de Venezuela. */
const diaVE = (iso: string | Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(iso)
  );

// «Métricas»: actividad de los talleres (sin los de prueba) para hacerles
// seguimiento por WhatsApp. Se traen todas las órdenes paginando de a 1000
// (el tope silencioso de PostgREST) y se agrupa aquí.
export default async function MetricasPage() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect('/superadmin/login');

  const service = createServiceClient();

  const { data: talleresData, error } = await service
    .from('workshops')
    .select('id, name, whatsapp, owner_id, created_at')
    .eq('is_test', false)
    .order('created_at', { ascending: false })
    .range(0, 9999);
  if (error) {
    return <LoadError message="No se pudieron cargar las métricas. Reintenta en un momento." detail={error.message} />;
  }
  const talleres = (talleresData ?? []) as unknown as Taller[];
  const tallerPorId = new Map(talleres.map((t) => [t.id, t]));

  const ordenes: Orden[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error: e } = await service
      .from('orders')
      .select('id, workshop_id, created_at, client_first_name, client_last_name, car_model, status')
      .order('created_at', { ascending: false })
      .range(from, from + 999);
    if (e) {
      return <LoadError message="No se pudieron cargar las órdenes. Reintenta en un momento." detail={e.message} />;
    }
    const lote = (data ?? []) as unknown as Orden[];
    ordenes.push(...lote.filter((o) => tallerPorId.has(o.workshop_id)));
    if (lote.length < 1000) break;
  }

  const ownerIds = talleres.map((t) => t.owner_id).filter((id): id is string => !!id);
  const nombrePorOwner = new Map<string, string>();
  for (let i = 0; i < ownerIds.length; i += 200) {
    const { data } = await service.from('profiles').select('id, full_name').in('id', ownerIds.slice(i, i + 200));
    for (const p of (data ?? []) as unknown as { id: string; full_name: string }[]) nombrePorOwner.set(p.id, p.full_name);
  }

  // Por taller: primera y última orden, y cuántas lleva (ordenes viene de la más nueva a la más vieja).
  const porTaller = new Map<string, { primera: Orden; ultima: Orden; total: number }>();
  for (const o of ordenes) {
    const p = porTaller.get(o.workshop_id);
    if (!p) porTaller.set(o.workshop_id, { primera: o, ultima: o, total: 1 });
    else {
      p.primera = o;
      p.total++;
    }
  }

  // Número de cada orden dentro de su taller: #1 es la primera que creó.
  const numero = new Map<string, number>();
  const contador = new Map<string, number>();
  for (let i = ordenes.length - 1; i >= 0; i--) {
    const o = ordenes[i];
    const n = (contador.get(o.workshop_id) ?? 0) + 1;
    contador.set(o.workshop_id, n);
    numero.set(o.id, n);
  }

  const fila = (o: Orden): FilaOrden => {
    const t = tallerPorId.get(o.workshop_id)!;
    return {
      id: o.id,
      workshop_id: o.workshop_id,
      numero: numero.get(o.id)!,
      total: porTaller.get(o.workshop_id)!.total,
      created_at: o.created_at,
      cliente: `${o.client_first_name ?? ''} ${o.client_last_name ?? ''}`.trim(),
      carro: (o.car_model ?? '').trim(),
      status: o.status,
      taller: t.name,
      dueno: t.owner_id ? nombrePorOwner.get(t.owner_id) ?? null : null,
      whatsapp: t.whatsapp,
    };
  };

  const tallerFila = (id: string): FilaTaller => {
    const t = tallerPorId.get(id)!;
    const p = porTaller.get(id)!;
    return {
      id,
      taller: t.name,
      dueno: t.owner_id ? nombrePorOwner.get(t.owner_id) ?? null : null,
      whatsapp: t.whatsapp,
      registrado: t.created_at,
      total: p.total,
      primera: fila(p.primera),
      ultima: p.ultima.created_at,
    };
  };

  const ultimas = ordenes.slice(0, 100).map(fila);

  // Todas las órdenes de cada taller, de la #1 a la última, para desplegarlas.
  const historial: Record<string, FilaOrden[]> = {};
  for (let i = ordenes.length - 1; i >= 0; i--) {
    const o = ordenes[i];
    (historial[o.workshop_id] ??= []).push(fila(o));
  }

  const primeras = Array.from(porTaller.keys())
    .map(tallerFila)
    .sort((a, b) => b.primera.created_at.localeCompare(a.primera.created_at));

  const limite = Date.now() - INACTIVO_DIAS * 24 * 60 * 60 * 1000;
  const inactivos = primeras
    .filter((f) => new Date(f.ultima).getTime() < limite)
    .sort((a, b) => b.ultima.localeCompare(a.ultima));

  // Serie de los últimos 30 días (hoy incluido), en hora de Venezuela.
  const hoy = diaVE(new Date());
  const claves: string[] = [];
  for (let i = DIAS - 1; i >= 0; i--) {
    const d = new Date(`${hoy}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    claves.push(d.toISOString().slice(0, 10));
  }
  const serie = new Map<string, { ordenes: number; activos: Set<string>; nuevos: number }>(
    claves.map((k) => [k, { ordenes: 0, activos: new Set(), nuevos: 0 }])
  );
  for (const o of ordenes) {
    const s = serie.get(diaVE(o.created_at));
    if (s) {
      s.ordenes++;
      s.activos.add(o.workshop_id);
    }
  }
  for (const t of talleres) {
    const s = serie.get(diaVE(t.created_at));
    if (s) s.nuevos++;
  }
  const dias: Dia[] = claves.map((k) => {
    const s = serie.get(k)!;
    return { dia: k, ordenes: s.ordenes, activos: s.activos.size, nuevos: s.nuevos };
  });

  return <MetricasClient dias={dias} ultimas={ultimas} historial={historial} primeras={primeras} inactivos={inactivos} inactivoDias={INACTIVO_DIAS} />;
}
