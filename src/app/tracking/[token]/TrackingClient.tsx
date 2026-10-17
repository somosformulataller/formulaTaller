'use client';

import { useState } from 'react';
import type { Order, OrderStage, StageStatus, OrderStatus, BudgetItem } from '@/lib/types';
import { formatDate, ORDER_STATUS_LABELS } from '@/lib/utils';
import { CheckCircle2, Circle, Car, Wrench, Clock, Info, ChevronDown } from 'lucide-react';
import AttachmentGallery from '@/components/orders/AttachmentGallery';
import TrackingBudget from './TrackingBudget';
import VehicleConditionsView from '@/components/orders/VehicleConditionsView';
import CabeceraTaller from '@/components/tracking/CabeceraTaller';
import Desplegable from '@/components/tracking/Desplegable';

interface TrackingClientProps {
  order: Order;
  /**
   * Los nombres que el cliente debe leer como responsables de su carro, ya
   * resueltos en el servidor: o los mecánicos asignados, o el nombre del
   * taller si la orden se marcó «como el taller» (0020). Vienen decididos de
   * allá a propósito — el nombre que no se muestra tampoco se manda.
   */
  mecanicos?: string[];
  /** Presupuesto de la orden. Vacío = el taller todavía no cobró nada, y
      entonces no se muestra la sección: un total en $0,00 asusta al cliente. */
  budget?: BudgetItem[];
}

const STAGE_ICONS: Record<StageStatus, React.ReactNode> = {
  done: <CheckCircle2 size={22} color="#10b981" />,
  in_progress: (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        border: '3px solid #f59e0b',
        borderTopColor: 'transparent',
        animation: 'spin 1.2s linear infinite',
      }}
    />
  ),
  pending: <Circle size={22} color="rgba(255,255,255,0.15)" />,
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  sin_mecanico: 'var(--color-text-secondary)',
  con_mecanico: '#fbbf24',
  lista: '#34d399',
};

