'use client';

import { useState } from 'react';
import type { Profile, Mechanic } from '@/lib/types';
import type { Conteos, FiltroEstado, PaginaOrdenes } from '@/lib/ordenes-lista';
import { useOrdenesPaginadas } from '@/components/orders/useOrdenesPaginadas';
import ListaPie from '@/components/orders/ListaPie';
import OrderCard from '@/components/orders/OrderCard';
import OrderForm from '@/components/orders/OrderForm';
import { useSaldo } from '@/components/saldo/SaldoProvider';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Plus, ClipboardList, CheckCircle2, Wrench, Clock, PlayCircle } from 'lucide-react';

interface AdminDashboardClientProps {
  /** Primera página de órdenes y conteos por estado, leídos por el servidor. */
  inicial: PaginaOrdenes;
  conteos: Conteos;
  mechanics: Profile[];
}

type FilterStatus = FiltroEstado;

export default function AdminDashboardClient({
  inicial,
  conteos: conteosIniciales,
  mechanics: initialMechanics,
}: AdminDashboardClientProps) {
  const saldo = useSaldo();
  const lista = useOrdenesPaginadas(inicial, conteosIniciales);
  const { visibles: filtered, conteos, filter, setFilter } = lista;
  const [mechanics, setMechanics] = useState<Profile[]>(initialMechanics);

  function handleMechanicCreated(m: Mechanic) {
    setMechanics((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }
  const [showCreate, setShowCreate] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  function handleNew() {
    // Saldo prepagado (0025): sin saldo para la orden, el aviso trae el botón
    // para comprar. El servidor vuelve a comprobarlo al crearla.
    if (saldo && !saldo.alcanza(saldo.precios.orden)) {
      saldo.avisarSinSaldo('No tienes saldo suficiente para crear una orden. Compra saldo para seguir usando la app.');
    } else {
      setShowCreate(true);
    }
  }

  const stats = conteos;

  function handleCreated(order: Parameters<typeof lista.agregar>[0]) {
    lista.agregar(order);
    setShowCreate(false);
  }

  const handleDelete = lista.quitar;
  const handleStatusChange = lista.cambiarEstado;
  const handleUpdate = lista.actualizar;



  const FILTERS: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'sin_mecanico', label: 'Sin asignar' },
    { value: 'con_mecanico', label: 'En progreso' },
    { value: 'lista', label: 'Listas' },
  ];

  return (
    <div className="animate-fade-in" style={{ paddingTop: 16 }}>
      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
          marginBottom: 20,
        }}
      >
        <StatCard
          icon={<ClipboardList size={18} />}
          label="Total"
          value={stats.total}
          color="var(--color-brand-400)"
        />
        <StatCard
          icon={<Clock size={18} />}
          label="Sin asignar"
          value={stats.sin_mecanico}
          color="var(--color-text-secondary)"
        />
        <StatCard
          icon={<Wrench size={18} />}
          label="En progreso"
          value={stats.con_mecanico}
          color="#fbbf24"
        />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="Listas"
          value={stats.lista}
          color="#34d399"
        />
      </div>

      {/* Header + Create */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Órdenes recientes</h2>
        <Button variant="primary" size="sm" onClick={handleNew}>
          <Plus size={15} />
          Nueva orden
        </Button>
      </div>

      {/* Filter tabs */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          marginBottom: 16,
          overflowX: 'auto',
          paddingBottom: 4,
        }}
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              background:
                filter === f.value
                  ? 'var(--color-brand-500)'
                  : 'var(--color-surface-2)',
              color:
                filter === f.value
                  ? '#0D0F1A'
                  : 'var(--color-text-secondary)',
              borderColor:
                filter === f.value
                  ? 'var(--color-brand-500)'
                  : 'var(--color-border)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Order list */}
      {filtered.length === 0 && lista.cargando ? null : filtered.length === 0 ? (
        <div className="empty-state">
          <ClipboardList size={48} />
          <p>No hay órdenes {filter !== 'all' ? 'con este filtro' : 'aún'}</p>
          {filter === 'all' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
                <Plus size={14} />
                Crear primera orden
              </Button>
              {/* El video se abre EN ESTA página (ventana emergente) y no en
                  /video, para que al cerrarlo se siga justo donde estaba. */}
              <Button variant="ghost" size="sm" onClick={() => setShowVideo(true)}>
                <PlayCircle size={14} />
                Ver video explicativo
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              mechanics={mechanics}
              role="admin"
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              onUpdate={handleUpdate}
              canCreateMechanic
              onMechanicCreated={handleMechanicCreated}
            />
          ))}
        </div>
      )}

      <ListaPie
        hayMas={lista.hayMas}
        cargando={lista.cargando}
        error={lista.error}
        onVerMas={lista.verMas}
        onReintentar={lista.reintentar}
      />

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nueva orden"
      >
        <OrderForm
          mechanics={mechanics}
          onSuccess={handleCreated}
          onCancel={() => setShowCreate(false)}
          canCreateMechanic
          onMechanicCreated={handleMechanicCreated}
        />
      </Modal>

      {/* Video explicativo: se carga /video dentro de la ventana, así el video
          y el botón de soporte salen de una sola fuente (platform_settings) y
          no hay que duplicarlos aquí. Solo se monta al abrir, para no
          descargar el video a quien no lo pide. */}
      <Modal
        isOpen={showVideo}
        onClose={() => setShowVideo(false)}
        title="Video explicativo"
      >
        <iframe
          src="/video"
          title="Video explicativo de Formula Taller"
          allow="autoplay; fullscreen; picture-in-picture"
          style={{
            width: '100%',
            height: '60dvh',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--border-radius-sm)',
            background: '#000',
          }}
        />
      </Modal>

    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 800, color }}>{value}</p>
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>
          {label}
        </p>
      </div>
    </div>
  );
}
