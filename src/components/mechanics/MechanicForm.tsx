'use client';

import { useState } from 'react';
import type { Mechanic, CreateMechanicPayload } from '@/lib/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import CopyLinkButton from '@/components/orders/CopyLinkButton';
import {
  buildWhatsAppLink,
  buildCredentialsMessage,
  buildCredentialsText,
} from '@/lib/utils';
import { User, Mail, Lock, Phone, MessageCircle, CheckCircle2 } from 'lucide-react';

interface MechanicFormProps {
  onSaved: (mechanic: Mechanic) => void;
  onClose: () => void;
  mechanic?: Mechanic;
  focusPassword?: boolean;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

interface FormState {
  full_name: string;
  email: string;
  password: string;
  phone: string;
}

export default function MechanicForm({
  onSaved,
  onClose,
  mechanic,
  focusPassword = false,
}: MechanicFormProps) {
  const isEdit = Boolean(mechanic);

  const [form, setForm] = useState<FormState>({
    full_name: mechanic?.full_name ?? '',
    email: mechanic?.email ?? '',
    password: '',
    phone: mechanic?.phone ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // When set, we show the credentials panel (only when a password is known).
  const [creds, setCreds] = useState<{ email: string; password: string; name: string; phone: string } | null>(null);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let res: Response;
    if (isEdit) {
      res = await fetch(`/api/mechanics/${mechanic!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone || null,
          ...(form.password ? { password: form.password } : {}),
        }),
      });
    } else {
      const payload: CreateMechanicPayload = {
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
      };
      res = await fetch('/api/mechanics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Error al guardar el mecánico');
      return;
    }

    const saved: Mechanic = await res.json();
    onSaved(saved);

    // If we know a password (always on create, only if changed on edit),
    // show the credentials panel so the admin can copy/share it.
    if (form.password) {
      setCreds({
        email: form.email,
        password: form.password,
        name: form.full_name,
        phone: form.phone,
      });
    } else {
      onClose();
    }
  }

  // --- Credentials panel (after saving with a known password) ---------------
  if (creds) {
    const waLink = buildWhatsAppLink(
      creds.phone,
      buildCredentialsMessage(creds.name, creds.email, creds.password, SITE_URL)
    );
    const credsText = buildCredentialsText(creds.email, creds.password, SITE_URL);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: '#34d399',
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          <CheckCircle2 size={18} />
          Mecánico guardado
        </div>

        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          Comparte estos datos de acceso con el mecánico. La contraseña no se podrá
          volver a ver; si la olvida, deberás asignar una nueva.
        </p>

        <div
          style={{
            padding: '12px 14px',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            fontSize: 13,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>Usuario: </span>
            <span style={{ fontWeight: 600 }}>{creds.email}</span>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-muted)' }}>Contraseña: </span>
            <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{creds.password}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <CopyLinkButton url={credsText} label="Copiar datos" />
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              background: 'rgba(37,211,102,0.12)',
              color: '#25D366',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              border: '1px solid rgba(37,211,102,0.2)',
              textDecoration: 'none',
            }}
          >
            <MessageCircle size={14} />
            Enviar por WhatsApp
          </a>
        </div>

        <Button type="button" variant="primary" fullWidth onClick={onClose}>
          Listo
        </Button>
      </div>
    );
  }

  // --- Form -----------------------------------------------------------------
  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {isEdit && focusPassword && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(52,211,153,0.1)',
            border: '1px solid rgba(52,211,153,0.25)',
            borderRadius: 8,
            color: '#34d399',
            fontSize: 13,
          }}
        >
          Escribe una <strong>nueva contraseña</strong> y guárdala para reenviar el acceso al mecánico por WhatsApp.
        </div>
      )}

      <Input
        label="Nombre completo"
        placeholder="Carlos Rodríguez"
        value={form.full_name}
        onChange={(e) => set('full_name', e.target.value)}
        required
        icon={<User size={15} />}
      />

      <Input
        label="Correo electrónico"
        type="email"
        placeholder="carlos@taller.com"
        value={form.email}
        onChange={(e) => set('email', e.target.value)}
        required
        icon={<Mail size={15} />}
      />

      <Input
        label={isEdit ? 'Nueva contraseña (opcional)' : 'Contraseña temporal'}
        type="password"
        placeholder={isEdit ? 'Dejar en blanco para no cambiar' : 'Mínimo 8 caracteres'}
        value={form.password}
        onChange={(e) => set('password', e.target.value)}
        required={!isEdit}
        minLength={isEdit && !form.password ? undefined : 8}
        autoFocus={isEdit && focusPassword}
        icon={<Lock size={15} />}
      />

      <Input
        label="Teléfono (opcional)"
        type="tel"
        placeholder="+58 412 1234567"
        value={form.phone}
        onChange={(e) => set('phone', e.target.value)}
        icon={<Phone size={15} />}
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

      <div style={{ display: 'flex', gap: 10 }}>
        <Button type="button" variant="secondary" fullWidth onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" fullWidth loading={loading}>
          {isEdit ? 'Guardar cambios' : 'Crear mecánico'}
        </Button>
      </div>
    </form>
  );
}
