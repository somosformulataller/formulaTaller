'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Order, OrderStatus } from '@/lib/types';
import type { Conteos, FiltroEstado, PaginaOrdenes } from '@/lib/ordenes-lista';

/**
 * La lista de órdenes del administrador por páginas (ver lib/ordenes-lista.ts).
 *
 * Llega con la primera página y los conteos ya leídos por el servidor. Cambiar
 * el filtro o buscar pide la primera página de nuevo a la API (la búsqueda,
 * 300 ms después de dejar de teclear); «Ver más» pide la siguiente. Crear,
 * borrar o cambiar de estado una orden actualiza la lista y los conteos aquí
 * mismo, sin volver a pedir nada.
 */
export function useOrdenesPaginadas(inicial: PaginaOrdenes, conteosIniciales: Conteos) {
  const [orders, setOrders] = useState<Order[]>(inicial.orders);
  const [hayMas, setHayMas] = useState(inicial.hayMas);
  const [conteos, setConteos] = useState<Conteos>(conteosIniciales);
  const [filter, setFilter] = useState<FiltroEstado>('all');
  const [search, setSearch] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Solo vale la respuesta de la última petición (si se teclea rápido, las
  // anteriores pueden llegar tarde y pisarla).
  const ultima = useRef(0);
  const primera = useRef(true);

  const pedir = useCallback(
    async (desde: number) => {
      const n = ++ultima.current;
      setCargando(true);
      setError(null);
      try {
        const sp = new URLSearchParams({ desde: String(desde) });
        if (filter !== 'all') sp.set('estado', filter);
        if (search.trim()) sp.set('q', search.trim());
        const res = await fetch(`/api/orders?${sp}`, { cache: 'no-store' });
        if (!res.ok) throw new Error();
        const data: PaginaOrdenes = await res.json();
        if (n !== ultima.current) return;
        setOrders((prev) => (desde === 0 ? data.orders : [...prev, ...data.orders.filter((o) => !prev.some((p) => p.id === o.id))]));
        setHayMas(data.hayMas);
      } catch {
        if (n === ultima.current) setError('No se pudieron cargar las órdenes. Revisa tu conexión.');
      } finally {
        if (n === ultima.current) setCargando(false);
      }
    },
    [filter, search]
  );

  // Filtro o búsqueda nuevos → primera página. La primera vez no: ya llegó
  // del servidor.
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    const t = setTimeout(() => pedir(0), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [pedir, search]);

  const verMas = useCallback(() => pedir(orders.length), [pedir, orders.length]);

  function sumar(estado: OrderStatus, d: number, total = 0) {
    setConteos((c) => ({ ...c, total: c.total + total, [estado]: Math.max(0, c[estado] + d) }));
  }

  function agregar(order: Order) {
    setOrders((prev) => [order, ...prev]);
    sumar(order.status, 1, 1);
  }

  function quitar(id: string) {
    const o = orders.find((x) => x.id === id);
    setOrders((prev) => prev.filter((x) => x.id !== id));
    if (o) sumar(o.status, -1, -1);
  }

  function cambiarEstado(id: string, status: OrderStatus) {
    const o = orders.find((x) => x.id === id);
    if (o && o.status !== status) {
      sumar(o.status, -1);
      sumar(status, 1);
    }
    setOrders((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  function actualizar(updated: Order) {
    const o = orders.find((x) => x.id === updated.id);
    if (o && o.status !== updated.status) {
      sumar(o.status, -1);
      sumar(updated.status, 1);
    }
    setOrders((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  // Una orden que cambió de estado deja de verse si ya no cumple el filtro.
  const visibles = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  return {
    visibles,
    conteos,
    hayMas,
    cargando,
    error,
    filter,
    setFilter,
    search,
    setSearch,
    verMas,
    reintentar: () => pedir(0),
    agregar,
    quitar,
    cambiarEstado,
    actualizar,
  };
}
