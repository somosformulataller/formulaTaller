'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2, Save, Settings2, X } from 'lucide-react';
import { formatPrecioUsd, formatUsd } from '@/lib/budget';
import { formatDate } from '@/lib/utils';

export interface AjustesCobro {
  price_order_usd: number;
  price_ai_question_usd: number;
  welcome_balance_usd: number;
  pago_movil_bank: string;
  pago_movil_phone: string;
  pago_movil_document: string;
  pago_movil_holder: string;
}

interface Pago {
  id: string;
  workshop_id: string;
  amount_usd: number;
  amount_ves: number | null;
  exchange_rate: number | null;
  reference: string;
  status: 'pendiente' | 'aprobado' | 'rechazado';
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
  proof_url: string | null;
  workshop: { name: string; slug: string; whatsapp: string | null; balance_usd: number } | null;
}

type Filtro = 'pendiente' | 'aprobado' | 'rechazado' | 'todos';
const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: 'pendiente', texto: 'Pendientes' },
  { valor: 'aprobado', texto: 'Aprobados' },
  { valor: 'rechazado', texto: 'Rechazados' },
  { valor: 'todos', texto: 'Todos' },
];

const ESTADO_COLOR: Record<Pago['status'], string> = {
  pendiente: '#fbbf24',
  aprobado: '#34d399',
  rechazado: '#f87171',
};

