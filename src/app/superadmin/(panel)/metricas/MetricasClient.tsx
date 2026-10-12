'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, ClipboardList, Sparkles, Clock, RefreshCw, ChevronDown, ExternalLink } from 'lucide-react';
import { openWhatsApp } from '@/lib/utils';
import { waNumber } from '@/lib/whatsapp';

export interface Dia {
  dia: string; // 2026-10-12
  ordenes: number;
  activos: number;
  nuevos: number;
}

export interface FilaOrden {
  id: string;
  workshop_id: string;
  /** #1 es la primera orden que creó el taller. */
  numero: number;
  total: number;
  created_at: string;
  cliente: string;
  carro: string;
  status: string;
  taller: string;
  dueno: string | null;
  whatsapp: string | null;
}

export interface FilaTaller {
  id: string;
  taller: string;
  dueno: string | null;
  whatsapp: string | null;
  registrado: string;
  total: number;
  primera: FilaOrden;
  ultima: string;
}

const RANGOS = [7, 15, 30] as const;
const POR_PAGINA = 20;
/** Al volver a la pestaña solo se recalcula si los datos tienen más de 5 min. */
const VIEJO_MS = 5 * 60 * 1000;

const ESTADO: Record<string, string> = {
  sin_mecanico: 'Sin mecánico',
  con_mecanico: 'En el taller',
  lista: 'Lista',
};

