'use client';

import { useState } from 'react';
import type { Profile } from '@/lib/types';
import MechanicCard from '@/components/mechanics/MechanicCard';
import MechanicForm from '@/components/mechanics/MechanicForm';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Plus, Users } from 'lucide-react';

interface MecanicosClientProps {
  initialMechanics: Profile[];
}

export default function MecanicosClient({ initialMechanics }: MecanicosClientProps) {
  const [mechanics, setMechanics] = useState<Profile[]>(initialMechanics);
  const [showCreate, setShowCreate] = useState(false);

  function handleCreated(mechanic: Profile) {
    setMechanics((prev) => [...prev, mechanic].sort((a, b) =>
      a.full_name.localeCompare(b.full_name)
    ));
    setShowCreate(false);
  }

  function handleToggleActive(id: string, active: boolean) {
    setMechanics((prev) =>
      prev.map((m) => (m.id === id ? { ...m, active } : m))
    );
  }

  function handleDelete(id: string) {
    setMechanics((prev) => prev.filter((m) => m.id !== id));
  }

  const active = mechanics.filter((m) => m.active);
  const inactive = mechanics.filter((m) => !m.active);

  return (
    <div className="animate-fade-in" style={{ paddingTop: 16 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Mecánicos</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginTop: 2 }}>
            {active.length} activos · {inactive.length} inactivos
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={15} />
          Agregar
        </Button>
      </div>

      {/* Active mechanics */}
      {active.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              marginBottom: 10,
            }}
          >
            Activos
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {active.map((m) => (
              <MechanicCard
                key={m.id}
                mechanic={m}
                onToggleActive={handleToggleActive}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inactive mechanics */}
      {inactive.length > 0 && (
        <div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              marginBottom: 10,
            }}
          >
            Inactivos
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {inactive.map((m) => (
              <MechanicCard
                key={m.id}
                mechanic={m}
                onToggleActive={handleToggleActive}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {mechanics.length === 0 && (
        <div className="empty-state">
          <Users size={48} />
          <p>No hay mecánicos registrados</p>
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            Agregar primer mecánico
          </Button>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nuevo mecánico"
      >
        <MechanicForm
          onSuccess={handleCreated}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>
    </div>
  );
}
