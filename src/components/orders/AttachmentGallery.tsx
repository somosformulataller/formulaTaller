'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Play,
  Mic,
  FileText,
  X,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { StageAttachment } from '@/lib/types';

interface AttachmentGalleryProps {
  attachments: StageAttachment[];
  canEdit?: boolean;
  onDelete?: (id: string) => void;
  /** Tile size in px (default 72). Tracking uses a slightly larger tile. */
  tile?: number;
}

type Kind = 'image' | 'video' | 'audio' | 'file';

function kindOf(att: StageAttachment): Kind {
  const m = att.mime ?? '';
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  return 'file';
}

async function downloadFile(url: string, name?: string | null) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = name || 'archivo';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export default function AttachmentGallery({
  attachments,
  canEdit = false,
  onDelete,
  tile = 72,
}: AttachmentGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!attachments || attachments.length === 0) return null;

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, ${tile}px)`,
          gap: 8,
          marginTop: 10,
        }}
      >
        {attachments.map((att, i) => (
          <Tile
            key={att.id}
            att={att}
            size={tile}
            canEdit={canEdit}
            onOpen={() => setOpenIndex(i)}
            onDelete={onDelete ? () => onDelete(att.id) : undefined}
          />
        ))}
      </div>

      {openIndex !== null && (
        <Lightbox
          attachments={attachments}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Grid tile (uniform square)
// ---------------------------------------------------------------------------
function Tile({
  att,
  size,
  canEdit,
  onOpen,
  onDelete,
}: {
  att: StageAttachment;
  size: number;
  canEdit: boolean;
  onOpen: () => void;
  onDelete?: () => void;
}) {
  const kind = kindOf(att);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <button
        onClick={onOpen}
        title={att.name ?? 'Adjunto'}
        style={{
          width: size,
          height: size,
          padding: 0,
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
          background: kind === 'video' ? '#000' : 'var(--color-surface-2)',
          cursor: 'pointer',
          display: 'block',
          position: 'relative',
        }}
      >
        {kind === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={att.url}
            alt={att.name ?? 'foto'}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}

        {kind === 'video' && (
          <>
            <video
              src={att.url}
              muted
              playsInline
              preload="metadata"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <Overlay>
              <Play size={20} color="#fff" fill="#fff" />
            </Overlay>
          </>
        )}

        {kind === 'audio' && (
          <Centered color="var(--color-brand-400)">
            <Mic size={22} />
            <span style={{ fontSize: 10, fontWeight: 700, marginTop: 4 }}>Voz</span>
          </Centered>
        )}

        {kind === 'file' && (
          <Centered color="var(--color-text-secondary)">
            <FileText size={22} />
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                marginTop: 4,
                maxWidth: size - 12,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                padding: '0 4px',
              }}
            >
              {att.name ?? 'Documento'}
            </span>
          </Centered>
        )}
      </button>

      {canEdit && onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Eliminar adjunto"
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#ef4444',
            border: '2px solid var(--color-surface)',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.25)',
      }}
    >
      {children}
    </span>
  );
}

function Centered({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color,
      }}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Lightbox (large view + download + navigation)
// ---------------------------------------------------------------------------
function Lightbox({
  attachments,
  index,
  onIndexChange,
  onClose,
}: {
  attachments: StageAttachment[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const att = attachments[index];
  const many = attachments.length > 1;

  const go = (dir: number) => {
    const next = (index + dir + attachments.length) % attachments.length;
    onIndexChange(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, attachments.length]);

  if (!mounted || !att) return null;

  const kind = kindOf(att);

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.9)',
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {att.name ?? 'Adjunto'}
          {many && (
            <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 8 }}>
              {index + 1}/{attachments.length}
            </span>
          )}
        </span>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <IconBtn label="Descargar" onClick={() => downloadFile(att.url, att.name)}>
            <Download size={18} />
          </IconBtn>
          <IconBtn label="Cerrar" onClick={onClose}>
            <X size={18} />
          </IconBtn>
        </div>
      </div>

      {/* Content */}
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          minHeight: 0,
          position: 'relative',
        }}
      >
        {many && (
          <IconBtn label="Anterior" onClick={() => go(-1)}>
            <ChevronLeft size={22} />
          </IconBtn>
        )}

        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 0,
            minHeight: 0,
            height: '100%',
          }}
        >
          {kind === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={att.url}
              alt={att.name ?? 'foto'}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
            />
          )}

          {kind === 'video' && (
            <video
              src={att.url}
              controls
              autoPlay
              playsInline
              style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, background: '#000' }}
            />
          )}

          {kind === 'audio' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 18,
                padding: 24,
                width: '100%',
                maxWidth: 420,
              }}
            >
              <div
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: '50%',
                  background: 'rgba(245,158,11,0.15)',
                  border: '1px solid rgba(245,158,11,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-brand-400)',
                }}
              >
                <Mic size={38} />
              </div>
              <audio src={att.url} controls autoPlay style={{ width: '100%' }} />
            </div>
          )}

          {kind === 'file' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                color: '#fff',
                textAlign: 'center',
              }}
            >
              <FileText size={64} color="rgba(255,255,255,0.7)" />
              <span style={{ fontSize: 14, fontWeight: 600, maxWidth: 280, wordBreak: 'break-word' }}>
                {att.name ?? 'Documento'}
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={pillStyle}
                >
                  Abrir
                </a>
                <button onClick={() => downloadFile(att.url, att.name)} style={pillStyle}>
                  <Download size={15} /> Descargar
                </button>
              </div>
            </div>
          )}
        </div>

        {many && (
          <IconBtn label="Siguiente" onClick={() => go(1)}>
            <ChevronRight size={22} />
          </IconBtn>
        )}
      </div>
    </div>,
    document.body
  );
}

const pillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '10px 16px',
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none',
  cursor: 'pointer',
};

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.12)',
        border: '1px solid rgba(255,255,255,0.2)',
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}
