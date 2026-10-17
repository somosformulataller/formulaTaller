'use client';

import { useState } from 'react';
import { Car, User } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PhoneInput from '@/components/ui/PhoneInput';
import type { ClientRow } from '@/lib/types';

/** Agregar un cliente sin orden ni presupuesto todavía (0029). */
export default function NuevoCliente({
  onCreado,
  onCancel,
}: {
  onCreado: (c: ClientRow) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ first_name: '', last_name: '', whatsapp: '', car_model: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(k: keyof typeof form, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'No se pudo guardar el cliente.');
      onCreado(d as ClientRow);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cliente.');
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input
          label="Nombre"
          placeholder="Juan"
          value={form.first_name}
          onChange={(e) => set('first_name', e.target.value)}
          required
          icon={<User size={15} />}
        />
        <Input label="Apellido" placeholder="Pérez" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
      </div>
      <PhoneInput label="WhatsApp" value={form.whatsapp} onChange={(v) => set('whatsapp', v)} required />
      <Input
        label="Modelo del vehículo"
        placeholder="Toyota Corolla 2019"
        value={form.car_model}
        onChange={(e) => set('car_model', e.target.value)}
        icon={<Car size={15} />}
      />
      {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <Button type="button" variant="secondary" fullWidth onClick={onCancel} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" fullWidth loading={guardando}>
          Agregar cliente
        </Button>
      </div>
    </form>
  );
}
