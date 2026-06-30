'use client';

import type { Profile } from '@/lib/types';
import Button from '@/components/ui/Button';
import { User, Phone, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { getInitials } from '@/lib/utils';

interface MechanicCardProps {
  mechanic: Profile;
  onToggleActive?: (id: string, active: boolean) => void;
  onDelete?: (id: string) => void;
}

export default function MechanicCard({
  mechanic,
  onToggleActive,
  onDelete,
}: MechanicCardProps) {
  async function handleToggle() {
    const res = await fetch(`/api/mechanics/${mechanic.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !mechanic.active }),
    });
    if (res.ok) onToggleActive?.(mechanic.id, !mechanic.active);
  }

  async function handleDelete() {
    if (!confirm(`¿Desactivar a ${mechanic.full_name}?`)) return;
    const res = await fetch(`/api/mechanics/${mechanic.id}`, { method: 'DELETE' });
    if (res.ok) onDelete?.(mechanic.id);
  }

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        opacity: mechanic.active ? 1 : 0.5,
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--color-brand-700), var(--color-brand-900))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--color-brand-300)',
          flexShrink: 0,
        }}
      >
        {getInitials(mechanic.full_name)}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 600, fontSize: 15 }}>{mechanic.full_name}</p>
        {mechanic.phone && (
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 2,
            }}
          >
            <Phone size={11} />
            {mechanic.phone}
          </p>
        )}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            marginTop: 4,
            background: mechanic.active
              ? 'rgba(16,185,129,0.12)'
              : 'rgba(100,100,100,0.12)',
            color: mechanic.active ? '#34d399' : 'var(--color-text-muted)',
          }}
        >
          {mechanic.active ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6 }}>
        <Button variant="ghost" size="icon" onClick={handleToggle}>
          {mechanic.active ? (
            <ToggleRight size={18} color="var(--color-brand-400)" />
          ) : (
            <ToggleLeft size={18} />
          )}
        </Button>
        <Button variant="danger" size="icon" onClick={handleDelete}>
          <Trash2 size={15} />
        </Button>
      </div>
    </div>
  );
}