function fechaHora(iso: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

const primerNombre = (n: string | null) => (n ?? '').trim().split(/\s+/)[0] ?? '';

export default function MetricasClient({
  dias,
  ultimas,
  historial,
  primeras,
  inactivos,
  inactivoDias,
}: {
  dias: Dia[];
  ultimas: FilaOrden[];
  historial: Record<string, FilaOrden[]>;
  primeras: FilaTaller[];
  inactivos: FilaTaller[];
  inactivoDias: number;
}) {
  const [rango, setRango] = useState<(typeof RANGOS)[number]>(7);
  const [tab, setTab] = useState<'ultimas' | 'primeras' | 'inactivos'>('ultimas');
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const serie = dias.slice(-rango);
  const router = useRouter();

  const [cargando, startTransition] = useTransition();
  const [actualizado, setActualizado] = useState(() => Date.now());
  const actualizadoRef = useRef(actualizado);

  // Llegaron datos nuevos del servidor.
  useEffect(() => {
    const ahora = Date.now();
    actualizadoRef.current = ahora;
    setActualizado(ahora);
  }, [dias]);

  // Sin intervalos: cada recálculo trae todas las órdenes, así que solo se pide
  // al tocar «Actualizar» o al volver a la pestaña si los datos tienen más de
  // 5 min. router.refresh() no pierde el rango, la lista ni el «Ver más».
  const refrescar = () => startTransition(() => router.refresh());
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible' && Date.now() - actualizadoRef.current > VIEJO_MS) {
        actualizadoRef.current = Date.now();
        startTransition(() => router.refresh());
      }
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [router]);

  function escribir(whatsapp: string | null, texto: string) {
    const num = waNumber(whatsapp);
    if (!num) {
      alert('Este taller no tiene un número de WhatsApp válido.');
      return;
    }
    openWhatsApp(num, texto);
  }

  const TABS = [
    { key: 'ultimas', label: 'Últimas órdenes', n: ultimas.length, icon: ClipboardList },
    { key: 'primeras', label: 'Primera orden', n: primeras.length, icon: Sparkles },
    { key: 'inactivos', label: `${inactivoDias}+ días sin órdenes`, n: inactivos.length, icon: Clock },
  ] as const;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '20px 16px 96px' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Métricas</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 2 }}>
            Actividad de los talleres (sin los de prueba), en hora de Venezuela. Actualizado a las{' '}
            {new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: 'numeric', minute: '2-digit' }).format(actualizado)}.
          </p>
        </div>
        <button
          onClick={refrescar}
          disabled={cargando}
          className="btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', fontSize: 13, flexShrink: 0 }}
        >
          <RefreshCw size={14} style={cargando ? { animation: 'spin 1s linear infinite' } : undefined} />
          {cargando ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {/* Rango de las gráficas */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {RANGOS.map((r) => (
          <button
            key={r}
            onClick={() => setRango(r)}
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              border: `1px solid ${rango === r ? 'var(--color-brand-500)' : 'var(--color-border)'}`,
              background: rango === r ? 'rgba(245,158,11,0.15)' : 'var(--color-surface-2)',
              color: rango === r ? 'var(--color-brand-400)' : 'var(--color-text-secondary)',
            }}
          >
            Últimos {r} días
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        <Grafica titulo="📋 Órdenes creadas por día" serie={serie} campo="ordenes" />
        <Grafica titulo="🔧 Usuarios activos por día" ayuda="Talleres que crearon al menos una orden ese día." serie={serie} campo="activos" />
        <Grafica titulo="🆕 Usuarios nuevos por día" ayuda="Talleres que se registraron ese día." serie={serie} campo="nuevos" />
      </div>

      {/* Listas para seguimiento */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const activo = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setVisibles(POR_PAGINA);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
                padding: '8px 12px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                border: `1px solid ${activo ? 'var(--color-brand-500)' : 'var(--color-border)'}`,
                background: activo ? 'rgba(245,158,11,0.15)' : 'var(--color-surface-2)',
                color: activo ? 'var(--color-brand-400)' : 'var(--color-text-secondary)',
              }}
            >
              <Icon size={15} />
              {t.label} ({t.n})
            </button>
          );
        })}
      </div>

      <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginBottom: 10 }}>
        {tab === 'ultimas' && 'Las órdenes más recientes, para ver quién está usando la herramienta.'}
        {tab === 'primeras' && 'Talleres que ya crearon su primera orden, de la más reciente a la más vieja.'}
        {tab === 'inactivos' &&
          `Talleres que crearon al menos una orden y llevan ${inactivoDias} días o más sin crear otra. Los que nunca crearon una no salen aquí.`}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tab === 'ultimas' &&
          ultimas.slice(0, visibles).map((o) => (
            <div key={o.id} className="card">
              <Encabezado taller={o.taller} dueno={o.dueno} whatsapp={o.whatsapp} />
              <Orden o={o} />
              <VerOrdenes ordenes={historial[o.workshop_id] ?? []} />
              <BotonWa
                onClick={() =>
                  escribir(
                    o.whatsapp,
                    `Hola${o.dueno ? ` ${primerNombre(o.dueno)}` : ''}, te escribo de Formula Taller. Vimos que estás usando la app en ${o.taller}. ¿Cómo te ha ido? ¿Te podemos ayudar en algo?`
                  )
                }
              />
            </div>
          ))}

        {tab === 'primeras' &&
          primeras.slice(0, visibles).map((f) => (
            <div key={f.id} className="card">
              <Encabezado taller={f.taller} dueno={f.dueno} whatsapp={f.whatsapp} />
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3 }}>
                Se registró el {fechaHora(f.registrado)} · {f.total} {f.total === 1 ? 'orden' : 'órdenes'} en total
              </p>
              <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-muted)', marginTop: 10 }}>PRIMERA ORDEN</p>
              <Orden o={f.primera} />
              <VerOrdenes ordenes={historial[f.id] ?? []} />
              <BotonWa
                onClick={() =>
                  escribir(
                    f.whatsapp,
                    `Hola${f.dueno ? ` ${primerNombre(f.dueno)}` : ''}, te escribo de Formula Taller. ¡Vimos que creaste tu primera orden en ${f.taller}! ¿Cómo te fue? ¿Tienes alguna duda o algo que podamos mejorar?`
                  )
                }
              />
            </div>
          ))}

        {tab === 'inactivos' &&
          inactivos.slice(0, visibles).map((f) => {
            const n = diasDesde(f.ultima);
            return (
              <div key={f.id} className="card">
                <Encabezado taller={f.taller} dueno={f.dueno} whatsapp={f.whatsapp} />
                <p style={{ fontSize: 13, marginTop: 6 }}>
                  <span style={{ color: '#f87171', fontWeight: 700 }}>
                    {n} {n === 1 ? 'día' : 'días'} sin crear órdenes
                  </span>
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {' '}
                    · última el {fechaHora(f.ultima)} · {f.total} {f.total === 1 ? 'orden' : 'órdenes'} en total
                  </span>
                </p>
                <VerOrdenes ordenes={historial[f.id] ?? []} />
                <BotonWa
                  onClick={() =>
                    escribir(
                      f.whatsapp,
                      `Hola${f.dueno ? ` ${primerNombre(f.dueno)}` : ''}, te escribo de Formula Taller. Vimos que hace unos días no creas órdenes en ${f.taller}. ¿Nos cuentas por qué dejaste de usar la app? Tu opinión nos ayuda mucho a mejorar.`
                    )
                  }
                />
              </div>
            );
          })}

        {(tab === 'ultimas' ? ultimas : tab === 'primeras' ? primeras : inactivos).length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, padding: 24 }}>No hay nadie aquí por ahora.</p>
        )}

        {(tab === 'ultimas' ? ultimas : tab === 'primeras' ? primeras : inactivos).length > visibles && (
          <button
            onClick={() => setVisibles((v) => v + POR_PAGINA)}
            className="btn-secondary"
            style={{ alignSelf: 'center', padding: '8px 16px', fontSize: 13 }}
          >
            Ver más
          </button>
        )}
      </div>
    </div>
  );
}

