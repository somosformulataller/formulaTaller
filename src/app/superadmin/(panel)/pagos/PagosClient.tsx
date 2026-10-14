'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Landmark, Loader2, Pencil, RefreshCw, Save, Search, Settings2, X } from 'lucide-react';
import { formatPrecioUsd, formatUsd } from '@/lib/budget';
import { formatDate } from '@/lib/utils';
import TasaDelDia from '@/components/saldo/TasaDelDia';

export interface AjustesCobro {
  price_order_usd: number;
  price_ai_question_usd: number;
  welcome_balance_usd: number;
  pago_movil_bank: string;
  pago_movil_phone: string;
  pago_movil_document: string;
  pago_movil_holder: string;
}

interface MovimientoBanco {
  id: number;
  fecha: string;
  referencia: string;
  monto: number;
  used: boolean;
}

interface Pago {
  id: string;
  workshop_id: string;
  amount_usd: number;
  amount_ves: number | null;
  credited_usd: number | null;
  exchange_rate: number | null;
  reference: string;
  status: 'pendiente' | 'aprobado' | 'rechazado';
  note: string | null;
  revision: string | null;
  bank_note: string | null;
  bank_response: MovimientoBanco | null;
  approved_origin: 'auto' | 'manual' | null;
  ocr_reference: string | null;
  ocr_amount: number | null;
  ocr_bank: string | null;
  check_count: number;
  last_checked_at: string | null;
  created_at: string;
  reviewed_at: string | null;
  proof_url: string | null;
  workshop: { name: string; slug: string; whatsapp: string | null; balance_usd: number } | null;
}

interface Salud {
  activa: boolean;
  motivo: string | null;
  ultima: { created_at: string; origen: string; ok: boolean; motivo: string | null; latido: string | null } | null;
  ultimo_cron: string | null;
  cola_al_dia: string | null;
  aprobadas_auto_24h: number;
  aprobadas_manual_24h: number;
  max_auto_usd: number;
}

type Filtro = 'revisar' | 'validando' | 'aprobado' | 'rechazado' | 'todos';
const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: 'revisar', texto: 'Por revisar' },
  { valor: 'validando', texto: 'Validando (banco)' },
  { valor: 'aprobado', texto: 'Aprobados' },
  { valor: 'rechazado', texto: 'Rechazados' },
  { valor: 'todos', texto: 'Todos' },
];

const REVISION_TEXTO: Record<string, string> = {
  referencia_repetida: 'Referencia repetida',
  monto_alto: 'Monto alto',
  monto_distinto: 'El monto no cuadra',
  pago_usado: 'El pago ya figura usado en el banco',
  ambiguo: 'Varios pagos con esa referencia',
  sin_tasa: 'Sin tasa BCV',
  fuera_de_ventana: 'Pago con fecha lejana',
  reclamo: 'Verificado, falta acreditar',
  no_aparece: 'No aparece en el banco',
};

const ESTADO_COLOR: Record<Pago['status'], string> = {
  pendiente: '#fbbf24',
  aprobado: '#34d399',
  rechazado: '#f87171',
};

