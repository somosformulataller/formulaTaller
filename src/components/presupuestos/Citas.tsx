'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Ban, CalendarClock, MessageCircle, Trash2 } from 'lucide-react';
import BuscarCliente from '@/components/presupuestos/BuscarCliente';
import Button from '@/components/ui/Button';
import { openWhatsApp, saludoTaller } from '@/lib/utils';
import { HORAS_CITA, conPunto, estaOcupado, formatCita, formatHora, horaDe, type Cita } from '@/lib/presupuestos';
import type { ClientRow } from '@/lib/types';

export const COLOR_CITA = '#a78bfa';
export const COLOR_OCUPADO = '#f87171';

/** Mensaje de WhatsApp para recordarle la cita al cliente. */
export function mensajeCita(c: Cita, taller: string): string {
  return `${saludoTaller(c.client?.first_name ?? '', taller)} ${conPunto(`Te escribo para confirmar tu cita en el taller el ${formatCita(c.day, c.at_time)}`)} ¡Te esperamos!`;
}

/** Una cita u horario ocupado, con su botón para borrarlo. */
export function FilaCita({
  cita,
  workshopName,
  conFecha,
  onBorrada,
}: {
  cita: Cita;
  workshopName: string;
  /** Mostrar el día (fuera del calendario). */
  conFecha?: boolean;
  onBorrada: (id: string) => void;
}) {
  const [borrando, setBorrando] = useState(false);
  const esCita = cita.kind === 'cita';
  const nombre = cita.client ? `${cita.client.first_name} ${cita.client.last_name}`.trim() : '';
  const cuando = conFecha
    ? formatCita(cita.day, cita.at_time)
    : cita.at_time
    ? formatHora(cita.at_time)
    : esCita
    ? 'Sin hora'
    : 'Todo el día';

  async function borrar() {
    if (!confirm(esCita ? `¿Quitar la cita de ${nombre}?` : '¿Quitar este horario ocupado?')) return;
    setBorrando(true);
    try {
      const res = await fetch(`/api/citas/${cita.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      onBorrada(cita.id);
    } catch {
      alert('No se pudo quitar.');
      setBorrando(false);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid var(--color-border)',
        borderLeft: `4px solid ${esCita ? COLOR_CITA : COLOR_OCUPADO}`,
        background: 'var(--color-surface-2)',
      }}
    >
      {esCita ? (
        <CalendarClock size={16} style={{ color: COLOR_CITA, flexShrink: 0 }} />
      ) : (
        <Ban size={16} style={{ color: COLOR_OCUPADO, flexShrink: 0 }} />
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>
          {cuando} · {esCita ? `Cita: ${nombre || 'cliente'}` : 'Ocupado'}
        </span>
        {(cita.note || cita.quote_id || cita.order_id) && (
          <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {cita.note}
            {cita.order_id ? (
              <>
                {cita.note && ' · '}
                <Link href={`/admin/ordenes/${cita.order_id}`}>Ver orden</Link>
              </>
            ) : cita.quote_id ? (
              <>
                {cita.note && ' · '}
                <Link href={`/admin/presupuestos/enviar/${cita.quote_id}`}>Ver presupuesto</Link>
              </>
            ) : null}
          </span>
        )}
      </span>
      {esCita && cita.client?.whatsapp && (
        <button
          type="button"
          onClick={() => openWhatsApp(cita.client!.whatsapp, mensajeCita(cita, workshopName))}
          aria-label="Avisar por WhatsApp"
          title="Avisar por WhatsApp"
          style={iconBtn('#25d366')}
        >
          <MessageCircle size={15} />
        </button>
      )}
      <button type="button" onClick={borrar} disabled={borrando} aria-label="Quitar" title="Quitar" style={iconBtn('var(--color-text-muted)')}>
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function iconBtn(color: string) {
  return {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  } as const;
}

/** Chips con las horas del día; las ocupadas no se pueden elegir. */
export function Horas({
  dia,
  delDia,
  elegidas,
  onToggle,
}: {
  dia: string;
  delDia: Cita[];
  elegidas: string[];
  onToggle: (h: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 6 }}>
      {HORAS_CITA.map((h) => {
        const ocupada = estaOcupado(delDia, dia, h);
        const citas = delDia.filter((c) => c.kind === 'cita' && horaDe(c.at_time) === horaDe(h)).length;
        const sel = elegidas.includes(h);
        return (
          <button
            key={h}
            type="button"
            disabled={ocupada}
            onClick={() => onToggle(h)}
            style={{
              padding: '8px 4px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
              border: `1px solid ${sel ? 'var(--color-brand-400)' : 'var(--color-border)'}`,
              background: sel ? 'rgba(245,158,11,0.15)' : 'var(--color-surface-2)',
              color: ocupada ? 'var(--color-text-muted)' : sel ? 'var(--color-brand-400)' : 'inherit',
              textDecoration: ocupada ? 'line-through' : 'none',
              cursor: ocupada ? 'not-allowed' : 'pointer',
              opacity: ocupada ? 0.5 : 1,
            }}
          >
            {formatHora(h)}
            {citas > 0 && !ocupada && (
              <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                {citas} cita{citas === 1 ? '' : 's'}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

async function crear(body: Record<string, unknown>): Promise<Cita> {
  const res = await fetch('/api/citas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'No se pudo guardar.');
  return d as Cita;
}

/** Agregar una cita con un cliente del taller. */
export function CitaForm({
  dia,
  delDia,
  clienteId,
  onCreadas,
  onCancel,
}: {
  dia: string;
  delDia: Cita[];
  /** Cliente ya elegido (desde Clientes). */
  clienteId?: string;
  onCreadas: (c: Cita[]) => void;
  onCancel: () => void;
}) {
  const [elegido, setElegido] = useState<ClientRow | null>(null);
  const cliente = clienteId ?? elegido?.id ?? null;
  const [fecha, setFecha] = useState(dia);
  const [hora, setHora] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [citasFecha, setCitasFecha] = useState<Cita[]>(delDia);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si se cambia el día, se piden sus horarios.
  useEffect(() => {
    if (fecha === dia) {
      setCitasFecha(delDia);
      return;
    }
    let vivo = true;
    fetch(`/api/citas?from=${fecha}&to=${fecha}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => vivo && setCitasFecha(d))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [fecha, dia, delDia]);

  const diaOcupado = estaOcupado(citasFecha, fecha, null);

  async function guardar() {
    if (!cliente) return setError('Elige el cliente.');
    if (diaOcupado) return setError('Ese día está marcado como ocupado.');
    setGuardando(true);
    setError(null);
    try {
      onCreadas([await crear({ kind: 'cita', client_id: cliente, day: fecha, at_time: hora, note: nota })]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
      setGuardando(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!clienteId && (
        <div className="form-field">
          <label className="form-label">Cliente</label>
          {elegido ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>
                {`${elegido.first_name} ${elegido.last_name}`.trim()}
                {elegido.last_car_model && ` · ${elegido.last_car_model}`}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setElegido(null)}>
                Cambiar
              </Button>
            </div>
          ) : (
            <BuscarCliente onElegir={setElegido} />
          )}
        </div>
      )}
      <div className="form-field">
        <label className="form-label" htmlFor="cita-fecha">
          Día
        </label>
        <input
          id="cita-fecha"
          type="date"
          className="form-input"
          value={fecha}
          onChange={(e) => {
            setFecha(e.target.value);
            setHora(null);
          }}
        />
      </div>
      {diaOcupado ? (
        <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>Este día está marcado como ocupado.</p>
      ) : (
        <div className="form-field">
          <label className="form-label">Hora (opcional)</label>
          <Horas dia={fecha} delDia={citasFecha} elegidas={hora ? [hora] : []} onToggle={(h) => setHora(hora === h ? null : h)} />
        </div>
      )}
      <div className="form-field">
        <label className="form-label" htmlFor="cita-nota">
          Nota (opcional)
        </label>
        <input id="cita-nota" className="form-input" maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} />
      </div>
      {error && <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <Button type="button" variant="secondary" fullWidth onClick={onCancel} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="button" variant="primary" fullWidth loading={guardando} onClick={guardar}>
          Agendar cita
        </Button>
      </div>
    </div>
  );
}

/** Marcar un día completo o algunas horas como ocupados. */
export function OcupadoForm({
  dia,
  delDia,
  onCreadas,
  onCancel,
}: {
  dia: string;
  delDia: Cita[];
  onCreadas: (c: Cita[]) => void;
  onCancel: () => void;
}) {
  const [todoElDia, setTodoElDia] = useState(true);
  const [horas, setHoras] = useState<string[]>([]);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const citasEseDia = delDia.filter((c) => c.kind === 'cita').length;

  async function guardar() {
    if (!todoElDia && horas.length === 0) return setError('Elige al menos una hora.');
    setGuardando(true);
    setError(null);
    try {
      const lista = todoElDia ? [null] : [...horas].sort();
      const creadas: Cita[] = [];
      for (const h of lista) creadas.push(await crear({ kind: 'ocupado', day: dia, at_time: h, note: nota }));
      onCreadas(creadas);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
      setGuardando(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 13.5, fontWeight: 700, textTransform: 'capitalize' }}>{formatCita(dia, null)}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => setTodoElDia(v)}
            style={{
              padding: '10px 8px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              border: `1px solid ${todoElDia === v ? 'var(--color-brand-400)' : 'var(--color-border)'}`,
              background: todoElDia === v ? 'rgba(245,158,11,0.15)' : 'var(--color-surface-2)',
              color: todoElDia === v ? 'var(--color-brand-400)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            {v ? 'Todo el día' : 'Algunas horas'}
          </button>
        ))}
      </div>
      {!todoElDia && (
        <Horas
          dia={dia}
          delDia={delDia}
          elegidas={horas}
          onToggle={(h) => setHoras((p) => (p.includes(h) ? p.filter((x) => x !== h) : [...p, h]))}
        />
      )}
      {citasEseDia > 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
          Ya hay {citasEseDia} cita{citasEseDia === 1 ? '' : 's'} este día; no se borran.
        </p>
      )}
      <div className="form-field">
        <label className="form-label" htmlFor="ocupado-nota">
          Motivo (opcional)
        </label>
        <input
          id="ocupado-nota"
          className="form-input"
          placeholder="Feriado, inventario…"
          maxLength={500}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
      </div>
      {error && <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <Button type="button" variant="secondary" fullWidth onClick={onCancel} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="button" variant="primary" fullWidth loading={guardando} onClick={guardar}>
          Marcar ocupado
        </Button>
      </div>
    </div>
  );
}