export default function TrackingClient({ order, budget = [], mecanicos = [] }: TrackingClientProps) {
  const allStages = (order.stages ?? []) as OrderStage[];
  // La posición 0 es la "recepción" (archivos adjuntados al crear la orden):
  // es información principal, no una etapa del servicio.
  const intake = allStages.find((s) => s.position === 0);
  const intakeAttachments = intake?.attachments ?? [];
  const stages = allStages.filter((s) => s.position > 0);
  const clientName = `${order.client_first_name} ${order.client_last_name}`;
  const workshopName = order.workshop?.name ?? 'Taller';
  const workshopLogo = order.workshop?.logo_url ?? null;


  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'radial-gradient(ellipse at top, rgba(245,158,11,0.06) 0%, transparent 50%), var(--color-bg)',
        padding: '24px 16px',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <CabeceraTaller
        nombre={workshopName}
        logoUrl={workshopLogo}
        color={order.workshop?.brand_color}
        color2={order.workshop?.brand_color_2}
        etiqueta="Seguimiento de servicio"
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 14px 8px 12px',
            borderRadius: 12,
            background: 'rgba(5,7,13,0.55)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: STATUS_COLOR[order.status],
              boxShadow: order.status === 'lista'
                ? '0 0 0 4px rgba(16,185,129,0.2)'
                : order.status === 'con_mecanico'
                ? '0 0 0 4px rgba(245,158,11,0.2)'
                : 'none',
              animation: order.status !== 'sin_mecanico' ? 'pulse-glow 2s ease-in-out infinite' : 'none',
              flexShrink: 0,
            }}
          />
          <div>
            <p style={{ fontWeight: 700, fontSize: 14.5, color: STATUS_COLOR[order.status] }}>
              {order.status === 'lista'
                ? '¡Tu vehículo está listo! 🎉'
                : order.status === 'con_mecanico'
                ? 'En servicio 🔧'
                : 'En espera de mecánico'}
            </p>
            <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{ORDER_STATUS_LABELS[order.status]}</p>
          </div>
        </div>
      </CabeceraTaller>

      {/* Información del carro: se abre con un toque. */}
      <Desplegable titulo="Información" icono={<Info size={17} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Row label="Cliente" value={clientName} />
          <Row icon={<Car size={13} />} label="Vehículo" value={order.car_model} />
          {mecanicos.length > 0 && <FilaMecanicos nombres={mecanicos} />}
          <Row
            icon={<Clock size={13} />}
            label="Recibido"
            value={formatDate(order.created_at)}
          />
        </div>

        {order.notes && (
          <>
            <div style={{ height: 1, background: 'var(--color-border)', margin: '12px 0' }} />
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 6 }}>
              ¿Qué presenta el vehículo?
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>
              {order.notes}
            </p>
          </>
        )}

        {intakeAttachments.length > 0 && (
          <>
            <div style={{ height: 1, background: 'var(--color-border)', margin: '12px 0' }} />
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
              Fotos y archivos
            </p>
            <AttachmentGallery attachments={intakeAttachments} tile={80} />
          </>
        )}
      </Desplegable>

      {/* Cómo llegó el carro: lo marcó el taller al recibirlo. Solo lectura. */}
      <VehicleConditionsView
        conditions={order.vehicle_conditions ?? []}
        mileage={order.mileage ?? null}
        fuelLevel={order.fuel_level ?? null}
        notes={order.vehicle_notes ?? null}
        variant="tracking"
      />

      {/* Presupuesto — el cliente aprueba o rechaza cada ítem (0023). */}
      {(budget.length > 0 || Number(order.labor_general_usd) > 0) && (
        <TrackingBudget
          manoGeneral={Number(order.labor_general_usd) || 0}
          token={order.public_token}
          initialItems={budget}
          cerrado={order.status === 'lista'}
        />
      )}

      {/* Timeline */}
      <div
        className="animate-fade-in"
        style={{ animationDelay: '0.15s' }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            marginBottom: 16,
          }}
        >
          Etapas del servicio
        </p>

        <div style={{ position: 'relative' }}>
          {/* Vertical connector line */}
          <div
            style={{
              position: 'absolute',
              left: 10,
              top: 11,
              bottom: 11,
              width: 2,
              background: 'var(--color-border)',
              zIndex: 0,
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stages.map((stage, idx) => (
              <Etapa key={stage.id} stage={stage} idx={idx} />
            ))}
          </div>
        </div>
      </div>

      {/* Ready message */}
      {order.status === 'lista' && (
        <div
          className="animate-slide-up"
          style={{
            marginTop: 24,
            padding: 20,
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: 14,
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 24, marginBottom: 8 }}>🎉</p>
          <p style={{ fontWeight: 700, fontSize: 16, color: '#34d399' }}>
            ¡Tu vehículo está listo!
          </p>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6 }}>
            Puedes pasar a retirar tu {order.car_model}.
            <br />
            ¡Gracias por confiar en {workshopName}!
          </p>
        </div>
      )}

      {/* Footer */}
      <p
        style={{
          textAlign: 'center',
          color: 'var(--color-text-muted)',
          fontSize: 11,
          marginTop: 32,
          paddingBottom: 16,
        }}
      >
        {workshopName} © {new Date().getFullYear()} • Esta página se actualiza en tiempo real
      </p>
    </div>
  );
}

/**
 * Quién atiende el carro. Un carro lo puede tocar más de una persona (0021),
 * así que esto es una lista, no un nombre: las fichas bajan de línea solas y,
 * si son muchas, se muestran las primeras y el resto se abre con un toque.
 * Sin eso, cuatro nombres largos rompían el ancho del teléfono.
 */
