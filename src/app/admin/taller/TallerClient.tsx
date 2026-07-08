'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  ExternalLink,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PhoneInput from '@/components/ui/PhoneInput';
import Modal from '@/components/ui/Modal';
import CopyLinkButton from '@/components/orders/CopyLinkButton';
import { compressImage } from '@/lib/image';
import { createClient } from '@/lib/supabase/client';
import type { Workshop } from '@/lib/types';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// Ocultar temporalmente la opción de eliminar la cuenta del taller.
// Poner en true para volver a mostrarla.
const SHOW_DELETE_ACCOUNT = false;

export default function TallerClient({ workshop }: { workshop: Workshop }) {
  const router = useRouter();
  const [name, setName] = useState(workshop.name);
  const [whatsapp, setWhatsapp] = useState(workshop.whatsapp ?? '');
  const [logoUrl, setLogoUrl] = useState(workshop.logo_url);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [showDelete, setShowDelete] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loginUrl = `${SITE_URL}/login/${workshop.slug}`;

  // Confirmación tolerante: ignora mayúsculas/minúsculas, acentos y espacios
  // extra (antes exigía coincidencia EXACTA y el botón no se habilitaba si el
  // nombre tenía mayúsculas o acentos).
  const normalizeName = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  const nameMatches =
    confirmName.trim().length > 0 && normalizeName(confirmName) === normalizeName(workshop.name);

  async function handleDeleteAccount() {
    setDeleteError(null);
    setDeleting(true);

    let res: Response;
    try {
      res = await fetch(`/api/workshops/${workshop.id}`, { method: 'DELETE' });
    } catch {
      setDeleting(false);
      setDeleteError('No se pudo conectar. Revisa tu conexión e intenta de nuevo.');
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDeleting(false);
      setDeleteError(data.error || 'No se pudo eliminar la cuenta.');
      return;
    }

    // La cuenta (y el usuario) ya no existen. Cerramos sesión ignorando errores
    // —el usuario ya fue borrado— y salimos con una RECARGA COMPLETA: un
    // router.replace no siempre navegaba al borrar la propia cuenta, y parecía
    // que "no pasaba nada". window.location limpia todo el estado del cliente.
    try {
      await createClient().auth.signOut();
    } catch {
      /* el usuario ya no existe; ignorar */
    }
    window.location.href = '/registro';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!name.trim()) {
      setError('El nombre del taller es obligatorio.');
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/workshops/${workshop.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), whatsapp: whatsapp.trim() }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'No se pudo guardar.');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    e.target.value = '';
    if (!original) return;
    setError(null);
    setUploading(true);
    try {
      const file = await compressImage(original);
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/workshops/${workshop.id}/logo`, { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo subir el logo.');
      }
      const updated = (await res.json()) as Workshop;
      setLogoUrl(updated.logo_url);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el logo.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Perfil del Taller</h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginBottom: 20 }}>
        Estos datos identifican tu taller. El nombre y el logo aparecen en tu panel, en el login
        personalizado y en el seguimiento que ven tus clientes.
      </p>

      {/* Logo */}
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Logo del taller</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 14,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo del taller"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <ImageIcon size={26} color="var(--color-text-muted)" />
            )}
          </div>

          <div style={{ flex: 1 }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <ImageIcon size={14} />
              )}
              {uploading ? 'Subiendo...' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
            </Button>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
              Imagen cuadrada (PNG o JPG). Se optimiza automáticamente.
            </p>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleLogo}
            />
          </div>
        </div>
      </div>

      {/* Personalized login link */}
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Tu login personalizado</p>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
          Comparte este enlace con tu equipo. Muestra el nombre y el logo de tu taller.
        </p>
        <div
          style={{
            padding: '10px 12px',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            fontSize: 13,
            wordBreak: 'break-all',
            marginBottom: 10,
            color: 'var(--color-brand-400)',
            fontWeight: 600,
          }}
        >
          {loginUrl}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <CopyLinkButton url={loginUrl} label="Copiar enlace" />
          <a
            href={loginUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              color: 'var(--color-text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={14} />
            Abrir
          </a>
        </div>
      </div>

      {/* Datos del taller */}
      <div className="card" style={{ padding: 24 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Nombre del taller"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            required
            icon={<Store size={15} />}
            id="taller-name"
          />

          <PhoneInput
            label="WhatsApp del taller"
            value={whatsapp}
            onChange={(v) => {
              setWhatsapp(v);
              setSaved(false);
            }}
            id="taller-whatsapp"
          />

          {error && (
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8,
                color: '#f87171',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {saved && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: 8,
                color: '#34d399',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={16} />
              Cambios guardados
            </div>
          )}

          <Button type="submit" variant="primary" fullWidth loading={loading}>
            Guardar cambios
          </Button>
        </form>
      </div>

      {SHOW_DELETE_ACCOUNT && (
        <>
      {/* Danger zone */}
      <div
        className="card"
        style={{
          padding: 24,
          marginTop: 16,
          border: '1px solid rgba(239,68,68,0.3)',
          background: 'rgba(239,68,68,0.04)',
        }}
      >
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: '#f87171' }}>
          Zona de peligro
        </p>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
          Eliminar la cuenta borra <strong>permanentemente</strong> el taller, sus usuarios,
          órdenes y adjuntos. Esta acción no se puede deshacer.
        </p>
        <button
          onClick={() => {
            setConfirmName('');
            setDeleteError(null);
            setShowDelete(true);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 14px',
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.35)',
            borderRadius: 8,
            color: '#f87171',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Trash2 size={15} />
          Eliminar cuenta del taller
        </button>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={showDelete}
        onClose={() => !deleting && setShowDelete(false)}
        title="Eliminar cuenta del taller"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              gap: 10,
              padding: '12px 14px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8,
              color: '#f87171',
              fontSize: 13,
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Se eliminarán <strong>para siempre</strong> el taller, todos sus mecánicos, órdenes,
              etapas y adjuntos. Los enlaces de tracking dejarán de funcionar.
            </span>
          </div>

          <div className="form-field">
            <label className="form-label">
              Para confirmar, escribe el nombre del taller: <strong>{workshop.name}</strong>
            </label>
            <input
              className="form-input"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={workshop.name}
              autoFocus
            />
          </div>

          {deleteError && (
            <div style={{ color: '#f87171', fontSize: 13 }}>{deleteError}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Button
              type="button"
              variant="danger"
              fullWidth
              loading={deleting}
              disabled={!nameMatches}
              onClick={handleDeleteAccount}
            >
              Eliminar definitivamente
            </Button>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setShowDelete(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
        </>
      )}
    </div>
  );
}
