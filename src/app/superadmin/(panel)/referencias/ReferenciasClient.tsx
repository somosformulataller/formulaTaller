'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Search, X } from 'lucide-react';
import { formatUsd } from '@/lib/budget';
import { formatDate } from '@/lib/utils';

type De = 'formula_taller' | 'pendiente' | 'otra_app' | 'libre';

interface Mov {
  id: number;
  fecha: string;
  referencia: string;
  descripcion: string;
  monto: number;
  used: boolean;
  scrapedAt?: string;
  de: De;
  taller: string | null;
}

interface Compra {
  id: string;
  reference: string;
  status: 'pendiente' | 'aprobado' | 'rechazado';
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

type Veredicto = 'sin_dinero' | 'libre' | 'aprobada' | 'coincide_otra' | 'esperando' | 'rechazada' | 'otra_app';

interface Busqueda {
  cola: string;
  veredicto: Veredicto;
  banco_configurado: boolean;
  ultimo_escaneo: string | null;
  latido: string | null;
  movimientos: Mov[];
  compras: Compra[];
}

interface Recientes {
  modo: 'recientes';
  banco_configurado: boolean;
  ultimo_escaneo?: string | null;
  latido: string | null;
  recientes: Mov[];
}

const VEREDICTO: Record<Veredicto, { icono: string; titulo: string; detalle: string; color: string }> = {
  sin_dinero: {
    icono: '🔍',
    titulo: 'El banco no tiene ese pago',
    detalle:
      'Ningún movimiento de la cuenta con esa referencia. Puede estar mal copiada, ser de otro banco, o el banco aún no la ha reflejado: prueba «Actualizar».',
    color: 'var(--color-text-secondary)',
  },
  libre: {
    icono: '🟢',
    titulo: 'El pago existe y NO se ha usado',
    detalle: 'Está en el estado de cuenta y ni Formula Taller ni La Mejor Llave lo han tomado todavía.',
    color: '#34d399',
  },
  aprobada: {
    icono: '✅',
    titulo: 'Ya acreditó saldo en Formula Taller',
    detalle: 'Esa referencia ya se usó para una recarga aprobada. No se puede volver a usar.',
    color: '#34d399',
  },
  coincide_otra: {
    icono: '🟡',
    titulo: 'Pago nuevo: la terminación coincide con otro pago',
    detalle:
      'El pago del banco está libre, pero la recarga aprobada con esos 6 dígitos se pagó con OTRO movimiento. Compara la fecha, el monto y la referencia completa.',
    color: '#fbbf24',
  },
  esperando: {
    icono: '🕒',
    titulo: 'Hay una recarga pendiente con esa referencia',
    detalle: 'Revísala en Pagos.',
    color: '#fbbf24',
  },
  rechazada: {
    icono: '❌',
    titulo: 'Se usó y se rechazó',
    detalle: 'Hubo una recarga con esa referencia y se rechazó.',
    color: '#f87171',
  },
  otra_app: {
    icono: '🔑',
    titulo: 'Usado por La Mejor Llave',
    detalle:
      'El pago está marcado como usado en el banco y no hay ninguna recarga de Formula Taller con él: lo tomó la otra app que comparte la cuenta.',
    color: '#a78bfa',
  },
};

const DE_TEXTO: Record<De, { texto: string; color: string }> = {
  formula_taller: { texto: 'Formula Taller', color: '#34d399' },
  pendiente: { texto: 'Formula Taller (pendiente)', color: '#fbbf24' },
  otra_app: { texto: 'La Mejor Llave', color: '#a78bfa' },
  libre: { texto: 'Libre', color: 'var(--color-text-muted)' },
};

const ESTADO_COMPRA: Record<Compra['status'], string> = {
  aprobado: '✅ Aprobada',
  pendiente: '🕒 Pendiente',
  rechazado: '❌ Rechazada',
};

function formatBs(n: number): string {
  return `Bs. ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

function hace(iso: string | null | undefined): string {
  if (!iso) return '—';
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return 'hace menos de 1 min';
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.round(min / 60)} h`;
}

/**
 * Buscar una referencia en el banco (cuenta BDV compartida con La Mejor
 * Llave) y ver qué pasó con ella. Sin búsqueda, los últimos pagos que
 * entraron y de qué app es cada uno.
 */
export default function ReferenciasClient() {
  const [q, setQ] = useState('');
  const [buscada, setBuscada] = useState('');
  const [res, setRes] = useState<Busqueda | null>(null);
  const [rec, setRec] = useState<Recientes | null>(null);
  const [cargando, setCargando] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consultar = useCallback(async (ref: string, refrescar = false) => {
    setError(null);
    refrescar ? setActualizando(true) : setCargando(true);
    try {
      const qs = new URLSearchParams();
      if (ref) qs.set('q', ref);
      if (refrescar) qs.set('refrescar', '1');
      const r = await fetch(`/api/superadmin/referencias?${qs}`, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo consultar.');
      if (d.modo === 'recientes') {
        setRec(d);
        setRes(null);
      } else setRes(d);
      if (refrescar && d.latido === 'enfriamiento') setError('El banco pidió esperar un minuto antes de volver a entrar.');
      if (refrescar && d.latido === 'turno_ocupado') setError('Se acaba de actualizar hace menos de un minuto: espera un momento.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar.');
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, []);

  useEffect(() => {
    consultar('');
  }, [consultar]);

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const ref = q.replace(/\D/g, '');
    setBuscada(ref);
    consultar(ref);
  }

  const escaneo = res?.ultimo_escaneo ?? rec?.ultimo_escaneo ?? null;
  const v = res ? VEREDICTO[res.veredicto] : null;
  const spin = <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '20px 16px 48px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Referencias</h1>
      <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
        Busca un pago en el estado de cuenta del Banco de Venezuela y mira si ya se usó. La cuenta la comparte La
        Mejor Llave: aquí ves de cuál de las dos apps es cada pago.
      </p>

      <form onSubmit={buscar} style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input
          className="form-input"
          inputMode="numeric"
          placeholder="Referencia (mínimo 4 dígitos; se comparan los últimos 6)"
          value={q}
          onChange={(e) => setQ(e.target.value.replace(/[^\d]/g, ''))}
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={cargando} style={boton(true)}>
          {cargando ? spin : <Search size={14} />} Buscar
        </button>
        {buscada && (
          <button
            type="button"
            style={boton(false)}
            onClick={() => {
              setQ('');
              setBuscada('');
              setRes(null);
              consultar('');
            }}
          >
            <X size={14} />
          </button>
        )}
      </form>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Estado de cuenta actualizado {hace(escaneo)}</p>
        <button type="button" disabled={actualizando} onClick={() => consultar(buscada, true)} style={boton(false)}>
          {actualizando ? spin : <RefreshCw size={13} />} Actualizar desde el banco
        </button>
      </div>

      {error && <p style={{ color: '#fbbf24', fontSize: 13, marginBottom: 10 }}>{error}</p>}
      {(res ?? rec) && !(res ?? rec)!.banco_configurado && (
        <p style={{ color: '#f87171', fontSize: 13, marginBottom: 10 }}>
          Falta configurar la Bank API (BANK_API_URL y BANK_API_TOKEN en Vercel).
        </p>
      )}

      {res && v && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ borderColor: v.color }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: v.color }}>
              {v.icono} {v.titulo}
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>{v.detalle}</p>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>Terminación buscada: …{res.cola}</p>
          </div>

          <div className="card">
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>En el banco ({res.movimientos.length})</h2>
            {res.movimientos.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Ningún pago con esa terminación.</p>
            ) : (
              <ListaMovimientos movs={res.movimientos} />
            )}
          </div>

