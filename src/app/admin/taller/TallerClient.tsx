'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Phone, CheckCircle2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { Workshop } from '@/lib/types';

export default function TallerClient({ workshop }: { workshop: Workshop }) {
  const router = useRouter();
  const [name, setName] = useState(workshop.name);
  const [whatsapp, setWhatsapp] = useState(workshop.whatsapp ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
    // Refresh so the new name shows up in the TopBar / tracking.
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Perfil del Taller</h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginBottom: 20 }}>
        Estos datos identifican tu taller. El nombre aparece en el panel y en el seguimiento
        que ven tus clientes.
      </p>

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

          <Input
            label="WhatsApp del taller"
            type="tel"
            placeholder="+58 412 1234567"
            value={whatsapp}
            onChange={(e) => {
              setWhatsapp(e.target.value);
              setSaved(false);
            }}
            icon={<Phone size={15} />}
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
    </div>
  );
}
