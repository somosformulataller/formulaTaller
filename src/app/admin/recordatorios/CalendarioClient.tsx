'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import ReminderCard from '@/components/reminders/ReminderCard';
import Modal from '@/components/ui/Modal';
import ReminderForm from '@/components/reminders/ReminderForm';
import type { Reminder } from '@/lib/types';
import { TAG_COLOR_HEX, formatDia, hoyVE } from '@/lib/recordatorios';

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Calendario general: el mes con un punto de color por cada recordatorio
 * (el color de su etiqueta). Al tocar un día se ven sus recordatorios.
 * Hecho a mano, sin librería, para no sumarle peso a la app.
 */
export default function CalendarioClient({
  workshopName,
  iniciales,
}: {
  workshopName: string;
  /** Los recordatorios del mes actual, leídos con la página (`mes` = AAAA-MM). */
  iniciales?: { mes: string; lista: Reminder[] };
}) {
  const hoy = hoyVE();
  const [ano, setAno] = useState(Number(hoy.slice(0, 4)));
  const [mes, setMes] = useState(Number(hoy.slice(5, 7)) - 1);
  const [dia, setDia] = useState<string>(hoy);
  // Meses ya vistos: volver a uno se muestra al instante y se actualiza detrás.
  const cache = useRef(new Map<string, Reminder[]>(iniciales ? [[iniciales.mes, iniciales.lista]] : []));
  const recienLlegado = useRef(Boolean(iniciales));
  const mesVisible = useRef('');
  const [lista, setLista] = useState<Reminder[] | null>(
    cache.current.get(iso(ano, mes, 1).slice(0, 7)) ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Reminder | null>(null);

  const diasDelMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  // Lunes = 0 … domingo = 6
  const primero = (new Date(Date.UTC(ano, mes, 1)).getUTCDay() + 6) % 7;

  const cargar = useCallback(async () => {
    const clave = iso(ano, mes, 1).slice(0, 7);
    mesVisible.current = clave;
    setError(null);
    setLista(cache.current.get(clave) ?? null);
    try {
      const res = await fetch(
        `/api/reminders?from=${iso(ano, mes, 1)}&to=${iso(ano, mes, diasDelMes)}`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error('No se pudieron cargar los recordatorios');
      const data: Reminder[] = await res.json();
      cache.current.set(clave, data);
      // Si ya se cambió de mes mientras llegaba, no pisar lo que se ve.
      if (mesVisible.current === clave) setLista(data);
    } catch (e) {
      if (!cache.current.has(clave)) setError(e instanceof Error ? e.message : 'Error al cargar');
    }
  }, [ano, mes, diasDelMes]);

  useEffect(() => {
    // El mes actual ya vino con la página: no pedirlo otra vez al abrir.
    if (recienLlegado.current) {
      recienLlegado.current = false;
      return;
    }
    cargar();
  }, [cargar]);

  const porDia = useMemo(() => {
    const m = new Map<string, Reminder[]>();
    for (const r of lista ?? []) {
      const l = m.get(r.due_date);
      if (l) l.push(r);
      else m.set(r.due_date, [r]);
    }
    return m;
  }, [lista]);

  function moverMes(delta: number) {
    const f = new Date(Date.UTC(ano, mes + delta, 1));
    setAno(f.getUTCFullYear());
    setMes(f.getUTCMonth());
    setDia(iso(f.getUTCFullYear(), f.getUTCMonth(), 1));
  }

  function actualizar(r: Reminder) {
    setLista((prev) => (prev ?? []).map((x) => (x.id === r.id ? r : x)).filter((x) => x.due_date.slice(0, 7) === iso(ano, mes, 1).slice(0, 7)));
    setEditando(null);
  }

  const nombreMes = new Intl.DateTimeFormat('es-VE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(ano, mes, 15))
  );
  const delDia = porDia.get(dia) ?? [];

  return (
    <div className="animate-fade-in" style={{ paddingTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Recordatorios</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Toca un día para ver sus recordatorios.
          </p>
        </div>
        <Link
          href="/admin/clientes"
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
          <Users size={15} />
          Clientes
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button type="button" onClick={() => moverMes(-1)} aria-label="Mes anterior" style={navBtn}>
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, textTransform: 'capitalize' }}>{nombreMes}</span>
          <button type="button" onClick={() => moverMes(1)} aria-label="Mes siguiente" style={navBtn}>
            <ChevronRight size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {DIAS.map((d, i) => (
            <span key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', paddingBottom: 4 }}>
              {d}
            </span>
          ))}
          {Array.from({ length: primero }).map((_, i) => (
            <span key={`v${i}`} />
          ))}
          {Array.from({ length: diasDelMes }).map((_, i) => {
            const fecha = iso(ano, mes, i + 1);
            const rs = porDia.get(fecha) ?? [];
            const sel = fecha === dia;
            const esHoy = fecha === hoy;
            return (
              <button
                key={fecha}
                type="button"
                onClick={() => setDia(fecha)}
                aria-label={`${formatDia(fecha)}: ${rs.length} recordatorio${rs.length === 1 ? '' : 's'}`}
                style={{
                  aspectRatio: '1 / 1',
                  minHeight: 40,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  borderRadius: 8,
                  border: `1px solid ${sel ? 'var(--color-brand-400)' : esHoy ? 'var(--color-border)' : 'transparent'}`,
                  background: sel ? 'rgba(245,158,11,0.15)' : 'transparent',
                  color: sel ? 'var(--color-brand-400)' : 'inherit',
                  fontSize: 13,
                  fontWeight: esHoy || sel ? 800 : 500,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {i + 1}
                <span style={{ display: 'flex', gap: 2, height: 6 }}>
                  {rs.slice(0, 4).map((r) => (
                    <span
                      key={r.id}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: r.tag ? TAG_COLOR_HEX[r.tag.color] : TAG_COLOR_HEX.neutral,
                        opacity: r.status === 'hecho' ? 0.35 : 1,
                      }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, textTransform: 'capitalize' }}>{formatDia(dia)}</h2>
      {error && <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>}
      {!lista && !error && <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Cargando…</p>}
      {lista && delDia.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          No hay recordatorios este día. Se agregan desde <Link href="/admin/clientes">Clientes</Link> o desde la orden.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {delDia.map((r) => (
          <ReminderCard
            key={r.id}
            reminder={r}
            workshopName={workshopName}
            mostrarCliente
            onChanged={actualizar}
            onDeleted={(id) => setLista((prev) => (prev ?? []).filter((x) => x.id !== id))}
            onEdit={setEditando}
          />
        ))}
      </div>

      {editando && (
        <Modal isOpen onClose={() => setEditando(null)} title="Editar recordatorio">
          <ReminderForm
            clientId={editando.client_id}
            reminder={editando}
            onSaved={actualizar}
            onCancel={() => setEditando(null)}
          />
        </Modal>
      )}
    </div>
  );
}

const navBtn = {
  width: 36,
  height: 36,
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-2)',
  color: 'var(--color-text-secondary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
} as const;
