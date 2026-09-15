import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getPlatformAdmin } from '@/lib/api-auth';

type Params = { params: { id: string } };

// Cota superior del override por taller: la columna es int4; sin tope, un número
// enorme desborda en Postgres (500). Ver misma cota en /api/superadmin/settings.
const MAX_ORDER_LIMIT = 1_000_000;

// PATCH /api/superadmin/workshops/:id — actualiza la suscripción, la etiqueta
// de prueba y/o el override del límite de órdenes del taller. Solo
// superadmins de plataforma.
// Body admite: { is_subscribed?: boolean, is_test?: boolean, order_limit?: number | null }
//   order_limit = null → el taller vuelve a usar el límite global.
export async function PATCH(req: Request, { params }: Params) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const updates: { is_subscribed?: boolean; is_test?: boolean; order_limit?: number | null } = {};

  if ('is_subscribed' in (body ?? {})) {
    if (typeof body.is_subscribed !== 'boolean') {
      return NextResponse.json({ error: 'is_subscribed debe ser booleano' }, { status: 400 });
    }
    updates.is_subscribed = body.is_subscribed;
  }

  if ('is_test' in (body ?? {})) {
    if (typeof body.is_test !== 'boolean') {
      return NextResponse.json({ error: 'is_test debe ser booleano' }, { status: 400 });
    }
    updates.is_test = body.is_test;
  }

  if ('order_limit' in (body ?? {})) {
    const ol = body.order_limit;
    if (
      ol !== null &&
      (typeof ol !== 'number' || !Number.isInteger(ol) || ol < 0 || ol > MAX_ORDER_LIMIT)
    ) {
      return NextResponse.json(
        { error: `order_limit debe ser un entero entre 0 y ${MAX_ORDER_LIMIT}, o null` },
        { status: 400 }
      );
    }
    updates.order_limit = ol;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('workshops')
    .update(updates)
    .eq('id', params.id)
    .select('id, is_subscribed, is_test, order_limit')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
