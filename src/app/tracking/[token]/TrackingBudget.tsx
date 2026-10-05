'use client';

import { useState } from 'react';
import { Check, X, CheckCheck, RefreshCw } from 'lucide-react';
import type { BudgetItem, BudgetDecision } from '@/lib/types';
import {
  formatUsd,
  sumarTotal,
  sumarRepuestos,
  sumarManoDeObra,
  subtotalItem,
  DECISION_COLORS,
} from '@/lib/budget';

/**
 * El presupuesto en el enlace del cliente. Cada ítem muestra el repuesto o
 * servicio, la mano de obra y su subtotal, con dos botones: aprobar (✓) y
 * rechazar (✗). Puede cambiar de idea mientras el carro no esté listo; cada
 * decisión le llega al taller como notificación.
 */
export default function TrackingBudget({
  token,
  initialItems,
  cerrado,
}: {
  token: string;
  initialItems: BudgetItem[];
  /** Vehículo listo: se ve el presupuesto pero ya no se decide. */
  cerrado: boolean;
}) {
  const [items, setItems] = useState<BudgetItem[]>(initialItems);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const aprobados = items.filter((i) => i.client_decision === 'aprobado');
  const pendientes = items.filter((i) => i.client_decision !== 'aprobado');

  async function decidir(cuerpo: { item_id?: string; all?: boolean; decision: BudgetDecision }, clave: string) {
    setError(null);
    setOcupado(clave);
    try {
      const res = await fetch(`/api/tracking/${token}/budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar tu respuesta');
      setItems(data as BudgetItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar tu respuesta');
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="card animate-fade-in" style={{ marginBottom: 20 }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          marginBottom: 4,
        }}
      >
        Presupuesto
      </p>
      {!cerrado && (
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10 }}>
          Toca ✓ para aprobar o ✗ para rechazar cada servicio. El taller recibe tu respuesta al instante.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item) => {
          const d = item.client_decision;
          const revisado = Boolean(item.revised_at) && d === 'pendiente';
          return (
            <div
              key={item.id}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${
                  d === 'aprobado'
                    ? 'rgba(16,185,129,0.35)'
                    : d === 'rechazado'
                    ? 'rgba(239,68,68,0.35)'
                    : 'var(--color-border)'
                }`,
                background:
                  d === 'aprobado'
                    ? 'rgba(16,185,129,0.06)'
                    : d === 'rechazado'
                    ? 'rgba(239,68,68,0.05)'
                    : 'var(--color-surface-2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      textDecoration: d === 'rechazado' ? 'line-through' : 'none',
                      opacity: d === 'rechazado' ? 0.7 : 1,
                    }}
                  >
                    {item.description}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                    Repuesto o servicio {formatUsd(Number(item.amount))}
                    {Number(item.labor_amount) > 0 && <> · Mano de obra {formatUsd(Number(item.labor_amount))}</>}
                  </p>
                  {revisado && (
                    <p
                      style={{
                        fontSize: 11.5,
                        color: '#fbbf24',
                        marginTop: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <RefreshCw size={11} />
                      El taller actualizó este precio
                    </p>
                  )}
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {formatUsd(subtotalItem(item))}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: DECISION_COLORS[d] }}>
                  {d === 'aprobado' ? 'Aprobado' : d === 'rechazado' ? 'Rechazado' : 'Por decidir'}
                </span>
                {!cerrado && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <BotonDecision
                      tipo="aprobado"
                      activo={d === 'aprobado'}
                      cargando={ocupado === item.id + 'aprobado'}
                      deshabilitado={ocupado !== null}
                      onClick={() => decidir({ item_id: item.id, decision: 'aprobado' }, item.id + 'aprobado')}
                    />
                    <BotonDecision
                      tipo="rechazado"
                      activo={d === 'rechazado'}
                      cargando={ocupado === item.id + 'rechazado'}
                      deshabilitado={ocupado !== null}
                      onClick={() => decidir({ item_id: item.id, decision: 'rechazado' }, item.id + 'rechazado')}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!cerrado && pendientes.length > 0 && (
        <button
          type="button"
          disabled={ocupado !== null}
          onClick={() => decidir({ all: true, decision: 'aprobado' }, 'todo')}
          style={{
            marginTop: 12,
            width: '100%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '11px 14px',
            borderRadius: 10,
            border: '1px solid rgba(16,185,129,0.4)',
            background: 'rgba(16,185,129,0.12)',
            color: '#34d399',
            fontSize: 14,
            fontWeight: 700,
            cursor: ocupado ? 'wait' : 'pointer',
          }}
        >
          <CheckCheck size={17} />
          {ocupado === 'todo' ? 'Guardando…' : 'Aprobar todo'}
        </button>
      )}

      {error && <p style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 8 }}>{error}</p>}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          marginTop: 12,
          paddingTop: 12,
          borderTop: '1px solid var(--color-border)',
          fontSize: 13,
          color: 'var(--color-text-secondary)',
        }}
      >
        <Fila etiqueta="Repuestos y servicios" valor={sumarRepuestos(items)} />
        <Fila etiqueta="Mano de obra" valor={sumarManoDeObra(items)} />
        <Fila etiqueta="Total" valor={sumarTotal(items)} fuerte />
        {aprobados.length > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginTop: 6,
              color: '#34d399',
            }}
          >
            <span style={{ fontWeight: 700 }}>Total aprobado</span>
            <span style={{ fontSize: 20, fontWeight: 800 }}>{formatUsd(sumarTotal(aprobados))}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Fila({ etiqueta, valor, fuerte }: { etiqueta: string; valor: number; fuerte?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 10,
        fontWeight: fuerte ? 700 : 400,
        color: fuerte ? 'var(--color-text-primary)' : undefined,
      }}
    >
      <span>{etiqueta}</span>
      <span style={{ fontWeight: fuerte ? 800 : 600 }}>{formatUsd(valor)}</span>
    </div>
  );
}

function BotonDecision({
  tipo,
  activo,
  cargando,
  deshabilitado,
  onClick,
}: {
  tipo: 'aprobado' | 'rechazado';
  activo: boolean;
  cargando: boolean;
  deshabilitado: boolean;
  onClick: () => void;
}) {
  const Icono = tipo === 'aprobado' ? Check : X;
  const color = tipo === 'aprobado' ? '#10b981' : '#ef4444';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado || activo}
      aria-pressed={activo}
      aria-label={tipo === 'aprobado' ? 'Aprobar' : 'Rechazar'}
      title={tipo === 'aprobado' ? 'Aprobar' : 'Rechazar'}
      style={{
        width: 40,
        height: 36,
        borderRadius: 9,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${activo ? color : 'var(--color-border)'}`,
        background: activo ? color : 'var(--color-surface)',
        color: activo ? '#fff' : color,
        cursor: deshabilitado || activo ? 'default' : 'pointer',
        opacity: cargando ? 0.6 : 1,
      }}
    >
      <Icono size={18} strokeWidth={2.5} />
    </button>
  );
}
