import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/api-auth';
import { sumarTotal } from '@/lib/budget';
import type { BudgetSummary, OrderStatus } from '@/lib/types';

// GET /api/budgets — todas las órdenes del taller con su total ya sumado.
//
// Es lo que alimenta la pantalla "Presupuestos": se listan TODAS las órdenes,
// tengan ítems o no, porque desde ahí también se empieza un presupuesto nuevo.
//
// Ojo con el tope de 1.000 filas de PostgREST: se aplica solo y en silencio,
// así que tanto las órdenes como los ítems se traen por páginas. Sumar sobre
// una lista recortada daría totales de menos sin ningún aviso.
const PAGINA = 1000;

async function traerTodo<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: unknown }>
): Promise<T[]> {
  const todo: T[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await consulta(desde, desde + PAGINA - 1);
    if (error) throw error;
    const filas = (data ?? []) as T[];
    todo.push(...filas);
    if (filas.length < PAGINA) break;
  }
  return todo;
}

export async function GET() {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!caller.workshopId || (caller.role !== 'admin' && caller.role !== 'mechanic')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient();

  try {
    type FilaOrden = {
      id: string;
      client_first_name: string;
      client_last_name: string;
      car_model: string;
      status: OrderStatus;
      created_at: string;
    };

    const ordenes = await traerTodo<FilaOrden>((desde, hasta) =>
      service
        .from('orders')
        .select('id, client_first_name, client_last_name, car_model, status, created_at')
        .eq('workshop_id', caller.workshopId as string)
        .order('created_at', { ascending: false })
        .range(desde, hasta)
    );

    if (ordenes.length === 0) return NextResponse.json([]);

    const ids = ordenes.map((o) => o.id);
    type FilaItem = { order_id: string; amount: number };

    // Los ítems se piden por lotes de ids: una lista `in(...)` enorme
    // terminaría en una URL más larga de lo que acepta PostgREST.
    const items: FilaItem[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const lote = ids.slice(i, i + 200);
      const parte = await traerTodo<FilaItem>((desde, hasta) =>
        service
          .from('order_budget_items')
          .select('order_id, amount')
          .in('order_id', lote)
          .range(desde, hasta)
      );
      items.push(...parte);
    }

    const porOrden = new Map<string, FilaItem[]>();
    for (const it of items) {
      const lista = porOrden.get(it.order_id);
      if (lista) lista.push(it);
      else porOrden.set(it.order_id, [it]);
    }

    const filas: BudgetSummary[] = ordenes.map((o) => {
      const suyos = porOrden.get(o.id) ?? [];
      return {
        order_id: o.id,
        client_name: `${o.client_first_name} ${o.client_last_name}`.trim(),
        car_model: o.car_model,
        status: o.status,
        created_at: o.created_at,
        item_count: suyos.length,
        total: sumarTotal(suyos),
      };
    });

    return NextResponse.json(filas);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al cargar los presupuestos';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
