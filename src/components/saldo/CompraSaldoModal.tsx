'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Clock, Copy, ImagePlus, Loader2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { formatUsd } from '@/lib/budget';
import { compressImage } from '@/lib/image';
import TasaDelDia from '@/components/saldo/TasaDelDia';

const MONTOS = [5, 10, 20];
const MIN_USD = 1;
const MAX_USD = 1000;

interface PagoMovil {
  bank: string | null;
  phone: string | null;
  document: string | null;
  holder: string | null;
}

interface Compra {
  id: string;
  amount_usd: number;
  amount_ves: number | null;
  status: 'pendiente' | 'aprobado' | 'rechazado';
  created_at: string;
}

/** Avisa a la pantalla de saldo que hay una compra nueva para recargar la lista. */
export const EVENTO_COMPRA = 'saldo:compra';

function formatBs(n: number): string {
  return `Bs. ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

/**
 * Comprar saldo por Pago Móvil: el taller elige el monto, ve cuánto es en Bs
 * a tasa BCV, paga desde su banco y sube la captura con la referencia. El
 * pago queda en revisión hasta que lo aprobamos en el superadmin.
 */
export default function CompraSaldoModal({ onClose }: { onClose: () => void }) {
  const [fase, setFase] = useState<'cargando' | 'form' | 'enviando' | 'enviado' | 'pendiente'>('cargando');
  const [pagoMovil, setPagoMovil] = useState<PagoMovil | null>(null);
  const [tasa, setTasa] = useState<number | null>(null);
  const [pendiente, setPendiente] = useState<Compra | null>(null);

  const [monto, setMonto] = useState('10');
  const [referencia, setReferencia] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Al tocar «Enviar» sin referencia o sin captura, se marca en rojo lo que falta.
  const [faltaRef, setFaltaRef] = useState(false);
  const [faltaCaptura, setFaltaCaptura] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    // La tasa la consulta <TasaDelDia />, que la muestra siempre arriba.
    fetch('/api/saldo', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((s) => {
      if (!vivo) return;
      setPagoMovil(s?.pagoMovil ?? null);
      const p = ((s?.compras ?? []) as Compra[]).find((c) => c.status === 'pendiente') ?? null;
      setPendiente(p);
      setFase(p ? 'pendiente' : 'form');
    });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => () => {
    if (vista) URL.revokeObjectURL(vista);
  }, [vista]);

  const usd = Math.round(Number(monto.replace(',', '.')) * 100) / 100;
  const montoValido = Number.isFinite(usd) && usd >= MIN_USD && usd <= MAX_USD;
  const bs = tasa && montoValido ? Math.round(usd * tasa * 100) / 100 : null;

  async function copiar(texto: string, clave: string) {
    try {
      await navigator.clipboard?.writeText(texto);
      setCopiado(clave);
      setTimeout(() => setCopiado((c) => (c === clave ? null : c)), 1500);
    } catch {
      /* el dato igual está a la vista */
    }
  }

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) return setError('El comprobante debe ser una imagen (captura de pantalla).');
    setError(null);
    setFaltaCaptura(false);
    const comprimida = await compressImage(f);
    setArchivo(comprimida);
    setVista(URL.createObjectURL(comprimida));
  }

  async function enviar() {
    setError(null);
    if (!montoValido) return setError(`El monto debe estar entre $${MIN_USD} y $${MAX_USD}.`);
    const sinRef = referencia.replace(/\D/g, '').length < 4;
    setFaltaRef(sinRef);
    setFaltaCaptura(!archivo);
    if (sinRef && !archivo) return setError('Falta el número de referencia y la captura del pago.');
    if (sinRef) return setError('Falta el número de referencia del pago.');
    if (!archivo) return setError('Falta la captura del pago. Súbela para poder enviarlo.');

    setFase('enviando');
    const form = new FormData();
    form.append('amount_usd', String(usd));
    form.append('reference', referencia.trim());
    form.append('file', archivo, archivo.name || 'comprobante.jpg');
    try {
      const r = await fetch('/api/saldo/compras', { method: 'POST', body: form });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setFase('form');
        return setError(data.error || 'No se pudo enviar el pago. Inténtalo de nuevo.');
      }
      setPendiente(data as Compra);
      setFase('enviado');
      window.dispatchEvent(new Event(EVENTO_COMPRA));
    } catch {
      setFase('form');
      setError('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.');
    }
  }

  const faltanDatos = !pagoMovil?.bank || !pagoMovil?.phone || !pagoMovil?.document;

  return (
    <Modal isOpen onClose={onClose} title="Comprar saldo">
      {fase === 'cargando' && (
        <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…
        </p>
      )}

      {(fase === 'pendiente' || fase === 'enviado') && pendiente && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(245,158,11,0.12)',
              color: 'var(--color-brand-400)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clock size={26} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700 }}>
            {fase === 'enviado' ? '¡Recibimos tu pago!' : 'Tienes un pago en revisión'}
          </p>
          <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)' }}>
            Estamos revisando tu pago de <b>{formatUsd(Number(pendiente.amount_usd))}</b>
            {pendiente.amount_ves ? ` (${formatBs(Number(pendiente.amount_ves))})` : ''}. Cuando lo aprobemos, el
            saldo se suma solo y te avisamos en la campana 🔔.
          </p>
          <Button type="button" variant="primary" fullWidth onClick={onClose}>
            Entendido
          </Button>
        </div>
      )}

      {(fase === 'form' || fase === 'enviando') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TasaDelDia onTasa={(t) => setTasa(t?.rate ?? null)} />

          {/* 1. Monto */}
          <div className="form-field">
            <label className="form-label">1. ¿Cuánto saldo quieres comprar?</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {MONTOS.map((m) => {
                const activo = usd === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMonto(String(m))}
                    style={{
                      flex: 1,
                      minWidth: 64,
                      padding: '10px 0',
                      borderRadius: 10,
                      fontSize: 15,
                      fontWeight: 800,
                      border: `1px solid ${activo ? 'var(--color-brand-400)' : 'var(--color-border)'}`,
                      background: activo ? 'rgba(245,158,11,0.15)' : 'var(--color-surface-2)',
                      color: activo ? 'var(--color-brand-400)' : 'var(--color-text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    ${m}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Otro monto: $</span>
              <input
                className="form-input"
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value.replace(/[^\d.,]/g, '').slice(0, 7))}
                style={{ width: 110 }}
              />
              {bs !== null && (
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)' }}>= {formatBs(bs)}</span>
              )}
            </div>
          </div>

          {/* 2. Datos de Pago Móvil */}
          <div className="form-field">
            <label className="form-label">2. Paga por Pago Móvil</label>
            {faltanDatos ? (
              <p style={{ fontSize: 13, color: '#fbbf24' }}>
                Todavía no están cargados los datos de pago. Escríbenos por WhatsApp desde el botón de soporte.
              </p>
            ) : (
              <div
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <DatoPago etiqueta="Banco" valor={pagoMovil!.bank!} />
                <DatoPago
                  etiqueta="Teléfono"
                  valor={pagoMovil!.phone!}
                  copiado={copiado === 'tel'}
                  onCopiar={() => copiar(pagoMovil!.phone!.replace(/\D/g, ''), 'tel')}
                />
                <DatoPago
                  etiqueta="C.I. / RIF"
                  valor={pagoMovil!.document!}
                  copiado={copiado === 'doc'}
                  onCopiar={() => copiar(pagoMovil!.document!.replace(/[^\dA-Za-z]/g, ''), 'doc')}
                />
                {pagoMovil!.holder && <DatoPago etiqueta="Titular" valor={pagoMovil!.holder} />}
                <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
                {bs !== null ? (
                  <DatoPago
                    etiqueta="Monto a pagar"
                    valor={formatBs(bs)}
                    destacado
                    copiado={copiado === 'bs'}
                    onCopiar={() => copiar(bs.toFixed(2).replace('.', ','), 'bs')}
                  />
                ) : (
                  <DatoPago etiqueta="Monto a pagar" valor={montoValido ? `${formatUsd(usd)} a tasa BCV del día` : '—'} />
                )}
                {tasa && (
                  <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                    Tasa BCV: Bs. {new Intl.NumberFormat('es-VE', { maximumFractionDigits: 4 }).format(tasa)} por dólar.
                    Paga el monto exacto.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 3. Comprobante */}
          <div className="form-field">
            <label className="form-label">3. Envía el comprobante</label>
            <input
              className="form-input"
              inputMode="numeric"
              placeholder="Número de referencia"
              maxLength={30}
              value={referencia}
              onChange={(e) => {
                setReferencia(e.target.value.replace(/[^\d]/g, ''));
                setFaltaRef(false);
              }}
              style={faltaRef ? { borderColor: 'var(--color-danger)' } : undefined}
            />
            {faltaRef && (
              <p style={{ color: 'var(--color-danger)', fontSize: 12.5, marginTop: 4 }}>Escribe el número de referencia.</p>
            )}
            <input ref={input} type="file" accept="image/*" hidden onChange={elegir} />
            {vista ? (
              <div style={{ position: 'relative', width: 96, marginTop: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={vista}
                  alt="Comprobante"
                  style={{ width: 96, height: 128, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--color-border)' }}
                />
                <button
                  type="button"
                  aria-label="Quitar comprobante"
                  onClick={() => {
                    setArchivo(null);
                    setVista(null);
                  }}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#ef4444',
                    border: '2px solid var(--color-surface)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => input.current?.click()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 10,
                  padding: '10px 14px',
                  background: 'var(--color-surface-2)',
                  border: `1px dashed ${faltaCaptura ? 'var(--color-danger)' : 'var(--color-border)'}`,
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  color: faltaCaptura ? 'var(--color-danger)' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  alignSelf: 'flex-start',
                }}
              >
                <ImagePlus size={16} />
                Subir captura del pago
              </button>
            )}
            {faltaCaptura && !vista && (
              <p style={{ color: 'var(--color-danger)', fontSize: 12.5, marginTop: 4 }}>
                Falta la captura del pago. Es obligatoria para revisarlo.
              </p>
            )}
          </div>

          {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}

          <Button
            type="button"
            variant="primary"
            fullWidth
            loading={fase === 'enviando'}
            disabled={faltanDatos}
            onClick={enviar}
          >
            Enviar pago
          </Button>
          <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)', textAlign: 'center', marginTop: -6 }}>
            Revisamos cada pago a mano. Cuando lo aprobemos, el saldo se suma solo.
          </p>
        </div>
      )}
    </Modal>
  );
}

function DatoPago({
  etiqueta,
  valor,
  destacado,
  copiado,
  onCopiar,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
  copiado?: boolean;
  onCopiar?: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{etiqueta}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <b
          style={{
            fontSize: destacado ? 15 : 13,
            color: destacado ? 'var(--color-brand-400)' : 'inherit',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {valor}
        </b>
        {onCopiar && (
          <button
            type="button"
            onClick={onCopiar}
            aria-label={`Copiar ${etiqueta.toLowerCase()}`}
            style={{
              background: 'none',
              border: 'none',
              padding: 2,
              cursor: 'pointer',
              color: copiado ? '#34d399' : 'var(--color-text-muted)',
              display: 'flex',
            }}
          >
            {copiado ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
      </span>
    </div>
  );
}
