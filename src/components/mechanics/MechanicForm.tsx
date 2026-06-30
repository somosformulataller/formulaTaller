'use client';

import { useState } from 'react';
import type { Profile, CreateMechanicPayload } from '@/lib/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { User, Mail, Lock, Phone } from 'lucide-react';

interface MechanicFormProps {
  onSuccess: (mechanic: Profile) => void;
  onCancel: () => void;
}

const EMPTY: CreateMechanicPayload = {
  full_name: '',
  email: '',
  password: '',
  phone: '',
};

export default function MechanicForm({ onSuccess, onCancel }: MechanicFormProps) {
  const [form, setForm] = useState<CreateMechanicPayload>({ ...EMPTY });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof CreateMechanicPayload, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch('/api/mechanics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        phone: form.phone || undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Error al crear el mecánico');
      return;
    }

    const mechanic: Profile = await res.json();
    onSuccess(mechanic);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
        label="Contraseña temporal"
        type="password"
        placeholder="Mínimo 8 caracteres"
        value={form.password}
        onChange={(e) => set('password', e.target.value)}
        required
        minLength={8}
        icon={<Lock size={15} />}
      />

      <Input
        label="Teléfono (opcional)"
        type="tel"
        placeholder="+58 412 1234567"
        value={form.phone ?? ''}
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
        <Button type="button" variant="secondary" fullWidth onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" fullWidth loading={loading}>
          Crear mecánico
        </Button>
      </div>
    </form>
  );
}
