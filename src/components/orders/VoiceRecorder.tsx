'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2, Check } from 'lucide-react';
import Button from '@/components/ui/Button';

interface VoiceRecorderProps {
  onRecorded: (file: File) => void;
  onCancel: () => void;
}

type Status = 'idle' | 'recording' | 'recorded' | 'denied';

function formatTime(total: number): string {
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function VoiceRecorder({ onRecorded, onCancel }: VoiceRecorderProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<File | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    // Cleanup on unmount: stop mic + timer + release the preview URL.
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
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
        setAudioUrl(URL.createObjectURL(blob));
        setStatus('recorded');
        stopStream();
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
          <Button variant="secondary" size="sm" onClick={onCancel}>
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
                <Button variant="primary" onClick={start}>
                  <Mic size={16} />
                  Grabar
                </Button>
                <Button variant="ghost" onClick={onCancel}>
                  Cancelar
                </Button>
              </>
            )}

            {status === 'recording' && (
              <Button variant="primary" onClick={stop}>
                <Square size={15} />
                Detener
              </Button>
            )}

            {status === 'recorded' && (
              <>
                <Button variant="primary" onClick={use}>
                  <Check size={16} />
                  Usar
                </Button>
                <Button variant="secondary" onClick={discard}>
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
