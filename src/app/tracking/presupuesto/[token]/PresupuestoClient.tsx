'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, CheckCheck, ChevronLeft, ChevronRight, ClipboardList, X } from 'lucide-react';
import CabeceraTaller from '@/components/tracking/CabeceraTaller';
import { formatUsd } from '@/lib/budget';
import { hoyVE } from '@/lib/recordatorios';
import { HORAS_CITA, formatCita, formatHora, horaVE, totalQuote } from '@/lib/presupuestos';
import type { PresupuestoPublico } from '@/lib/presupuesto-publico';

const VERDE = '#10b981';
const ROJO = '#ef4444';
const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
/** Hasta cuántos días adelante puede elegir el cliente. */
const DIAS_ADELANTE = 60;

type Respuesta = { presupuesto?: 'aprobado' | 'rechazado'; cita?: 'confirmada' | 'rechazada'; elegir?: { day: string; at_time: string } };

/**
 * El presupuesto suelto en el enlace del cliente (0030): lo aprueba o lo
 * rechaza y, según lo que decidió el taller, escoge el día y la hora de su
 * cita o acepta la que le pusieron. «Aceptar todo» responde todo de una vez.
 */
export default function PresupuestoClient({ inicial }: { inicial: PresupuestoPublico }) {
  const [p, setP] = useState(inicial);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Elegir la cita (solo si el taller lo permite).
  const [cambiando, setCambiando] = useState(!inicial.cita);
  const [dia, setDia] = useState('');
  const [hora, setHora] = useState('');

  const cerrado = Boolean(p.orderToken);
  const total = totalQuote(p.items, p.labor_general_usd);
  const eligeCliente = p.client_picks_date;
  const citaPendiente = !eligeCliente && p.cita !== null && p.cita.status === 'pendiente';
  const faltaElegir = eligeCliente && (!p.cita || cambiando);
  const hayPendiente = p.client_decision !== 'aprobado' || citaPendiente || (eligeCliente && !p.cita);

  async function responder(cuerpo: Respuesta, clave: string, gracias?: string) {
    setError(null);
    setAviso(null);
    setOcupado(clave);
    try {
      const res = await fetch(`/api/tracking/presupuesto/${p.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar tu respuesta');
      setP(data as PresupuestoPublico);
      if (cuerpo.elegir) {
        setCambiando(false);
        setDia('');
        setHora('');
      }
      setAviso(gracias ?? 'Listo, el taller ya recibió tu respuesta.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar tu respuesta');
    } finally {
      setOcupado(null);
    }
  }

  function aceptarTodo() {
    const cuerpo: Respuesta = {};
    if (p.client_decision !== 'aprobado') cuerpo.presupuesto = 'aprobado';
    if (citaPendiente) cuerpo.cita = 'confirmada';
    if (faltaElegir) {
      if (!dia || !hora) {
        setError('Elige arriba el día y la hora de tu cita.');
        return;
      }
      cuerpo.elegir = { day: dia, at_time: hora };
    }
    responder(cuerpo, 'todo', '¡Gracias! El taller ya recibió tu respuesta.');
  }

  const nombre = `${p.client_first_name}`.trim();

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'radial-gradient(ellipse at top, rgba(245,158,11,0.06) 0%, transparent 50%), var(--color-bg)',
        padding: '24px 16px 40px',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <CabeceraTaller
        nombre={p.workshop.name}
        logoUrl={p.workshop.logo_url}
        color={p.workshop.brand_color}
        color2={p.workshop.brand_color_2}
        etiqueta="Presupuesto"
      />

      <div className="animate-fade-in" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.25 }}>
          {nombre ? `Hola ${nombre},` : 'Hola,'} este es tu presupuesto
        </h1>
        {p.car_model && (
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 4 }}>Para tu {p.car_model}</p>
        )}
      </div>

      {cerrado && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 14, fontWeight: 600 }}>Tu carro ya está en el taller. Ahí puedes ver cómo va el trabajo.</p>
          <a href={`/tracking/${p.orderToken}`} className="btn btn-primary btn-full" style={{ textDecoration: 'none' }}>
            <ClipboardList size={16} />
            Ver el seguimiento
          </a>
        </div>
      )}

      {/* Presupuesto */}
      <div className="card" style={{ marginBottom: 16 }}>
        <Titulo texto="Presupuesto" estado={estadoPresupuesto(p.client_decision)} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {p.items.map((i, n) => (
            <div
              key={n}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-2)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>{i.description}</p>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                  Repuesto o servicio {formatUsd(i.amount)}
                  {i.labor_amount > 0 && <> · Mano de obra {formatUsd(i.labor_amount)}</>}
                </p>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {formatUsd((Math.round(i.amount * 100) + Math.round(i.labor_amount * 100)) / 100)}
              </span>
            </div>
          ))}
          {p.labor_general_usd > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-2)',
              }}
            >
              <div>
                <p style={{ fontSize: 14, fontWeight: 600 }}>Mano de obra</p>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 3 }}>Por todos los servicios</p>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>{formatUsd(p.labor_general_usd)}</span>
            </div>
          )}
          {p.items.length === 0 && p.labor_general_usd === 0 && (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>El taller todavía no agregó servicios.</p>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <span style={{ fontWeight: 700 }}>Total</span>
          <span style={{ fontSize: 20, fontWeight: 800 }}>{formatUsd(total)}</span>
        </div>
        {!cerrado && (
          <Decision
            si="Aprobar presupuesto"
            no="Rechazar"
            actual={p.client_decision === 'aprobado' ? 'si' : p.client_decision === 'rechazado' ? 'no' : null}
            ocupado={ocupado}
            clave="presupuesto"
            onSi={() => responder({ presupuesto: 'aprobado' }, 'presupuesto-si')}
            onNo={() => {
              if (confirm('¿Seguro que quieres rechazar el presupuesto?')) responder({ presupuesto: 'rechazado' }, 'presupuesto-no');
            }}
          />
        )}
      </div>

      {/* Cita */}
      {((eligeCliente && !cerrado) || p.cita) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <Titulo
            texto="Tu cita en el taller"
            icono
            estado={p.cita ? estadoCita(p.cita.status) : { texto: 'Por elegir', color: 'var(--color-text-muted)' }}
          />
          {p.cita && !(eligeCliente && cambiando) && (
            <p style={{ fontSize: 16, fontWeight: 700, marginTop: 10 }}>
              {mayuscula(formatCita(p.cita.day, p.cita.at_time))}
            </p>
          )}

          {!eligeCliente && p.cita && !cerrado && (
            <>
              {p.cita.status === 'rechazada' && (
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6 }}>
                  Le avisamos al taller. Te escribirán para buscar otro día.
                </p>
              )}
              <Decision
                si="Aceptar cita"
                no="Rechazar"
                actual={p.cita.status === 'confirmada' ? 'si' : p.cita.status === 'rechazada' ? 'no' : null}
                ocupado={ocupado}
                clave="cita"
                onSi={() => responder({ cita: 'confirmada' }, 'cita-si')}
                onNo={() => responder({ cita: 'rechazada' }, 'cita-no')}
              />
            </>
          )}

          {eligeCliente && !cerrado && (
            <>
              {p.cita && !cambiando && (
                <button
                  type="button"
                  onClick={() => setCambiando(true)}
                  className="btn btn-secondary btn-full"
                  style={{ marginTop: 12 }}
                >
                  Cambiar día u hora
                </button>
              )}
              {cambiando && (
                <ElegirCita
                  token={p.token}
                  dia={dia}
                  hora={hora}
                  onDia={(d) => (setDia(d), setHora(''))}
                  onHora={setHora}
                />
              )}
              {cambiando && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {p.cita && (
                    <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => (setCambiando(false), setDia(''), setHora(''))}>
                      Cancelar
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 2 }}
                    disabled={!dia || !hora || ocupado !== null}
                    onClick={() => responder({ elegir: { day: dia, at_time: hora } }, 'elegir', '¡Listo! Tu cita quedó agendada.')}
                  >
                    {ocupado === 'elegir' ? 'Guardando…' : 'Agendar cita'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {aviso && (
        <p style={{ fontSize: 13.5, color: '#34d399', fontWeight: 600, textAlign: 'center', marginBottom: 12 }}>{aviso}</p>
      )}
      {error && <p style={{ color: 'var(--color-danger)', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{error}</p>}

      {!cerrado && hayPendiente && (
        <button
          type="button"
          disabled={ocupado !== null}
          onClick={aceptarTodo}
          style={{
            width: '100%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '14px 16px',
            borderRadius: 12,
            border: 'none',
            background: VERDE,
            color: '#fff',
            fontSize: 15,
            fontWeight: 800,
            cursor: ocupado ? 'wait' : 'pointer',
          }}
        >
          <CheckCheck size={18} />
          {ocupado === 'todo' ? 'Guardando…' : p.cita || eligeCliente ? 'Aceptar presupuesto y cita' : 'Aceptar presupuesto'}
        </button>
      )}
    </div>
  );
}

function estadoPresupuesto(d: PresupuestoPublico['client_decision']) {
  return d === 'aprobado'
    ? { texto: 'Aprobado', color: '#34d399' }
    : d === 'rechazado'
    ? { texto: 'Rechazado', color: '#f87171' }
    : { texto: 'Por decidir', color: '#fbbf24' };
}

function estadoCita(s: 'pendiente' | 'confirmada' | 'rechazada') {
  return s === 'confirmada'
    ? { texto: 'Confirmada', color: '#34d399' }
    : s === 'rechazada'
    ? { texto: 'Rechazada', color: '#f87171' }
    : { texto: 'Por confirmar', color: '#fbbf24' };
}

function Titulo({ texto, estado, icono }: { texto: string; estado: { texto: string; color: string }; icono?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <p
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
        }}
      >
        {icono && <CalendarClock size={14} />}
        {texto}
      </p>
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          padding: '3px 10px',
          borderRadius: 999,
          color: estado.color,
          border: `1px solid ${estado.color}`,
          whiteSpace: 'nowrap',
        }}
      >
        {estado.texto}
      </span>
    </div>
  );
}

function Decision({
  si,
  no,
  actual,
  ocupado,
  clave,
  onSi,
  onNo,
}: {
  si: string;
  no: string;
  actual: 'si' | 'no' | null;
  ocupado: string | null;
  clave: string;
  onSi: () => void;
  onNo: () => void;
}) {
  const boton = (tipo: 'si' | 'no') => {
    const activo = actual === tipo;
    const color = tipo === 'si' ? VERDE : ROJO;
    const Icono = tipo === 'si' ? Check : X;
    return (
      <button
        type="button"
        onClick={tipo === 'si' ? onSi : onNo}
        disabled={ocupado !== null || activo}
        aria-pressed={activo}
        style={{
          flex: tipo === 'si' ? 2 : 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '10px 12px',
          borderRadius: 10,
          border: `1px solid ${activo ? color : 'var(--color-border)'}`,
          background: activo ? color : 'var(--color-surface)',
          color: activo ? '#fff' : color,
          fontSize: 13.5,
          fontWeight: 700,
          cursor: ocupado !== null || activo ? 'default' : 'pointer',
          opacity: ocupado === `${clave}-${tipo}` ? 0.6 : 1,
        }}
      >
        <Icono size={16} strokeWidth={2.5} />
        {activo ? (tipo === 'si' ? 'Aceptado' : 'Rechazado') : tipo === 'si' ? si : no}
      </button>
    );
  };
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      {boton('si')}
      {boton('no')}
    </div>
  );
}

function mayuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** «AAAA-MM-DD» de un Date en UTC (los días se arman a mediodía UTC). */
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Calendario del mes y horas libres del día elegido. */
function ElegirCita({
  token,
  dia,
  hora,
  onDia,
  onHora,
}: {
  token: string;
  dia: string;
  hora: string;
  onDia: (d: string) => void;
  onHora: (h: string) => void;
}) {
  const hoy = hoyVE();
  const limite = useMemo(() => {
    const [y, m, d] = hoy.split('-').map(Number);
    return iso(new Date(Date.UTC(y, m - 1, d + DIAS_ADELANTE, 12)));
  }, [hoy]);
  const [mes, setMes] = useState(() => hoy.slice(0, 7));
  const [libres, setLibres] = useState<{ todo: boolean; horas: string[] } | null>(null);

  useEffect(() => {
    if (!dia) return setLibres(null);
    let vivo = true;
    setLibres(null);
    fetch(`/api/tracking/presupuesto/${token}?dia=${dia}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { todo: false, horas: [] }))
      .then((d) => vivo && setLibres(d))
      .catch(() => vivo && setLibres({ todo: false, horas: [] }));
    return () => {
      vivo = false;
    };
  }, [dia, token]);

  const [y, m] = mes.split('-').map(Number);
  const primero = new Date(Date.UTC(y, m - 1, 1, 12));
  const enMes = new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
  const hueco = (primero.getUTCDay() + 6) % 7; // lunes primero
  const celdas: Array<string | null> = [
    ...Array.from({ length: hueco }, () => null),
    ...Array.from({ length: enMes }, (_, i) => iso(new Date(Date.UTC(y, m - 1, i + 1, 12)))),
  ];
  const titulo = new Intl.DateTimeFormat('es-VE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(primero);
  const mover = (n: number) => setMes(iso(new Date(Date.UTC(y, m - 1 + n, 1, 12))).slice(0, 7));
  const puedeAtras = mes > hoy.slice(0, 7);
  const puedeAdelante = mes < limite.slice(0, 7);
  const ahora = horaVE();

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 10 }}>
        Escoge el día y la hora en que puedes traer tu carro.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!puedeAtras} onClick={() => mover(-1)} aria-label="Mes anterior">
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{mayuscula(titulo)}</span>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!puedeAdelante} onClick={() => mover(1)} aria-label="Mes siguiente">
          <ChevronRight size={16} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {DIAS_SEMANA.map((d, i) => (
          <span key={i} style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', color: 'var(--color-text-muted)', paddingBottom: 2 }}>
            {d}
          </span>
        ))}
        {celdas.map((c, i) => {
          if (!c) return <span key={i} />;
          const fuera = c < hoy || c > limite;
          const sel = c === dia;
          return (
            <button
              key={i}
              type="button"
              disabled={fuera}
              onClick={() => onDia(c)}
              style={{
                aspectRatio: '1',
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: sel || c === hoy ? 800 : 600,
                border: `1px solid ${sel ? 'var(--color-brand-400)' : 'var(--color-border)'}`,
                background: sel ? 'var(--color-brand-400)' : 'var(--color-surface-2)',
                color: sel ? '#0D0F1A' : fuera ? 'var(--color-text-muted)' : 'inherit',
                opacity: fuera ? 0.35 : 1,
                cursor: fuera ? 'default' : 'pointer',
              }}
            >
              {Number(c.slice(8))}
            </button>
          );
        })}
      </div>

      {dia && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{mayuscula(formatCita(dia, null))}</p>
          {!libres ? (
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>Buscando horas libres…</p>
          ) : libres.todo ? (
            <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>El taller no atiende este día. Elige otro.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 6 }}>
              {HORAS_CITA.map((h) => {
                const no = libres.horas.includes(h) || (dia === hoy && h.slice(0, 2) <= ahora);
                const sel = h === hora;
                return (
                  <button
                    key={h}
                    type="button"
                    disabled={no}
                    onClick={() => onHora(h)}
                    style={{
                      padding: '9px 4px',
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 700,
                      border: `1px solid ${sel ? 'var(--color-brand-400)' : 'var(--color-border)'}`,
                      background: sel ? 'rgba(245,158,11,0.15)' : 'var(--color-surface-2)',
                      color: no ? 'var(--color-text-muted)' : sel ? 'var(--color-brand-400)' : 'inherit',
                      textDecoration: no ? 'line-through' : 'none',
                      opacity: no ? 0.45 : 1,
                      cursor: no ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {formatHora(h)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
