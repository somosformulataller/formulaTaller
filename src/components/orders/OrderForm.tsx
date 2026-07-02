'use client';

import { useEffect, useState } from 'react';
import type { Order, Profile, CreateOrderPayload, OrderStage } from '@/lib/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import SubscriptionModal from '@/components/orders/SubscriptionModal';
import AttachmentPicker from '@/components/orders/AttachmentPicker';
import { uploadStageAttachment } from '@/lib/attachments';
import {
  User,
  Phone,
  Car,
  ChevronDown,
  Plus,
  X,
  Mic,
  Video as VideoIcon,
  FileText,
} from 'lucide-react';

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

interface PendingFile {
  file: File;
  url: string | null; // object URL for image previews
}

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
  const [paywall, setPaywall] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'creating' | 'uploading'>('idle');

  // Release image preview URLs when the form unmounts.
  useEffect(() => {
    return () => {
      pending.forEach((p) => p.url && URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set(field: keyof CreateOrderPayload, value: string | null) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addFiles(files: File[]) {
    setPending((prev) => [
      ...prev,
      ...files.map((f) => ({
        file: f,
        url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      })),
    ]);
  }

  function removePending(index: number) {
    setPending((prev) => {
      const p = prev[index];
      if (p?.url) URL.revokeObjectURL(p.url);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setPhase('creating');

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

    if (!res.ok) {
      setLoading(false);
      setPhase('idle');
      const data = await res.json().catch(() => ({}));
      if (res.status === 402 || data.limitReached) {
        setPaywall(data.error || null);
        return;
      }
      setError(data.error || 'Error al guardar la orden');
      return;
    }

    const saved: Order = await res.json();

    // Upload the initial attachments to the first stage (intake). They then
    // show up in the stage timeline (admin/mechanic) and the client tracking.
    if (!isEdit && pending.length > 0) {
      setPhase('uploading');
      const stages = ((saved.stages ?? []) as OrderStage[])
        .slice()
        .sort((a, b) => a.position - b.position);
      const target = stages[0];
      if (target) {
        const uploaded = [];
        for (const p of pending) {
          try {
            uploaded.push(await uploadStageAttachment(saved.id, target.id, p.file));
          } catch (err) {
            alert(err instanceof Error ? err.message : `No se pudo subir "${p.file.name}"`);
          }
        }
        target.attachments = [...(target.attachments ?? []), ...uploaded];
      }
    }

    setLoading(false);
    setPhase('idle');
    pending.forEach((p) => p.url && URL.revokeObjectURL(p.url));
    onSuccess(saved);
  }

  const submitLabel = isEdit
    ? 'Guardar cambios'
    : phase === 'uploading'
    ? 'Subiendo archivos...'
    : phase === 'creating'
    ? 'Creando orden...'
    : 'Crear orden';

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {paywall !== null && (
        <SubscriptionModal
          message={paywall || undefined}
          onClose={() => {
            setPaywall(null);
            onCancel();
          }}
        />
      )}

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

      {/* Initial attachments (create only) */}
      {!isEdit && (
        <div className="form-field">
          <label className="form-label">
            Fotos, video, nota de voz o documentos (opcional)
          </label>

          {pending.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {pending.map((p, i) => (
                <PendingTile key={i} file={p} onRemove={() => removePending(i)} />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowPicker(true)}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <Plus size={14} />
            Agregar foto, video, nota de voz o documento
          </button>
        </div>
      )}

      {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <Button type="button" variant="secondary" fullWidth onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" fullWidth loading={loading}>
          {submitLabel}
        </Button>
      </div>

      {showPicker && (
        <AttachmentPicker onFiles={addFiles} onClose={() => setShowPicker(false)} />
      )}
    </form>
  );
}

function PendingTile({ file, onRemove }: { file: PendingFile; onRemove: () => void }) {
  const type = file.file.type;
  const isImage = type.startsWith('image/');
  const isVideo = type.startsWith('video/');
  const isAudio = type.startsWith('audio/');

  return (
    <div style={{ position: 'relative', width: 64, height: 64 }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
          background: isImage ? '#000' : 'var(--color-surface-2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-secondary)',
        }}
      >
        {isImage && file.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.url}
            alt={file.file.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : isVideo ? (
          <VideoIcon size={22} />
        ) : isAudio ? (
          <Mic size={22} />
        ) : (
          <FileText size={22} />
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Quitar"
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
    </div>
  );
}
