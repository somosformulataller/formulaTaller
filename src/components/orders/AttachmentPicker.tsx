'use client';

import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Image as ImageIcon, Camera, Video, Mic, FileText, Music, X } from 'lucide-react';
import VoiceRecorder from './VoiceRecorder';

interface AttachmentPickerProps {
  onFiles: (files: File[]) => void;
  onClose: () => void;
}

const DOC_ACCEPT =
  'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,.pdf,.doc,.docx,.xls,.xlsx,.txt';

export default function AttachmentPicker({ onFiles, onClose }: AttachmentPickerProps) {
  const [mode, setMode] = useState<'menu' | 'record'>('menu');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const galleryRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length) {
      onFiles(files);
      onClose();
    }
  }

  if (!mounted) return null;

  const title = mode === 'record' ? 'Grabar nota de voz' : 'Agregar a la etapa';

  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {mode === 'record' ? (
          <VoiceRecorder
            onRecorded={(file) => {
              onFiles([file]);
              onClose();
            }}
            onCancel={() => setMode('menu')}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Option
              icon={<ImageIcon size={18} />}
              label="Foto o video desde galería"
              onClick={() => galleryRef.current?.click()}
            />
            <Option
              icon={<Camera size={18} />}
              label="Tomar una foto"
              onClick={() => photoRef.current?.click()}
            />
            <Option
              icon={<Video size={18} />}
              label="Hacer un video"
              onClick={() => videoRef.current?.click()}
            />
            <Option
              icon={<Mic size={18} />}
              label="Grabar nota de voz"
              onClick={() => setMode('record')}
            />
            <Option
              icon={<Music size={18} />}
              label="Adjuntar nota de voz"
              onClick={() => audioRef.current?.click()}
            />
            <Option
              icon={<FileText size={18} />}
              label="Adjuntar documento"
              onClick={() => docRef.current?.click()}
            />
          </div>
        )}

        {/* Hidden inputs */}
        <input
          ref={galleryRef}
          type="file"
          accept="image/*,video/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleInput}
        />
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleInput}
        />
        <input
          ref={videoRef}
          type="file"
          accept="video/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleInput}
        />
        <input
          ref={audioRef}
          type="file"
          accept="audio/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleInput}
        />
        <input
          ref={docRef}
          type="file"
          accept={DOC_ACCEPT}
          multiple
          style={{ display: 'none' }}
          onChange={handleInput}
        />
      </div>
    </div>,
    document.body
  );
}

function Option({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '14px 14px',
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        color: 'var(--color-text-primary)',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 38,
          height: 38,
          borderRadius: 8,
          background: 'rgba(245,158,11,0.12)',
          color: 'var(--color-brand-400)',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}
