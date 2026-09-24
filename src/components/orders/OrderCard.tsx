'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Order, Profile, Mechanic, OrderStatus } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import CopyLinkButton from '@/components/orders/CopyLinkButton';
import MechanicSelect from '@/components/orders/MechanicSelect';
import { cambioDeAsignacion, esMio, idsAsignados, nombresAsignados } from '@/lib/asignacion';
import MechanicForm from '@/components/mechanics/MechanicForm';
import { formatDate, buildWhatsAppLink, buildTrackingMessage, openWhatsApp } from '@/lib/utils';
import { Car, User, Phone, MessageCircle, Edit2, Trash2, ChevronRight, CheckCircle2 } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  mechanics: Profile[];
  role: 'admin' | 'mechanic';
  currentUserId?: string;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: OrderStatus) => void;
  onUpdate?: (order: Order) => void;
  /** Solo admin: habilita "Agregar mecánico" en el selector de asignación. */
  canCreateMechanic?: boolean;
  /** Avisa al padre cuando se crea un mecánico (para actualizar la lista compartida). */
  onMechanicCreated?: (m: Mechanic) => void;
  workshopName?: string;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default function OrderCard({
  order,
  mechanics,
  role,
  currentUserId,
  onDelete,
  onStatusChange,
  onUpdate,
  canCreateMechanic = false,
  onMechanicCreated,
  workshopName,
}: OrderCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showAddMechanic, setShowAddMechanic] = useState(false);

  const clientName = `${order.client_first_name} ${order.client_last_name}`;
  // El mecánico solo puede eliminar las órdenes que tiene asignadas; desde la
  // 0019 no ve ninguna otra. El administrador puede eliminar cualquiera.
  const isOwn = esMio(order, currentUserId);
  const asignados = idsAsignados(order);
  const nombres = nombresAsignados(order, order.workshop?.name ?? workshopName);
  const trackingUrl = `${SITE_URL}/tracking/${order.public_token}`;
  const waLink = buildWhatsAppLink(
    order.client_whatsapp,
    buildTrackingMessage(order.client_first_name, order.public_token, SITE_URL, order.workshop?.name)
  );

  async function handleDelete() {
    if (!confirm(`¿Eliminar la orden de ${clientName}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDelete?.(order.id);
      } else {
        alert('No se pudo eliminar la orden.');
      }
    } catch {
      alert('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: OrderStatus) {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        onStatusChange?.(order.id, newStatus);
      } else {
        alert('No se pudo cambiar el estado.');
      }
    } catch {
      alert('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  // La orden puede quedar con varios mecánicos (0021); `comoTaller` decide si
  // el cliente lee sus nombres o el del taller.
  async function handleAssignMechanic(ids: string[], comoTaller: boolean) {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambioDeAsignacion(ids, comoTaller)),
      });
      if (res.ok) {
        onUpdate?.(await res.json());
      } else {
        alert('No se pudo guardar la asignación.');
      }
    } catch {
      alert('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  // Mecánico creado desde la tarjeta: avisar al padre (lista compartida) y
  // asignar esta orden al nuevo mecánico.
  function handleMechanicCreated(m: Mechanic) {
    onMechanicCreated?.(m);
    handleAssignMechanic([...new Set([...asignados, m.id])], false);
  }

  // Transiciones de estado por botón. La asignación de mecánico (cuando la orden
  // no tiene uno) se hace con un desplegable aparte, no con un botón de estado.
  const nextStatuses: Record<OrderStatus, { value: OrderStatus; label: string }[]> = {
    sin_mecanico: [],
    con_mecanico: [{ value: 'lista', label: 'Marcar como lista' }],
    lista: [],
  };

  return (
    <article
      className="card animate-fade-in"
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 16 }}>{clientName}</p>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginTop: 2 }}>
            {formatDate(order.created_at)}
          </p>
        </div>
        <Badge status={order.status} />
      </div>

      <div style={{ height: 1, background: 'var(--color-border)' }} />

      {/* Details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <InfoRow icon={<Car size={14} />} text={order.car_model} />
        <InfoRow icon={<Phone size={14} />} text={order.client_whatsapp} />
        {nombres.length > 0 && (
          <InfoRow
            icon={<User size={14} />}
            // Lo mismo que está viendo el cliente en su seguimiento: los
            // nombres de todos los asignados, o el del taller si así se marcó.
            text={nombres.join(' · ')}
            color="var(--color-brand-400)"
          />
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {/* WhatsApp share */}
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.preventDefault();
            openWhatsApp(
              order.client_whatsapp,
              buildTrackingMessage(order.client_first_name, order.public_token, SITE_URL, order.workshop?.name)
            );
          }}
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
          Compartir
        </a>

        {/* Copy tracking link */}
        <CopyLinkButton url={trackingUrl} />

        {/* Detail / Stages */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const base = role === 'admin' ? '/admin' : '/mecanico';
            router.push(`${base}/ordenes/${order.id}`);
          }}
        >
          <ChevronRight size={14} />
          Ver orden
        </Button>

        {/* El mecánico ya no se asigna a sí mismo: asignar es del
            administrador (0019). Aquí no queda ningún botón para eso. */}

        {/* Mechanic: mark as ready when working on it */}
        {role === 'mechanic' &&
          isOwn &&
          order.status === 'con_mecanico' && (
            <Button
              variant="primary"
              size="sm"
              loading={loading}
              onClick={() => handleStatusChange('lista')}
            >
              <CheckCircle2 size={14} />
              Marcar como lista
            </Button>
          )}

        {/* Mechanic: delete own orders (assigned to or created by them) */}
        {role === 'mechanic' && isOwn && (
          <Button variant="danger" size="sm" loading={loading} onClick={handleDelete}>
            <Trash2 size={13} />
          </Button>
        )}

        {/* Admin: asignar mecánico con la lista desplegable propia (si no tiene uno) */}
        {role === 'admin' &&
          asignados.length === 0 &&
          (mechanics.length > 0 || canCreateMechanic) && (
            <MechanicSelect
              mechanics={mechanics}
              workshopName={order.workshop?.name ?? workshopName}
              value={[]}
              onChange={handleAssignMechanic}
              disabled={loading}
              placeholder="Asignar mecánico"
              compact
              float
              onAddNew={canCreateMechanic ? () => setShowAddMechanic(true) : undefined}
            />
          )}

        {/* Status transition (admin) */}
        {role === 'admin' && nextStatuses[order.status].map((s) => (
          <Button
            key={s.value}
            variant="secondary"
            size="sm"
            loading={loading}
            onClick={() => handleStatusChange(s.value)}
          >
            {s.label}
          </Button>
        ))}

        {/* Admin actions */}
        {role === 'admin' && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/admin/ordenes/${order.id}?edit=1`)}
            >
              <Edit2 size={13} />
            </Button>
            <Button variant="danger" size="sm" loading={loading} onClick={handleDelete}>
              <Trash2 size={13} />
            </Button>
          </>
        )}
      </div>

      {showAddMechanic && (
        <Modal
          isOpen={showAddMechanic}
          onClose={() => setShowAddMechanic(false)}
          title="Nuevo mecánico"
        >
          <MechanicForm
            workshopName={workshopName}
            onSaved={handleMechanicCreated}
            onClose={() => setShowAddMechanic(false)}
          />
        </Modal>
      )}
    </article>
  );
}

function InfoRow({
  icon,
  text,
  color,
}: {
  icon: React.ReactNode;
  text: string;
  color?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: color || 'var(--color-text-secondary)',
        fontSize: 13,
      }}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}
