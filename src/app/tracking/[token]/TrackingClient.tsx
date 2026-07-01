'use client';

import type { Order, OrderStage, StageStatus, OrderStatus } from '@/lib/types';
import { formatDate, ORDER_STATUS_LABELS } from '@/lib/utils';
import { CheckCircle2, Circle, Loader2, Car, Wrench, Clock, FileText } from 'lucide-react';

interface TrackingClientProps {
  order: Order;
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

const STATUS_BG: Record<OrderStatus, string> = {
  sin_mecanico: 'rgba(255,255,255,0.06)',
  con_mecanico: 'rgba(245,158,11,0.1)',
  lista: 'rgba(16,185,129,0.1)',
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  sin_mecanico: 'var(--color-text-secondary)',
  con_mecanico: '#fbbf24',
  lista: '#34d399',
};

export default function TrackingClient({ order }: TrackingClientProps) {
  const stages = (order.stages ?? []) as OrderStage[];
  const done = stages.filter((s) => s.status === 'done').length;
  const progress = stages.length > 0 ? Math.round((done / stages.length) * 100) : 0;
  const clientName = `${order.client_first_name} ${order.client_last_name}`;

  const mechanic = order.assigned_mechanic as { full_name: string } | null | undefined;

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
      {/* Logo header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            background: 'linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700))',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Wrench size={20} color="#0D0F1A" strokeWidth={2.5} />
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15, lineHeight: 1 }}>Formula Taller</p>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1, marginTop: 2 }}>
            Seguimiento de servicio
          </p>
        </div>
      </div>

      {/* Status banner */}
      <div
        className="animate-fade-in"
        style={{
          background: STATUS_BG[order.status],
          border: `1px solid ${STATUS_COLOR[order.status]}30`,
          borderRadius: 14,
          padding: '14px 18px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
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
          <p
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: STATUS_COLOR[order.status],
            }}
          >
            {order.status === 'lista'
              ? '¡Tu vehículo está listo! 🎉'
              : order.status === 'con_mecanico'
              ? 'En servicio 🔧'
              : 'En espera de mecánico'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {ORDER_STATUS_LABELS[order.status]}
          </p>
        </div>
      </div>

      {/* Vehicle info card */}
      <div
        className="card animate-fade-in"
        style={{ marginBottom: 16, animationDelay: '0.05s' }}
      >
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 12 }}>
          Información
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Row label="Cliente" value={clientName} />
          <Row icon={<Car size={13} />} label="Vehículo" value={order.car_model} />
          {mechanic && (
            <Row icon={<Wrench size={13} />} label="Mecánico" value={mechanic.full_name} />
          )}
          <Row
            icon={<Clock size={13} />}
            label="Recibido"
            value={formatDate(order.created_at)}
          />
        </div>
      </div>

      {/* Progress summary */}
      <div
        className="card animate-fade-in"
        style={{ marginBottom: 20, animationDelay: '0.1s' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Progreso del servicio</span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--color-brand-400)',
            }}
          >
            {progress}%
          </span>
        </div>
        <div
          style={{
            height: 8,
            background: 'var(--color-surface-3)',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background:
                progress === 100
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : 'linear-gradient(90deg, var(--color-brand-600), var(--color-brand-400))',
              borderRadius: 4,
              transition: 'width 0.6s ease',
            }}
          />
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>
          {done} de {stages.length} etapas completadas
        </p>
      </div>

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
              <div
                key={stage.id}
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
                {/* Icon */}
                <div style={{ marginTop: 10, flexShrink: 0 }}>
                  {STAGE_ICONS[stage.status]}
                </div>

                {/* Stage card */}
                <div
                  style={{
                    flex: 1,
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
                    padding: '10px 14px',
                    marginBottom: 8,
                    opacity: stage.status === 'pending' ? 0.5 : 1,
                  }}
                >
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color:
                        stage.status === 'done'
                          ? 'var(--color-text-secondary)'
                          : 'var(--color-text-primary)',
                      textDecoration: stage.status === 'done' ? 'line-through' : 'none',
                    }}
                  >
                    {stage.name}
                  </p>

                  {stage.description && (
                    <p
                      style={{
                        fontSize: 12,
                        color: 'var(--color-text-secondary)',
                        marginTop: 6,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {stage.description}
                    </p>
                  )}

                  {stage.status === 'in_progress' && (
                    <p
                      style={{
                        fontSize: 12,
                        color: '#fbbf24',
                        marginTop: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      ⏳ En proceso ahora mismo
                    </p>
                  )}

                  {stage.completed_at && (
                    <p
                      style={{
                        fontSize: 11,
                        color: 'var(--color-text-muted)',
                        marginTop: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Clock size={10} />
                      {formatDate(stage.completed_at)}
                    </p>
                  )}

                  {stage.attachments && stage.attachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                      {stage.attachments.map((att) => {
                        const isImage = att.mime?.startsWith('image/');
                        return isImage ? (
                          <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={att.url}
                              alt={att.name ?? 'foto'}
                              style={{
                                width: 72,
                                height: 72,
                                objectFit: 'cover',
                                borderRadius: 8,
                                border: '1px solid var(--color-border)',
                                display: 'block',
                              }}
                            />
                          </a>
                        ) : (
                          <a
                            key={att.id}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '8px 12px',
                              background: 'var(--color-surface-2)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 8,
                              color: 'var(--color-text-secondary)',
                              fontSize: 12,
                              fontWeight: 600,
                              textDecoration: 'none',
                              maxWidth: 180,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <FileText size={14} />
                            {att.name ?? 'Documento'}
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
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
            ¡Gracias por confiar en Formula Taller!
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
        Formula Taller © {new Date().getFullYear()} • Esta página se actualiza en tiempo real
      </p>
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
      <span style={{ fontSize: 14, fontWeight: 500 }}>{value}</span>
    </div>
  );
}
