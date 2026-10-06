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
import { Plus, ClipboardList, Search } from 'lucide-react';

interface OrdenesClientProps {
  /** Primera página de órdenes y conteos por estado, leídos por el servidor. */
  inicial: PaginaOrdenes;
  conteos: Conteos;
  mechanics: Profile[];
}

type FilterStatus = FiltroEstado;

export default function OrdenesClient({
  inicial,
  conteos: conteosIniciales,
  mechanics: initialMechanics,
}: OrdenesClientProps) {
  const saldo = useSaldo();
  const lista = useOrdenesPaginadas(inicial, conteosIniciales);
  const { visibles: filtered, conteos, filter, setFilter } = lista;
  const [mechanics, setMechanics] = useState<Profile[]>(initialMechanics);
  const [showCreate, setShowCreate] = useState(false);
  const { search, setSearch } = lista;

  function handleNew() {
    // Saldo prepagado (0025): sin saldo para la orden, el aviso trae el botón
    // para comprar. El servidor vuelve a comprobarlo al crearla.
    if (saldo && !saldo.alcanza(saldo.precios.orden)) {
      saldo.avisarSinSaldo('No tienes saldo suficiente para crear una orden. Compra saldo para seguir usando la app.');
    } else {
      setShowCreate(true);
    }
  }


  function handleCreated(order: Parameters<typeof lista.agregar>[0]) {
    lista.agregar(order);
    setShowCreate(false);
  }

  const handleDelete = lista.quitar;
  const handleStatusChange = lista.cambiarEstado;
  const handleUpdate = lista.actualizar;



  function handleMechanicCreated(m: Mechanic) {
    setMechanics((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }

  const FILTERS: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: `Todas (${conteos.total})` },
    { value: 'sin_mecanico', label: 'Sin asignar' },
    { value: 'con_mecanico', label: 'En progreso' },
    { value: 'lista', label: 'Listas' },
  ];

  return (
    <div className="animate-fade-in" style={{ paddingTop: 16 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Todas las órdenes</h1>
        <Button variant="primary" size="sm" onClick={handleNew}>
          <Plus size={15} />
          Nueva
        </Button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search
          size={15}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-text-muted)',
          }}
        />
        <input
          className="form-input"
          placeholder="Buscar por nombre, vehículo o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: 36 }}
          id="orders-search"
        />
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
                filter === f.value ? '#0D0F1A' : 'var(--color-text-secondary)',
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

      {/* List */}
      {filtered.length === 0 && lista.cargando ? null : filtered.length === 0 ? (
        <div className="empty-state">
          <ClipboardList size={48} />
          <p>
            {search
              ? 'No hay resultados para tu búsqueda'
              : 'No hay órdenes con este filtro'}
          </p>
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

    </div>
  );
}
