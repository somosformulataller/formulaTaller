'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Send, Sparkles, Trash2 } from 'lucide-react';
import VoiceRecorder from '@/components/orders/VoiceRecorder';
import { useSaldo } from '@/components/saldo/SaldoProvider';
import { formatPrecioUsd, formatUsd } from '@/lib/budget';
import { transcribir } from '@/lib/reminder-upload';

type Turno = { role: 'user' | 'assistant'; content: string };

const CLAVE = 'ft-asistente-chat';
const SUGERENCIAS = [
  '¿Qué órdenes tengo en progreso?',
  '¿Cuánto presupuesté este mes?',
  '¿Qué recordatorios tengo esta semana?',
  '¿Qué presupuestos rechazó algún cliente?',
];

/**
 * Chat con el asistente IA. Responde solo con los datos de este taller. La
 * conversación se guarda en esta pestaña (sessionStorage) para no perderla al
 * cambiar de pantalla; al cerrar la pestaña empieza de cero.
 */
export default function AsistenteClient() {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grabando, setGrabando] = useState(false);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const cuadroRef = useRef<HTMLTextAreaElement>(null);
  const saldo = useSaldo();

  useEffect(() => {
    try {
      const guardado = sessionStorage.getItem(CLAVE);
      if (guardado) setTurnos(JSON.parse(guardado));
    } catch {
      /* sin almacenamiento: se empieza vacío */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE, JSON.stringify(turnos.slice(-40)));
    } catch {
      /* ignorar */
    }
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turnos, pensando]);

  // El cuadro crece con el texto (hasta un tope) para leer la pregunta
  // completa, sobre todo la que llega de una nota de voz.
  useEffect(() => {
    const el = cuadroRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, 160)}px`;
  }, [texto]);

  // La nota de voz se pasa a texto y queda en el cuadro para revisarla antes
  // de enviarla; el audio no se guarda. Una segunda nota se suma a lo escrito.
  async function alGrabar(file: File) {
    setGrabando(false);
    setError(null);
    setTranscribiendo(true);
    try {
      const { texto: dicho } = await transcribir(file, 'pregunta');
      if (!dicho) {
        setError('No se entendió ninguna pregunta en la nota. Vuelve a grabar o escríbela.');
        return;
      }
      setTexto((prev) => (prev.trim() ? `${prev.trim()} ${dicho}` : dicho));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo pasar la nota a texto.');
    } finally {
      setTranscribiendo(false);
    }
  }

  async function enviar(pregunta: string) {
    const q = pregunta.trim();
    if (!q || pensando) return;
    setError(null);
    // Sin saldo ni se intenta: el aviso trae el botón para comprar.
    if (saldo && !saldo.alcanza(saldo.precios.preguntaIa)) {
      saldo.avisarSinSaldo('No tienes saldo suficiente para preguntarle al asistente. Compra saldo para seguir usándolo.');
      return;
    }
    const siguientes: Turno[] = [...turnos, { role: 'user', content: q }];
    setTurnos(siguientes);
    setTexto('');
    setPensando(true);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: siguientes }),
      });
      const data = await res.json().catch(() => ({}));
      if (typeof data.saldo === 'number') saldo?.setSaldo(data.saldo);
      if (res.status === 402 && data.saldoInsuficiente) {
        // La pregunta no se cobró: vuelve al cuadro para mandarla después de recargar.
        setTurnos(turnos);
        setTexto(q);
        saldo?.refrescar();
        saldo?.avisarSinSaldo(data.error);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'No pude responder en este momento.');
      setTurnos((prev) => [...prev, { role: 'assistant', content: String(data.reply ?? '') }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pude responder en este momento.');
    } finally {
      setPensando(false);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 16,
        minHeight: 'calc(100dvh - var(--top-bar-height) - var(--bottom-nav-height) - 48px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
            <Sparkles size={20} style={{ color: 'var(--color-brand-400)' }} />
            Asistente
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Pregúntame por tus órdenes, clientes, presupuestos y recordatorios.
          </p>
        </div>
        {turnos.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setTurnos([]);
              setError(null);
            }}
            aria-label="Nueva conversación"
            title="Nueva conversación"
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 10px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
              color: 'var(--color-text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Trash2 size={13} />
            Nueva
          </button>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 12 }}>
        {turnos.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Prueba con
            </p>
            {SUGERENCIAS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => enviar(s)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-2)',
                  color: 'var(--color-text-primary)',
                  fontSize: 13.5,
                  cursor: 'pointer',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {turnos.map((t, i) => (
          <div
            key={i}
            style={{
              alignSelf: t.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              padding: '10px 13px',
              borderRadius: 14,
              borderBottomRightRadius: t.role === 'user' ? 4 : 14,
              borderBottomLeftRadius: t.role === 'user' ? 14 : 4,
              background: t.role === 'user' ? 'rgba(245,158,11,0.16)' : 'var(--color-surface-2)',
              border: `1px solid ${t.role === 'user' ? 'rgba(245,158,11,0.35)' : 'var(--color-border)'}`,
              fontSize: 14,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            }}
          >
            {t.role === 'assistant' ? <TextoConFormato texto={t.content} /> : t.content}
          </div>
        ))}

        {pensando && (
          <div
            style={{
              alignSelf: 'flex-start',
              padding: '10px 13px',
              borderRadius: 14,
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              fontSize: 13,
              color: 'var(--color-text-muted)',
            }}
          >
            Buscando en tus datos…
          </div>
        )}
        {error && <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>}
        {transcribiendo && (
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            Pasando la nota de voz a texto…
          </p>
        )}
        {saldo && (
          <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
            Cada pregunta cuesta {formatPrecioUsd(saldo.precios.preguntaIa)} · Tu saldo: {formatUsd(saldo.saldo)}
          </p>
        )}
        <div ref={finRef} />
      </div>

      {grabando && (
        <div
          style={{
            position: 'sticky',
            bottom: 'calc(var(--bottom-nav-height) + 70px)',
            marginBottom: 8,
            border: '1px solid var(--color-border)',
            borderRadius: 14,
            padding: '4px 12px',
            background: 'var(--color-bg)',
          }}
        >
          <VoiceRecorder onRecorded={alGrabar} onCancel={() => setGrabando(false)} entregarAlDetener grabarAlAbrir />
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
        style={{
          position: 'sticky',
          bottom: 'calc(var(--bottom-nav-height) + 8px)',
          display: 'flex',
          gap: 8,
          padding: 8,
          borderRadius: 14,
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg)',
        }}
      >
        <textarea
          ref={cuadroRef}
          className="form-input"
          rows={2}
          maxLength={2000}
          placeholder="Escribe o graba tu pregunta…"
          value={texto}
          disabled={transcribiendo}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              enviar(texto);
            }
          }}
          style={{ flex: 1, resize: 'none', minHeight: 64, maxHeight: 160, lineHeight: 1.4 }}
        />
        <button
          type="button"
          onClick={() => {
            setError(null);
            setGrabando(true);
          }}
          disabled={pensando || grabando || transcribiendo}
          aria-label="Grabar pregunta por voz"
          title="Grabar pregunta por voz"
          style={{
            width: 44,
            height: 42,
            flexShrink: 0,
            borderRadius: 10,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            color: 'var(--color-brand-400)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: pensando || grabando || transcribiendo ? 'default' : 'pointer',
            opacity: pensando || grabando || transcribiendo ? 0.5 : 1,
          }}
        >
          <Mic size={20} />
        </button>
        <button
          type="submit"
          disabled={pensando || !texto.trim()}
          aria-label="Enviar"
          style={{
            width: 44,
            height: 42,
            flexShrink: 0,
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700))',
            color: '#0D0F1A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: pensando || !texto.trim() ? 'default' : 'pointer',
            opacity: pensando || !texto.trim() ? 0.5 : 1,
          }}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

/** Negritas **así** del modelo, sin meter HTML crudo en la página. */
function TextoConFormato({ texto }: { texto: string }) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {partes.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>
      )}
    </>
  );
}