          <div className="card">
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Recargas de Formula Taller ({res.compras.length})</h2>
            {res.compras.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Ningún taller ha usado esa referencia.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {res.compras.map((c) => (
                  <div key={c.id} style={fila}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <b style={{ fontSize: 14 }}>{c.workshop?.name ?? 'Taller'}</b>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{ESTADO_COMPRA[c.status]}</span>
                    </div>
                    <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                      {formatUsd(Number(c.amount_usd))}
                      {c.amount_ves !== null ? ` · ${formatBs(Number(c.amount_ves))}` : ''}
                      {c.status === 'aprobado' && c.credited_usd !== null && Number(c.credited_usd) !== Number(c.amount_usd)
                        ? ` · acreditado ${formatUsd(Number(c.credited_usd))}`
                        : ''}
                      {c.approved_origin ? ` · ${c.approved_origin === 'auto' ? 'aprobada sola' : 'aprobada a mano'}` : ''}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      Ref. {c.reference} · {formatDate(c.created_at)}
                      {c.ocr_reference ? ` · captura …${c.ocr_reference}` : ''}
                      {c.ocr_amount !== null ? ` ${formatBs(Number(c.ocr_amount))}` : ''}
                      {c.ocr_bank ? ` · ${c.ocr_bank}` : ''}
                      {c.workshop?.whatsapp ? ` · ${c.workshop.whatsapp}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!res && rec && (
        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Últimos pagos que entraron a la cuenta</h2>
          {rec.recientes.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sin movimientos.</p>
          ) : (
            <ListaMovimientos movs={rec.recientes} buscar={(ref) => {
              setQ(ref);
              setBuscada(ref);
              consultar(ref);
            }} />
          )}
        </div>
      )}

      {cargando && !res && !rec && (
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-muted)' }}>
          {spin} Consultando el banco…
        </p>
      )}
    </div>
  );
}

function ListaMovimientos({ movs, buscar }: { movs: Mov[]; buscar?: (ref: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {movs.map((m) => (
        <div key={m.id} style={fila}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
            <b style={{ fontSize: 14 }}>{formatBs(Number(m.monto))}</b>
            <span style={{ fontSize: 12, fontWeight: 700, color: DE_TEXTO[m.de].color, textAlign: 'right' }}>
              {DE_TEXTO[m.de].texto}
              {m.taller ? ` · ${m.taller}` : ''}
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {buscar ? (
              <button
                type="button"
                onClick={() => buscar(String(m.referencia))}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-brand-400)', cursor: 'pointer', fontSize: 12 }}
              >
                Ref. {m.referencia}
              </button>
            ) : (
              <>Ref. {m.referencia}</>
            )}{' '}
            · {formatDate(m.fecha)} · {m.used ? 'usado' : 'libre'}
            {m.descripcion ? ` · ${m.descripcion}` : ''}
          </p>
        </div>
      ))}
    </div>
  );
}

const fila: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-2)',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

function boton(principal: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 12px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    border: `1px solid ${principal ? 'var(--color-brand-400)' : 'var(--color-border)'}`,
    background: principal ? 'rgba(245,158,11,0.15)' : 'var(--color-surface-2)',
    color: principal ? 'var(--color-brand-400)' : 'var(--color-text-secondary)',
    cursor: 'pointer',
  };
}