function Grafica({
  titulo,
  ayuda,
  serie,
  campo,
}: {
  titulo: string;
  ayuda?: string;
  serie: Dia[];
  campo: 'ordenes' | 'activos' | 'nuevos';
}) {
  const max = Math.max(1, ...serie.map((d) => d[campo]));
  const total = serie.reduce((s, d) => s + d[campo], 0);
  const ALTO = 140;
  const ancho = serie.length > 15 ? 26 : 40;

  return (
    <div className="card" style={{ padding: '16px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>
          {titulo} <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>(últimos {serie.length} días)</span>
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
          Total: <b style={{ color: 'var(--color-brand-400)' }}>{total}</b>
        </span>
      </div>
      {ayuda && <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>{ayuda}</p>}

      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, minWidth: serie.length * (ancho + 6) }}>
          {serie.map((d) => {
            const v = d[campo];
            const h = Math.max(4, Math.round((v / max) * ALTO));
            return (
              <div key={d.dia} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: serie.length > 15 ? 10.5 : 13, fontWeight: 800, color: 'var(--color-text-secondary)' }}>{v}</span>
                <div
                  title={`${d.dia.slice(8)}/${d.dia.slice(5, 7)}: ${v}`}
                  style={{
                    width: '100%',
                    height: h,
                    borderRadius: '6px 6px 2px 2px',
                    background: 'linear-gradient(180deg, #fde047, #d4a017)',
                  }}
                />
                <span style={{ fontSize: serie.length > 15 ? 9.5 : 11.5, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                  {d.dia.slice(8)}/{d.dia.slice(5, 7)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Encabezado({ taller, dueno, whatsapp }: { taller: string; dueno: string | null; whatsapp: string | null }) {
  return (
    <>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{taller}</div>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 12.5, marginTop: 2 }}>
        {dueno ? `${dueno} · ` : ''}
        {whatsapp ?? 'Sin teléfono'}
      </p>
    </>
  );
}

function Orden({ o }: { o: FilaOrden }) {
  return (
    <div
      style={{
        marginTop: 8,
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 800,
            padding: '2px 7px',
            borderRadius: 999,
            background: 'rgba(245,158,11,0.15)',
            color: 'var(--color-brand-400)',
          }}
        >
          #{o.numero} de {o.total}
        </span>
        <span style={{ fontWeight: 600 }}>
          {o.carro || 'Sin modelo'} · {o.cliente || 'Sin nombre'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', color: 'var(--color-text-muted)', fontSize: 12, marginTop: 3 }}>
        <span>
          {fechaHora(o.created_at)} · {ESTADO[o.status] ?? o.status}
        </span>
        <a
          href={`/superadmin/talleres/${o.workshop_id}/ordenes/${o.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--color-brand-400)', fontWeight: 600 }}
        >
          Ver orden <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

/** Despliega todas las órdenes del taller, de la #1 (la primera) a la última. */
function VerOrdenes({ ordenes }: { ordenes: FilaOrden[] }) {
  const [abierto, setAbierto] = useState(false);
  if (ordenes.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setAbierto((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontSize: 12.5,
          fontWeight: 700,
          color: 'var(--color-text-secondary)',
        }}
      >
        {abierto ? 'Ocultar' : 'Ver'} {ordenes.length === 1 ? 'su orden' : `sus ${ordenes.length} órdenes`}
        <ChevronDown size={14} style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {abierto && ordenes.map((o) => <Orden key={o.id} o={o} />)}
    </div>
  );
}

function BotonWa({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        marginTop: 10,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 12px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        border: '1px solid rgba(37,211,102,0.4)',
        background: 'rgba(37,211,102,0.12)',
        color: '#25d366',
      }}
    >
      <MessageCircle size={15} />
      Escribir por WhatsApp
    </button>
  );
}