function formatBs(n: number): string {
  return `Bs. ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

/**
 * Revisión MANUAL de las compras de saldo: se mira el comprobante, se busca
 * la referencia en el banco y se aprueba (suma el saldo) o se rechaza con
 * motivo (le llega al taller). Nada se valida solo.
 */
export default function PagosClient({ ajustesIniciales }: { ajustesIniciales: AjustesCobro }) {
  const [filtro, setFiltro] = useState<Filtro>('pendiente');
  const [pagos, setPagos] = useState<Pago[] | null>(null);
  const [pendientes, setPendientes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [verConfig, setVerConfig] = useState(false);

  const cargar = useCallback(async (f: Filtro) => {
    setError(null);
    try {
      const r = await fetch(`/api/superadmin/pagos?estado=${f}`, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudieron cargar los pagos.');
      setPagos(d.pagos ?? []);
      setPendientes(d.pendientes ?? 0);
    } catch (e) {
      setPagos([]);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los pagos.');
    }
  }, []);

  useEffect(() => {
    setPagos(null);
    cargar(filtro);
  }, [filtro, cargar]);

  async function decidir(p: Pago, accion: 'aprobar' | 'rechazar') {
    if (accion === 'rechazar' && !motivo.trim()) {
      setError('Escribe el motivo del rechazo: le llega al taller.');
      return;
    }
    setOcupado(p.id);
    setError(null);
    try {
      const r = await fetch(`/api/superadmin/pagos/${p.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, motivo: motivo.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar.');
      setRechazando(null);
      setMotivo('');
      await cargar(filtro);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px 48px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Pagos</h1>
        <button type="button" onClick={() => setVerConfig((v) => !v)} style={botonChico(verConfig)}>
          <Settings2 size={14} />
          Precios y Pago Móvil
        </button>
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
        Las compras de saldo de los talleres. Revisa el comprobante y la referencia en el banco antes de aprobar: el
        saldo se suma al taller en cuanto apruebas.
      </p>

      {verConfig && <ConfigCobro inicial={ajustesIniciales} />}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {FILTROS.map((f) => (
          <button key={f.valor} type="button" onClick={() => setFiltro(f.valor)} style={botonChico(filtro === f.valor)}>
            {f.texto}
            {f.valor === 'pendiente' && pendientes > 0 && (
              <span
                style={{
                  marginLeft: 4,
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: 999,
                  padding: '0 6px',
                  fontSize: 11,
                }}
              >
                {pendientes}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <p style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 10 }}>{error}</p>}

      {pagos === null ? (
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-muted)' }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…
        </p>
      ) : pagos.length === 0 ? (
        <div className="empty-state">
          <p>{filtro === 'pendiente' ? 'No hay pagos por revisar.' : 'No hay pagos en esta lista.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pagos.map((p) => (
            <div key={p.id} className="card" style={{ display: 'flex', gap: 12 }}>
              {p.proof_url ? (
                <a href={p.proof_url} target="_blank" rel="noreferrer" title="Ver comprobante" style={{ flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.proof_url}
                    alt="Comprobante"
                    style={{
                      width: 84,
                      height: 112,
                      objectFit: 'cover',
                      borderRadius: 8,
                      border: '1px solid var(--color-border)',
                      background: '#000',
                    }}
                  />
                </a>
              ) : (
                <div style={{ width: 84, height: 112, borderRadius: 8, background: 'var(--color-surface-2)', flexShrink: 0 }} />
              )}

              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                  <b style={{ fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.workshop?.name ?? 'Taller'}
                  </b>
                  <span style={{ fontSize: 12, fontWeight: 700, color: ESTADO_COLOR[p.status], textTransform: 'capitalize' }}>
                    {p.status}
                  </span>
                </div>
                <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-brand-400)' }}>
                  {formatUsd(Number(p.amount_usd))}
                  {p.amount_ves !== null && (
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      {' '}
                      · {formatBs(Number(p.amount_ves))}
                    </span>
                  )}
                </p>
                <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                  Ref. <b>{p.reference}</b> · {formatDate(p.created_at)}
                  {p.exchange_rate ? ` · tasa ${Number(p.exchange_rate).toLocaleString('es-VE')}` : ''}
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  Saldo actual del taller: {formatPrecioUsd(Number(p.workshop?.balance_usd ?? 0))}
                  {p.workshop?.whatsapp ? ` · ${p.workshop.whatsapp}` : ''}
                </p>
                {p.note && (
                  <p style={{ fontSize: 12.5, color: p.status === 'rechazado' ? '#f87171' : '#fbbf24' }}>{p.note}</p>
                )}
                {p.proof_url && (
                  <a
                    href={p.proof_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-brand-400)' }}
                  >
                    <ExternalLink size={12} /> Ver comprobante completo
                  </a>
                )}

                {p.status === 'pendiente' && (
                  rechazando === p.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                      <input
                        className="form-input"
                        placeholder="Motivo (le llega al taller): ej. no encontramos el pago"
                        maxLength={300}
                        autoFocus
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          disabled={ocupado === p.id}
                          onClick={() => decidir(p, 'rechazar')}
                          style={botonAccion('#ef4444')}
                        >
                          <X size={14} /> Rechazar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRechazando(null);
                            setMotivo('');
                          }}
                          style={botonChico(false)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button
                        type="button"
                        disabled={ocupado === p.id}
                        onClick={() => decidir(p, 'aprobar')}
                        style={botonAccion('#10b981')}
                      >
                        {ocupado === p.id ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                        Aprobar {formatUsd(Number(p.amount_usd))}
                      </button>
                      <button
                        type="button"
                        disabled={ocupado === p.id}
                        onClick={() => {
                          setRechazando(p.id);
                          setMotivo('');
                        }}
                        style={botonChico(false)}
                      >
                        Rechazar
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Precios, saldo de bienvenida y datos de Pago Móvil que ve el taller. */
function ConfigCobro({ inicial }: { inicial: AjustesCobro }) {
  // Todo como texto mientras se edita; el servidor valida y convierte.
  const comoTexto = Object.fromEntries(
    Object.entries(inicial).map(([k, x]) => [k, String(x ?? '')])
  ) as Record<keyof AjustesCobro, string>;
  const [v, setV] = useState(comoTexto);
  const [guardado, setGuardado] = useState(comoTexto);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const cambiado = JSON.stringify(v) !== JSON.stringify(guardado);

  async function guardar() {
    setGuardando(true);
    setMsg(null);
    try {
      const r = await fetch('/api/superadmin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar.');
      setGuardado(v);
      setMsg({ ok: true, texto: 'Guardado. Aplica desde ya a todos los talleres.' });
    } catch (e) {
      setMsg({ ok: false, texto: e instanceof Error ? e.message : 'No se pudo guardar.' });
    } finally {
      setGuardando(false);
    }
  }

  const numero = (k: 'price_order_usd' | 'price_ai_question_usd' | 'welcome_balance_usd', etiqueta: string, ayuda: string) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)' }}>{etiqueta}</span>
      <input
        className="form-input"
        inputMode="decimal"
        value={v[k]}
        onChange={(e) => setV({ ...v, [k]: e.target.value.replace(',', '.').replace(/[^d.]/g, '') })}
      />
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{ayuda}</span>
    </label>
  );
  const texto = (
    k: 'pago_movil_bank' | 'pago_movil_phone' | 'pago_movil_document' | 'pago_movil_holder',
    etiqueta: string,
    ejemplo: string
  ) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)' }}>{etiqueta}</span>
      <input
        className="form-input"
        placeholder={ejemplo}
        maxLength={80}
        value={v[k]}
        onChange={(e) => setV({ ...v, [k]: e.target.value })}
      />
    </label>
  );

  return (
    <div className="card" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700 }}>Precios (USD)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {numero('price_order_usd', 'Por orden', 'Se cobra al crear la orden.')}
        {numero('price_ai_question_usd', 'Por pregunta a la IA', 'Se cobra en cada pregunta.')}
        {numero('welcome_balance_usd', 'Saldo de bienvenida', 'Lo recibe cada taller nuevo.')}
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 700 }}>Datos de Pago Móvil</h2>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: -8 }}>
        Es lo que ve el taller al comprar saldo.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        {texto('pago_movil_bank', 'Banco', 'Ej.: 0102 Banco de Venezuela')}
        {texto('pago_movil_phone', 'Teléfono', 'Ej.: 0414-1234567')}
        {texto('pago_movil_document', 'C.I. o RIF', 'Ej.: V-12345678')}
        {texto('pago_movil_holder', 'Titular (opcional)', 'Ej.: Formula Taller C.A.')}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" disabled={!cambiado || guardando} onClick={guardar} style={botonAccion('var(--color-brand-500)', !cambiado || guardando)}>
          {guardando ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
          Guardar
        </button>
        {msg && <span style={{ fontSize: 12.5, color: msg.ok ? '#34d399' : 'var(--color-danger)' }}>{msg.texto}</span>}
      </div>
    </div>
  );
}

function botonChico(activo: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 12px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    border: `1px solid ${activo ? 'var(--color-brand-400)' : 'var(--color-border)'}`,
    background: activo ? 'rgba(245,158,11,0.15)' : 'var(--color-surface-2)',
    color: activo ? 'var(--color-brand-400)' : 'var(--color-text-secondary)',
    cursor: 'pointer',
  };
}

function botonAccion(color: string, apagado = false): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 12px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    border: 'none',
    background: color,
    color: '#fff',
    cursor: apagado ? 'not-allowed' : 'pointer',
    opacity: apagado ? 0.5 : 1,
  };
}
