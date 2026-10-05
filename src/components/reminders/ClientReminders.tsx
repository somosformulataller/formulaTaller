'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellPlus } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import ReminderForm from '@/components/reminders/ReminderForm';
import ReminderCard from '@/components/reminders/ReminderCard';
import type { Reminder } from '@/lib/types';

/**
 * Los recordatorios de un cliente con el botón para agregar uno. Se usa en la
 * lista de Clientes y dentro de la orden (ahí, los nuevos quedan enlazados a
 * esa orden).
 */
export default function ClientReminders({
  clientId,
  clientName,
  orderId,
  workshopName,
}: {
  clientId: string;
  clientName: string;
  orderId?: string | null;
  workshopName: string;
}) {
  const [lista, setLista] = useState<Reminder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState<Reminder | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/reminders?client_id=${clientId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('No se pudieron cargar los recordatorios');
      setLista(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    }
  }, [clientId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function alGuardar(r: Reminder) {
    setLista((prev) => {
      const sin = (prev ?? []).filter((x) => x.id !== r.id);
      return [...sin, r].sort((a, b) => a.due_date.localeCompare(b.due_date));
    });
    setFormAbierto(false);
    setEditando(null);
  }

  // Primero los que siguen abiertos; los hechos, al final.
  const ordenados = (lista ?? [])
    .slice()
    .sort((a, b) => Number(a.status === 'hecho') - Number(b.status === 'hecho') || a.due_date.localeCompare(b.due_date));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button
        type="button"
        onClick={() => setFormAbierto(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '10px 12px',
          background: 'var(--color-surface-2)',
          border: '1px dashed var(--color-border)',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-brand-400)',
          cursor: 'pointer',
        }}
      >
        <BellPlus size={15} />
        Agregar recordatorio
      </button>

      {!lista && !error && <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>Cargando…</p>}
      {error && <p style={{ fontSize: 12.5, color: 'var(--color-danger)' }}>{error}</p>}
      {lista && lista.length === 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>Todavía no hay recordatorios para {clientName}.</p>
      )}

      {ordenados.map((r) => (
        <ReminderCard
          key={r.id}
          reminder={r}
          workshopName={workshopName}
          onChanged={alGuardar}
          onDeleted={(id) => setLista((prev) => (prev ?? []).filter((x) => x.id !== id))}
          onEdit={(x) => setEditando(x)}
        />
      ))}

      {(formAbierto || editando) && (
        <Modal
          isOpen
          onClose={() => {
            setFormAbierto(false);
            setEditando(null);
          }}
          title={editando ? 'Editar recordatorio' : `Recordatorio para ${clientName}`}
        >
          <ReminderForm
            clientId={clientId}
            orderId={orderId}
            reminder={editando}
            onSaved={alGuardar}
            onCancel={() => {
              setFormAbierto(false);
              setEditando(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