function formatBs(n: number): string {
  return `Bs. ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

/** «hace 3 min» */
function hace(iso: string | null): string {
  if (!iso) return '—';
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return 'hace menos de 1 min';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}

/**
 * Pagos: las compras de saldo de los talleres. El sistema las valida solo
 * contra el banco (misma cuenta y misma Bank API que La Mejor Llave) y con el
 * OCR de la captura; aquí llegan las que tiene que decidir una persona.
 */
export default function PagosClient({ ajustesIniciales }: { ajustesIniciales: AjustesCobro }) {
  const [filtro, setFiltro] = useState<Filtro>('revisar');
  const [busqueda, setBusqueda] = useState('');
  const [pagos, setPagos] = useState<Pago[] | null>(null);
  const [cuentas, setCuentas] = useState({ revisar: 0, validando: 0 });
  const [salud, setSalud] = useState<Salud | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<{ id: string; modo: 'rechazar' | 'monto' | 'referencia' } | null>(null);
  const [texto, setTexto] = useState('');
  const [verConfig, setVerConfig] = useState(false);
  const [tasaHoy, setTasaHoy] = useState<number | null>(null);
  const [revisandoBanco, setRevisandoBanco] = useState(false);
  const consulta = useRef({ filtro, busqueda: '' });

  const cargar = useCallback(async () => {
    const { filtro: f, busqueda: q } = consulta.current;
    setError(null);
    try {
      const qs = new URLSearchParams({ estado: f });
      if (q) qs.set('q', q);
      const r = await fetch(`/api/superadmin/pagos?${qs}`, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudieron cargar los pagos.');
      setPagos(d.pagos ?? []);
      setCuentas(d.cuentas ?? { revisar: 0, validando: 0 });
      setSalud(d.salud ?? null);
    } catch (e) {
      setPagos([]);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los pagos.');
    }
  }, []);

  useEffect(() => {
    consulta.current = { filtro, busqueda: consulta.current.busqueda };
    setPagos(null);
    cargar();
  }, [filtro, cargar]);

  // Refresco cada 30 s: las pendientes cambian solas cuando el banco las confirma.
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden && !abierto) cargar();
    }, 30_000);
    return () => clearInterval(id);
  }, [cargar, abierto]);

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    consulta.current = { filtro, busqueda: busqueda.trim() };
    setPagos(null);
    cargar();
  }

  async function accion(p: Pago, cuerpo: Record<string, unknown>) {
    setOcupado(p.id);
    setError(null);
    setAviso(null);
    try {
      const r = await fetch(`/api/superadmin/pagos/${p.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar.');
      if (d.aviso) setAviso(`Aprobado. ${d.aviso}`);
      if (cuerpo.accion === 'revalidar' || cuerpo.accion === 'editar_referencia') {
        const est = d.informe?.detalle?.[0]?.estado;
        setAviso(
          est === 'aprobada'
            ? 'El banco lo confirmó: aprobado y acreditado.'
            : est === 'no_encontrado'
              ? 'Todavía no aparece en el banco.'
              : est
                ? `Resultado: ${REVISION_TEXTO[est] ?? est}.`
                : 'Revisado.'
        );
      }
      setAbierto(null);
      setTexto('');
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setOcupado(null);
    }
  }

  async function revisarBanco() {
    setRevisandoBanco(true);
    setAviso(null);
    setError(null);
    try {
      const r = await fetch('/api/superadmin/pagos/conciliar', { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo revisar el banco.');
      setAviso(
        d.ok
          ? `Revisadas ${d.pendientes} pendientes · ${d.aprobadas} aprobadas${d.latido === 'enfriamiento' ? ' · el banco pidió esperar un minuto' : ''}.`
          : `No se pudo: ${d.motivo ?? 'error'}`
      );
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo revisar el banco.');
    } finally {
      setRevisandoBanco(false);
    }
  }

  const abrir = (id: string, modo: 'rechazar' | 'monto' | 'referencia', inicial = '') => {
    setAbierto({ id, modo });
    setTexto(inicial);
  };

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '20px 16px 48px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Pagos</h1>
        <button type="button" onClick={() => setVerConfig((v) => !v)} style={botonChico(verConfig)}>
          <Settings2 size={14} />
          Precios y Pago Móvil
        </button>
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
        Las recargas se validan solas contra el banco (Banco de Venezuela, la misma cuenta de La Mejor Llave) y la
        captura se lee con OCR. Aquí llegan las que tiene que decidir una persona.
      </p>

      <div style={{ marginBottom: 12 }}>
        <TasaDelDia url="/api/superadmin/tasa-bcv" onTasa={(t) => setTasaHoy(t?.rate ?? null)} />
      </div>

      {salud && <Semaforo salud={salud} revisando={revisandoBanco} onRevisar={revisarBanco} />}

      {verConfig && <ConfigCobro inicial={ajustesIniciales} />}

      <form onSubmit={buscar} style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          className="form-input"
          placeholder="Buscar por referencia o nombre del taller"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit" style={botonChico(false)}>
          <Search size={14} /> Buscar
        </button>
        {consulta.current.busqueda && (
          <button
            type="button"
            style={botonChico(false)}
            onClick={() => {
              setBusqueda('');
              consulta.current = { filtro, busqueda: '' };
              setPagos(null);
              cargar();
            }}
          >
            <X size={14} />
          </button>
        )}
      </form>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {FILTROS.map((f) => {
          const n = f.valor === 'revisar' ? cuentas.revisar : f.valor === 'validando' ? cuentas.validando : 0;
          return (
            <button key={f.valor} type="button" onClick={() => setFiltro(f.valor)} style={botonChico(filtro === f.valor)}>
              {f.texto}
              {n > 0 && (
                <span
                  style={{
                    marginLeft: 4,
                    background: f.valor === 'revisar' ? '#ef4444' : '#f59e0b',
                    color: '#fff',
                    borderRadius: 999,
                    padding: '0 6px',
                    fontSize: 11,
                  }}
                >
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && <p style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
      {aviso && <p style={{ color: '#34d399', fontSize: 13, marginBottom: 10 }}>{aviso}</p>}

      {pagos === null ? (
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-muted)' }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…
        </p>
      ) : pagos.length === 0 ? (
        <div className="empty-state">
          <p>
            {consulta.current.busqueda
              ? 'No hay pagos con esa búsqueda.'
              : filtro === 'revisar'
                ? 'No hay pagos por revisar.'
                : filtro === 'validando'
                  ? 'No hay pagos esperando al banco.'
                  : 'No hay pagos en esta lista.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pagos.map((p) => (
            <TarjetaPago
              key={p.id}
              p={p}
              tasaHoy={tasaHoy}
              ocupado={ocupado === p.id}
              abierto={abierto?.id === p.id ? abierto.modo : null}
              texto={texto}
              setTexto={setTexto}
              onAbrir={(modo, inicial) => abrir(p.id, modo, inicial)}
              onCerrar={() => {
                setAbierto(null);
                setTexto('');
              }}
              onAccion={(cuerpo) => accion(p, cuerpo)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Cómo va la validación automática: última pasada, estado de cuenta y aprobadas. */
function Semaforo({ salud, revisando, onRevisar }: { salud: Salud; revisando: boolean; onRevisar: () => void }) {
  const minCron = salud.ultimo_cron ? (Date.now() - Date.parse(salud.ultimo_cron)) / 60_000 : null;
  const color = !salud.activa ? '#f87171' : minCron === null || minCron > 15 ? '#fbbf24' : '#34d399';
  return (
    <div
      className="card"
      style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6, borderColor: color, borderWidth: 1 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
          <Landmark size={15} />
          {salud.activa ? 'Validación automática encendida' : 'Validación automática apagada'}
        </p>
        <button type="button" onClick={onRevisar} disabled={revisando || !salud.activa} style={botonChico(false)}>
          {revisando ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
          Revisar el banco ahora
        </button>
      </div>
      {salud.motivo && <p style={{ fontSize: 12.5, color: '#f87171' }}>{salud.motivo}</p>}
      <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
        Cron: {salud.ultimo_cron ? hace(salud.ultimo_cron) : 'sin pasadas registradas (configura cron-job.org)'} ·
        Estado de cuenta: {hace(salud.cola_al_dia)} · Últimas 24 h: {salud.aprobadas_auto_24h} aprobadas solas,{' '}
        {salud.aprobadas_manual_24h} a mano · Tope automático ${salud.max_auto_usd}
      </p>
      {minCron !== null && minCron > 15 && salud.activa && (
        <p style={{ fontSize: 12, color: '#fbbf24' }}>
          El cron no pasa hace {Math.round(minCron)} min. Los pagos se siguen validando cuando el taller tiene abierta
          la pantalla de compra, pero revisa cron-job.org.
        </p>
      )}
    </div>
  );
}

function TarjetaPago({
  p,
  tasaHoy,
  ocupado,
  abierto,
  texto,
  setTexto,
  onAbrir,
  onCerrar,
  onAccion,
}: {
  p: Pago;
  tasaHoy: number | null;
  ocupado: boolean;
  abierto: 'rechazar' | 'monto' | 'referencia' | null;
  texto: string;
  setTexto: (t: string) => void;
  onAbrir: (modo: 'rechazar' | 'monto' | 'referencia', inicial?: string) => void;
  onCerrar: () => void;
  onAccion: (cuerpo: Record<string, unknown>) => void;
}) {
  const banco = p.bank_response;
  const tasa = Number(p.exchange_rate ?? 0);
  // Lo que valdría en USD lo que de verdad pagó (para «aprobar por lo pagado»)
  const pagadoUsd = banco && tasa > 0 ? Math.round((banco.monto / tasa) * 100) / 100 : null;
  const ocrDistinto =
    p.ocr_reference && p.reference.replace(/\D/g, '').slice(-6) !== p.ocr_reference ? p.ocr_reference : null;
  const spin = <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />;

  return (
    <div className="card" style={{ display: 'flex', gap: 12 }}>
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
          <span style={{ fontSize: 12, fontWeight: 700, color: ESTADO_COLOR[p.status], whiteSpace: 'nowrap' }}>
            {p.status === 'aprobado'
              ? p.approved_origin === 'auto'
                ? 'Aprobado solo'
                : 'Aprobado a mano'
              : p.status === 'rechazado'
                ? 'Rechazado'
                : p.revision
                  ? 'Por revisar'
                  : 'Validando'}
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
        {p.status === 'aprobado' && p.credited_usd !== null && Number(p.credited_usd) !== Number(p.amount_usd) && (
          <p style={{ fontSize: 12.5, color: '#34d399' }}>Acreditado: {formatUsd(Number(p.credited_usd))} (lo pagado)</p>
        )}

        <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
          Ref. <b>{p.reference}</b> · {formatDate(p.created_at)}
          {p.exchange_rate ? ` · tasa ${Number(p.exchange_rate).toLocaleString('es-VE')}` : ''}
        </p>

        {/* Lo que leyó el OCR y lo que dice el banco, lado a lado */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 6,
            fontSize: 12,
            marginTop: 2,
          }}
        >
          <div style={cajita}>
            <span style={{ color: 'var(--color-text-muted)' }}>Captura (OCR)</span>
            {p.ocr_reference ? (
              <span>
                Ref. …{p.ocr_reference}
                {p.ocr_amount !== null ? ` · ${formatBs(Number(p.ocr_amount))}` : ''}
                {p.ocr_bank ? ` · ${p.ocr_bank}` : ''}
              </span>
            ) : (
              <span style={{ color: '#fbbf24' }}>No se pudo leer</span>
            )}
            {ocrDistinto && <span style={{ color: '#fbbf24' }}>La referencia corregida no es la de la captura</span>}
          </div>
          <div style={cajita}>
            <span style={{ color: 'var(--color-text-muted)' }}>Banco</span>
            {banco ? (
              <span>
                {formatBs(Number(banco.monto))} · {formatDate(banco.fecha)} · ref. {banco.referencia}
                {banco.used && p.status !== 'aprobado' ? ' · ya usado' : ''}
              </span>
            ) : p.status === 'pendiente' ? (
              <span style={{ color: 'var(--color-text-muted)' }}>
                {p.check_count > 0 ? `Sin encontrar · ${p.check_count} búsquedas, última ${hace(p.last_checked_at)}` : 'Buscando…'}
              </span>
            ) : (
              <span style={{ color: 'var(--color-text-muted)' }}>—</span>
            )}
          </div>
        </div>

        {p.status === 'pendiente' && p.revision && (
          <p style={{ fontSize: 12.5, fontWeight: 700, color: '#fbbf24' }}>⚠ {REVISION_TEXTO[p.revision] ?? p.revision}</p>
        )}
        {p.bank_note && <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{p.bank_note}</p>}
        {p.status === 'rechazado' && p.note && <p style={{ fontSize: 12.5, color: '#f87171' }}>Motivo: {p.note}</p>}

        {p.status === 'pendiente' && tasaHoy && (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            A la tasa de hoy: {formatBs(Number(p.amount_usd) * tasaHoy)}
          </p>
        )}
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Saldo actual del taller: {formatUsd(Number(p.workshop?.balance_usd ?? 0))}
          {p.workshop?.whatsapp ? ` · ${p.workshop.whatsapp}` : ''}
        </p>
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

        {p.status === 'pendiente' &&
          (abierto ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              <input
                className="form-input"
                autoFocus
                inputMode={abierto === 'rechazar' ? 'text' : abierto === 'monto' ? 'decimal' : 'numeric'}
                maxLength={abierto === 'rechazar' ? 300 : 30}
                placeholder={
                  abierto === 'rechazar'
                    ? 'Motivo (le llega al taller): ej. no encontramos el pago'
                    : abierto === 'monto'
                      ? 'Monto a acreditar en USD, ej. 4.35'
                      : 'Referencia correcta (mínimo 6 dígitos)'
                }
                value={texto}
                onChange={(e) =>
                  setTexto(
                    abierto === 'monto'
                      ? e.target.value.replace(',', '.').replace(/[^\d.]/g, '')
                      : abierto === 'referencia'
                        ? e.target.value.replace(/\D/g, '')
                        : e.target.value
                  )
                }
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {abierto === 'rechazar' && (
                  <button
                    type="button"
                    disabled={ocupado || !texto.trim()}
                    onClick={() => onAccion({ accion: 'rechazar', motivo: texto.trim() })}
                    style={botonAccion('#ef4444', ocupado || !texto.trim())}
                  >
                    {ocupado ? spin : <X size={14} />} Rechazar
                  </button>
                )}
                {abierto === 'monto' && (
                  <button
                    type="button"
                    disabled={ocupado || !(Number(texto) > 0)}
                    onClick={() => onAccion({ accion: 'aprobar', monto: texto })}
                    style={botonAccion('#10b981', ocupado || !(Number(texto) > 0))}
                  >
                    {ocupado ? spin : <Check size={14} />} Acreditar {Number(texto) > 0 ? formatUsd(Number(texto)) : ''}
                  </button>
                )}
                {abierto === 'referencia' && (
                  <button
                    type="button"
                    disabled={ocupado || texto.length < 6}
                    onClick={() => onAccion({ accion: 'editar_referencia', referencia: texto })}
                    style={botonAccion('var(--color-brand-500)', ocupado || texto.length < 6)}
                  >
                    {ocupado ? spin : <Save size={14} />} Guardar y buscar
                  </button>
                )}
                <button type="button" onClick={onCerrar} style={botonChico(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <button type="button" disabled={ocupado} onClick={() => onAccion({ accion: 'aprobar' })} style={botonAccion('#10b981', ocupado)}>
                {ocupado ? spin : <Check size={14} />}
                Aprobar {formatUsd(Number(p.amount_usd))}
              </button>
              {pagadoUsd !== null && pagadoUsd !== Number(p.amount_usd) && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => onAccion({ accion: 'aprobar', monto: pagadoUsd })}
                  style={botonAccion('#059669', ocupado)}
                  title="Lo que dice el banco, a la tasa de la compra"
                >
                  <Check size={14} /> Aprobar lo pagado ({formatUsd(pagadoUsd)})
                </button>
              )}
              <button type="button" disabled={ocupado} onClick={() => onAbrir('monto', '')} style={botonChico(false)}>
                Otro monto
              </button>
              <button type="button" disabled={ocupado} onClick={() => onAccion({ accion: 'revalidar' })} style={botonChico(false)}>
                <RefreshCw size={13} /> Revalidar
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => onAbrir('referencia', p.reference.replace(/\D/g, ''))}
                style={botonChico(false)}
              >
                <Pencil size={13} /> Referencia
              </button>
              <button type="button" disabled={ocupado} onClick={() => onAbrir('rechazar')} style={botonChico(false)}>
                Rechazar
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

const cajita: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '6px 8px',
  borderRadius: 8,
  background: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
};

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
        onChange={(e) => setV({ ...v, [k]: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') })}
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
