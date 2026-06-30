'use client';

import { useState } from 'react';
import type { Order, Profile, CreateOrderPayload } from '@/lib/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { User, Phone, Car, ChevronDown } from 'lucide-react';

interface OrderFormProps {
  mechanics: Profile[];
  order?: Order; // if editing
  onSuccess: (order: Order) => void;
  onCancel: () => void;
}

const EMPTY: CreateOrderPayload = {
  client_first_name: '',
  client_last_name: '',
  client_whatsapp: '',
  car_model: '',
  assigned_mechanic_id: null,
  notes: '',
};

export default function OrderForm({ mechanics, order, onSuccess, onCancel }: OrderFormProps) {
  const isEdit = !!order;
  const [form, setForm] = useState<CreateOrderPayload>(
    order
      ? {
          client_first_name: order.client_first_name,
          client_last_name: order.client_last_name,
          client_whatsapp: order.client_whatsapp,
          car_model: order.car_model,
          assigned_mechanic_id: order.assigned_mechanic_id,
          notes: order.notes ?? '',
        }
      : { ...EMPTY }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof CreateOrderPayload, value: string | null) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const url = isEdit ? `/api/orders/${order.id}` : '/api/orders';
    const method = isEdit ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        assigned_mechanic_id: form.assigned_mechanic_id || null,
        notes: form.notes || null,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Error al guardar la orden');
      return;
    }

    const saved: Order = await res.json();
    onSuccess(saved);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input
          label="Nombre"
          placeholder="Juan"
          value={form.client_first_name}
          onChange={(e) => set('client_first_name', e.target.value)}
          required
          icon={<User size={15} />}
        />
        <Input
          label="Apellido"
          placeholder="Pérez"
          value={form.client_last_name}
          onChange={(e) => set('client_last_name', e.target.value)}
          required
        />
      </div>

      <Input
        label="WhatsApp"
        placeholder="+58 412 1234567"
        type="tel"
        value={form.client_whatsapp}
        onChange={(e) => set('client_whatsapp', e.target.value)}
        required
        icon={<Phone size={15} />}
      />

      <Input
        label="Modelo del vehículo"
        placeholder="Toyota Corolla 2019"
        value={form.car_model}
        onChange={(e) => set('car_model', e.target.value)}
        required
        icon={<Car size={15} />}
      />

      {/* Mechanic selector */}
      <div className="form-field">
        <label className="form-label">Mecánico asignado</label>
        <div style={{ position: 'relative' }}>
          <select
            className="form-input"
            value={form.assigned_mechanic_id ?? ''}
            onChange={(e) => set('assigned_mechanic_id', e.target.value || null)}
            style={{ paddingRight: 36 }}
          >
            <option value="">Sin asignar</option>
            {mechanics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      {/* Notes */}
      <div className="form-field">
        <label className="form-label">Notas adicionales</label>
        <textarea
          className="form-input"
          placeholder="Observaciones, descripción del problema..."
          value={form.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
        />
      </div>

      {error && (
        <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <Button type="button" variant="secondary" fullWidth onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" fullWidth loading={loading}>
          {isEdit ? 'Guardar cambios' : 'Crear orden'}
        </Button>
      </div>
    </form>
  );
}
