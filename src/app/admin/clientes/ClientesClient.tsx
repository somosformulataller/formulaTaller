'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bell, CalendarDays, ChevronDown, History, Search, Users } from 'lucide-react';
import LoadError from '@/components/ui/LoadError';
import ClientReminders from '@/components/reminders/ClientReminders';
import ClientHistory from '@/components/reminders/ClientHistory';
import type { ClientRow } from '@/lib/types';
import { formatDateShort } from '@/lib/utils';

/** Sin tildes ni mayúsculas, para que «jose» encuentre a «José». */
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Pantalla «Clientes»: la lista de nombres con un buscador. Al tocar un
 * cliente se despliegan dos opciones, Recordatorio e Historial de órdenes.
 */
export default function ClientesClient({ workshopName }: { workshopName: string }) {
  const [filas, setFilas] = useState<ClientRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [seccion, setSeccion] = useState<'recordatorio' | 'historial' | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/clients', { cache: 'no-store' });
        if (!res.ok) throw new Error('No se pudieron cargar los clientes');
        setFilas(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar');
      }
    })();
  }, []);

  const visibles = useMemo(() => {
    if (!filas) return [];
    const q = normalizar(busqueda.trim());
    if (!q) return filas;
    const digitos = busqueda.replace(/\D/g, '');
    return filas.filter(
      (c) =>
        normalizar(`${c.first_name} ${c.last_name}`).includes(q) ||
        (c.last_car_model && normalizar(c.last_car_model).includes(q)) ||
        (digitos.length >= 3 && c.whatsapp.includes(digitos))
    );
  }, [filas, busqueda]);

  function alternar(id: string) {
    if (abierto === id) {
      setAbierto(null);
      setSeccion(null);
    } else {
      setAbierto(id);
      setSeccion(null);
    }
  }

  if (error) return <LoadError message={error} detail="Recarga la página para volver a intentarlo." />;

  return (
    <div className="animate-fade-in" style={{ paddingTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Clientes</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Toca un cliente para agregarle un recordatorio o ver sus órdenes.
          </p>
        </div>
        <Link
          href="/admin/recordatorios"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            color: 'var(--color-text-secondary)',
            fontSize: 12.5,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <CalendarDays size={15} />
          Calendario
        </Link>
      </div>

      {filas && filas.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            className="form-input"
            placeholder="Buscar por nombre, vehículo o teléfono"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>
      )}

      {!filas && <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Cargando…</p>}

      {filas && filas.length === 0 && (
        <div className="empty-state">
          <Users size={40} />
          <p>Todavía no hay clientes. Aparecen solos al crear órdenes.</p>
        </div>
      )}

      {filas && filas.length > 0 && visibles.length === 0 && (
        <div className="empty-state">
          <Search size={40} />
          <p>Ningún cliente coincide con «{busqueda}».</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visibles.map((c) => {
          const estaAbierto = abierto === c.id;
          const nombre = `${c.first_name} ${c.last_name}`.trim() || 'Sin nombre';
          return (
            <div key={c.id} className="card">
              <button
                type="button"
                onClick={() => alternar(c.id)}
                aria-expanded={estaAbierto}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'inherit',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: 'var(--color-surface-3, var(--color-surface-2))',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 800,
                      color: 'var(--color-brand-400)',
                    }}
                  >
                    {(c.first_name[0] ?? '?').toUpperCase()}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 15,
                        fontWeight: 700,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {nombre}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      {c.order_count} orden{c.order_count === 1 ? '' : 'es'}
                      {c.last_car_model && ` · ${c.last_car_model}`}
                      {c.last_order_at && ` · ${formatDateShort(c.last_order_at)}`}
                    </span>
                  </span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {c.pending_reminders > 0 && (
                    <span
                      title="Recordatorios pendientes"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#fbbf24',
                      }}
                    >
                      <Bell size={12} />
                      {c.pending_reminders}
                    </span>
                  )}
                  <ChevronDown
                    size={16}
                    style={{
                      color: 'var(--color-text-muted)',
                      transform: estaAbierto ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s',
                    }}
                  />
                </span>
              </button>

              {estaAbierto && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <OpcionBoton
                      activo={seccion === 'recordatorio'}
                      onClick={() => setSeccion(seccion === 'recordatorio' ? null : 'recordatorio')}
                      icono={<Bell size={16} />}
                      texto="Recordatorio"
                    />
                    <OpcionBoton
                      activo={seccion === 'historial'}
                      onClick={() => setSeccion(seccion === 'historial' ? null : 'historial')}
                      icono={<History size={16} />}
                      texto="Historial de órdenes"
                    />
                  </div>
                  {seccion === 'recordatorio' && (
                    <div style={{ marginTop: 12 }}>
                      <ClientReminders clientId={c.id} clientName={nombre} workshopName={workshopName} />
                    </div>
                  )}
                  {seccion === 'historial' && (
                    <div style={{ marginTop: 12 }}>
                      <ClientHistory clientId={c.id} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OpcionBoton({
  activo,
  onClick,
  icono,
  texto,
}: {
  activo: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  texto: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '10px 8px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 700,
        border: `1px solid ${activo ? 'var(--color-brand-400)' : 'var(--color-border)'}`,
        background: activo ? 'rgba(245,158,11,0.15)' : 'var(--color-surface-2)',
        color: activo ? 'var(--color-brand-400)' : 'var(--color-text-secondary)',
        cursor: 'pointer',
      }}
    >
      {icono}
      {texto}
    </button>
  );
}