function FilaMecanicos({ nombres }: { nombres: string[] }) {
  const [abierto, setAbierto] = useState(false);
  // Hasta tres caben sin apretar; a partir de ahí se recorta, porque si no el
  // botón «+1» ocuparía lo mismo que el nombre que esconde.
  const recorta = nombres.length > 3 && !abierto;
  const visibles = recorta ? nombres.slice(0, 2) : nombres;
  const ocultos = nombres.length - visibles.length;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ color: 'var(--color-text-muted)', paddingTop: 3 }}>
        <Wrench size={13} />
      </span>
      <span
        style={{
          fontSize: 12,
          color: 'var(--color-text-muted)',
          minWidth: 60,
          flexShrink: 0,
          paddingTop: 3,
        }}
      >
        {nombres.length > 1 ? 'Mecánicos' : 'Mecánico'}
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minWidth: 0 }}>
        {visibles.map((nombre) => (
          <span
            key={nombre}
            style={{
              fontSize: 13,
              fontWeight: 500,
              padding: '3px 9px',
              borderRadius: 999,
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              overflowWrap: 'anywhere',
            }}
          >
            {nombre}
          </span>
        ))}
        {ocultos > 0 && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: '3px 9px',
              borderRadius: 999,
              background: 'transparent',
              border: '1px dashed var(--color-border)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            +{ocultos} más
          </button>
        )}
        {abierto && nombres.length > 3 && (
          <button
            type="button"
            onClick={() => setAbierto(false)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '3px 6px',
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
            }}
          >
            Ver menos
          </button>
        )}
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {icon && <span style={{ color: 'var(--color-text-muted)' }}>{icon}</span>}
      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 60 }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 500 }} suppressHydrationWarning>
        {value}
      </span>
    </div>
  );
}

/**
 * Una etapa del servicio. El nombre y cómo va se ven siempre; lo que escribió
 * el taller y las fotos se abren tocándola. La que está en proceso viene
 * abierta, porque es la que el cliente quiere ver.
 */
function Etapa({ stage, idx }: { stage: OrderStage; idx: number }) {
  const tieneDetalle = Boolean(stage.description) || (stage.attachments?.length ?? 0) > 0;
  const [abierta, setAbierta] = useState(stage.status === 'in_progress');

  return (
    <div
      className="animate-fade-in"
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        position: 'relative',
        zIndex: 1,
        animationDelay: `${0.15 + idx * 0.06}s`,
      }}
    >
      <div style={{ marginTop: 10, flexShrink: 0 }}>{STAGE_ICONS[stage.status]}</div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          background:
            stage.status === 'done'
              ? 'rgba(16,185,129,0.06)'
              : stage.status === 'in_progress'
              ? 'rgba(245,158,11,0.06)'
              : 'var(--color-surface)',
          border: `1px solid ${
            stage.status === 'done'
              ? 'rgba(16,185,129,0.15)'
              : stage.status === 'in_progress'
              ? 'rgba(245,158,11,0.2)'
              : 'var(--color-border)'
          }`,
          borderRadius: 10,
          marginBottom: 8,
          opacity: stage.status === 'pending' ? 0.5 : 1,
        }}
      >
        <button
          type="button"
          onClick={() => tieneDetalle && setAbierta((v) => !v)}
          aria-expanded={tieneDetalle ? abierta : undefined}
          disabled={!tieneDetalle}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '10px 14px',
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            textAlign: 'left',
            cursor: tieneDetalle ? 'pointer' : 'default',
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: stage.status === 'done' ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
              }}
            >
              {stage.name}
            </span>
            {stage.status === 'in_progress' && (
              <span style={{ display: 'block', fontSize: 12, color: '#fbbf24', marginTop: 4 }}>⏳ En proceso ahora mismo</span>
            )}
            {stage.completed_at && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  color: 'var(--color-text-muted)',
                  marginTop: 4,
                }}
              >
                <Clock size={10} />
                <span suppressHydrationWarning>{formatDate(stage.completed_at)}</span>
              </span>
            )}
          </span>
          {tieneDetalle && (
            <ChevronDown
              size={17}
              style={{
                flexShrink: 0,
                marginTop: 1,
                color: 'var(--color-text-muted)',
                transform: abierta ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s ease',
              }}
            />
          )}
        </button>

        {tieneDetalle && abierta && (
          <div style={{ padding: '0 14px 12px' }}>
            {stage.description && (
              <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>{stage.description}</p>
            )}
            {stage.attachments && stage.attachments.length > 0 && (
              <AttachmentGallery attachments={stage.attachments} tile={80} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
