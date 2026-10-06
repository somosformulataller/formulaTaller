'use client';

import { useState } from 'react';
import { ClipboardCheck, Loader2, Mic, type LucideIcon } from 'lucide-react';
import VoiceRecorder from '@/components/orders/VoiceRecorder';
import { transcribir } from '@/lib/reminder-upload';

/**
 * Un cuadro de texto con micrófono. Al detener la nota, la app la pasa a
 * texto quedándose solo con lo que importa según el modo (las condiciones
 * previas del vehículo, lo que presenta, o el recordatorio); lo demás que se
 * haya hablado no entra. El texto queda editable y se suma si se graba otra
 * nota. El audio no se guarda.
 */
export default function CampoNotaDeVoz({
  value,
  onChange,
  disabled,
  titulo = 'Condiciones previas del vehículo',
  modo = 'condiciones',
  placeholder = 'Toca el micrófono y di cómo llega el carro: golpes, rayones, kilometraje, combustible…',
  vacio = 'No se escuchó nada sobre el estado del vehículo. Vuelve a grabar o escríbelo.',
  Icono = ClipboardCheck,
  onTitulo,
}: {
  value: string;
  titulo?: string;
  /** Qué se queda de la nota: el estado al recibirlo, lo que presenta (la falla) o el recordatorio. */
  modo?: 'condiciones' | 'falla' | 'recordatorio';
  placeholder?: string;
  /** Aviso cuando la nota no trae nada de lo que se busca. */
  vacio?: string;
  Icono?: LucideIcon;
  onChange: (v: string) => void;
  /** Recordatorio: el título que sugiere la IA según lo que se dijo en la nota. */
  onTitulo?: (t: string) => void;
  disabled?: boolean;
}) {
  const [grabando, setGrabando] = useState(false);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function alGrabar(file: File) {
    setGrabando(false);
    setAviso(null);
    setTranscribiendo(true);
    try {
      const { texto, titulo } = await transcribir(file, modo);
      if (!texto) {
        setAviso(vacio);
        return;
      }
      if (titulo) onTitulo?.(titulo);
      // Una segunda nota se suma a lo que ya había.
      onChange(value.trim() ? `${value.trim()}\n${texto}` : texto);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo pasar la nota a texto.');
    } finally {
      setTranscribiendo(false);
    }
  }

  return (
    <div className="form-field">
      <label className="form-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Icono size={14} style={{ color: 'var(--color-brand-400)' }} />
        {titulo}
      </label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <textarea
          className="form-input"
          rows={value ? 4 : 2}
          maxLength={2000}
          placeholder={placeholder}
          value={value}
          disabled={disabled || transcribiendo}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          onClick={() => {
            setAviso(null);
            setGrabando(true);
          }}
          disabled={disabled || grabando || transcribiendo}
          aria-label="Grabar nota de voz"
          title="Grabar nota de voz"
          style={{
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: 10,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            color: 'var(--color-brand-400)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Mic size={20} />
        </button>
      </div>

      {grabando && (
        <div style={{ marginTop: 10, border: '1px solid var(--color-border)', borderRadius: 10, padding: '4px 12px' }}>
          <VoiceRecorder onRecorded={alGrabar} onCancel={() => setGrabando(false)} entregarAlDetener grabarAlAbrir />
        </div>
      )}

      {transcribiendo && (
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--color-text-secondary)', marginTop: 8 }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          Pasando la nota de voz a texto…
        </p>
      )}
      {aviso && <p style={{ fontSize: 12, color: '#fbbf24', marginTop: 6 }}>{aviso}</p>}
    </div>
  );
}
