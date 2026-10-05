'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2, Check } from 'lucide-react';
import Button from '@/components/ui/Button';

interface VoiceRecorderProps {
  onRecorded: (file: File) => void;
  onCancel: () => void;
  /**
   * Entrega la nota apenas se detiene, sin el paso de escucharla y tocar
   * «Usar». Lo usan las notas que se pasan a texto solas.
   */
  entregarAlDetener?: boolean;
  /** Empieza a grabar apenas aparece (el toque en el micrófono ya fue la orden). */
  grabarAlAbrir?: boolean;
}

type Status = 'idle' | 'recording' | 'recorded' | 'denied';

function formatTime(total: number): string {
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function VoiceRecorder({ onRecorded, onCancel, entregarAlDetener = false, grabarAlAbrir = false }: VoiceRecorderProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<File | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // onstop se arma al empezar a grabar: con la ref usa siempre el onRecorded actual.
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // La ref evita arrancar dos veces (React monta dos veces en desarrollo).
  const arrancoRef = useRef(false);
  useEffect(() => {
    if (!grabarAlAbrir || arrancoRef.current) return;
    arrancoRef.current = true;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Cleanup on unmount: stop mic + timer + release the preview URL.
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      // Si se cierra a media grabación, que no entregue nada después.
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      stopStream();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `nota-de-voz-${Date.now()}.${ext}`, { type });
        fileRef.current = file;
        stopStream();
        if (entregarAlDetener) {
          onRecordedRef.current(file);
          return;
        }
        setAudioUrl(URL.createObjectURL(blob));
        setStatus('recorded');
      };

      recorderRef.current = recorder;
      recorder.start();
      setSeconds(0);
      setStatus('recording');
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setStatus('denied');
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
  }

  function discard() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    fileRef.current = null;
    setSeconds(0);
    setStatus('idle');
  }

  function use() {
    if (fileRef.current) onRecorded(fileRef.current);
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: '12px 0',
      }}
    >
      {status === 'denied' ? (
        <>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
            No se pudo acceder al micrófono. Revisa los permisos del navegador e inténtalo de nuevo.
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            Cerrar
          </Button>
        </>
      ) : (
        <>
          {/* Mic indicator + timer */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background:
                status === 'recording' ? 'rgba(239,68,68,0.15)' : 'var(--color-surface-2)',
              border: `1px solid ${status === 'recording' ? 'rgba(239,68,68,0.4)' : 'var(--color-border)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: status === 'recording' ? '#ef4444' : 'var(--color-text-secondary)',
              animation: status === 'recording' ? 'pulse-glow 1.5s ease-in-out infinite' : 'none',
            }}
          >
            <Mic size={30} />
          </div>

          <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(seconds)}
          </span>

          {/* Audio preview */}
          {status === 'recorded' && audioUrl && (
            <audio src={audioUrl} controls style={{ width: '100%' }} />
          )}

          {/* Controls */}
          <div style={{ display: 'flex', gap: 10 }}>
            {status === 'idle' && (
              <>
                <Button type="button" variant="primary" onClick={start}>
                  <Mic size={16} />
                  Grabar
                </Button>
                <Button type="button" variant="ghost" onClick={onCancel}>
                  Cancelar
                </Button>
              </>
            )}

            {status === 'recording' && (
              <Button type="button" variant="primary" onClick={stop}>
                <Square size={15} />
                Detener
              </Button>
            )}

            {status === 'recorded' && (
              <>
                <Button type="button" variant="primary" onClick={use}>
                  <Check size={16} />
                  Usar
                </Button>
                <Button type="button" variant="secondary" onClick={discard}>
                  <Trash2 size={15} />
                  Regrabar
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
