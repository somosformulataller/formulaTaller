'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Receipt, Check, X, RefreshCw } from 'lucide-react';
import type { BudgetItem, BudgetDecision } from '@/lib/types';
import { formatUsd, parseAmount, DECISION_COLORS } from '@/lib/budget';

// ============================================================================
// Lista de presupuesto — cada ítem con su repuesto/servicio y su mano de obra
// ============================================================================
//
// Funciona de dos maneras, con la misma pinta para el usuario:
//
//  • CON orden (`orderId`): cada cambio se guarda solo en el servidor. Es lo
//    que se ve desde la orden ya creada y desde la pantalla Presupuestos.
//  • SIN orden (`borrador`): la lista vive en memoria y el formulario de alta
//    la manda entera cuando la orden por fin existe. Hace falta porque al
//    crear la orden todavía no hay `order_id` al que colgar los ítems.
//
// El total NUNCA se guarda: se suma aquí y en el servidor desde los ítems,
// así no hay forma de que quede desfasado del detalle.

/** Un renglón en pantalla. `id` es null mientras no exista en la base. */
export interface Renglon {
  key: string;
  id: string | null;
  description: string;
  /** Costo del repuesto o servicio. Texto crudo mientras se teclea ("12,5"). */
  amount: string;
  /** Costo de la mano de obra, también en texto crudo (0023). */
  labor: string;
  /** Lo que decidió el cliente en su enlace (solo en vivo). */
  decision?: BudgetDecision;
  /** El taller cambió el monto después de que el cliente decidiera. */
  revisado?: boolean;
}

let contador = 0;
export function nuevoRenglon(description = '', amount = '', labor = ''): Renglon {
  contador += 1;
  return { key: `r${contador}`, id: null, description, amount, labor };
}

function centavos(raw: string): number {
  return Math.round((parseAmount(raw) ?? 0) * 100);
}

/** Total de repuestos o servicios. */
export function repuestosDe(renglones: Renglon[]): number {
  return renglones.reduce((acc, r) => acc + centavos(r.amount), 0) / 100;
}

/** Total de mano de obra. */
export function manoDeObraDe(renglones: Renglon[]): number {
  return renglones.reduce((acc, r) => acc + centavos(r.labor), 0) / 100;
}

/** Total general: repuestos + mano de obra. */
export function totalDe(renglones: Renglon[]): number {
  return renglones.reduce((acc, r) => acc + centavos(r.amount) + centavos(r.labor), 0) / 100;
}

function desdeItem(i: BudgetItem): Renglon {
  return {
    key: i.id,
    id: i.id,
    description: i.description,
    amount: String(Number(i.amount)),
    labor: Number(i.labor_amount) ? String(Number(i.labor_amount)) : '',
    decision: i.client_decision,
    revisado: Boolean(i.revised_at) && i.client_decision === 'pendiente',
  };
}

interface Props {
  /** Con id: se guarda solo. Sin id: es un borrador en memoria. */
  orderId?: string | null;
  /** Borrador controlado por el padre (solo sin orderId). */
  borrador?: Renglon[];
  onBorradorChange?: (r: Renglon[]) => void;
  /** Avisa el total al padre (para pintarlo fuera de la lista). */
  onTotalChange?: (total: number) => void;
  /** Ítems ya leídos (en vivo): se muestran sin pedirlos otra vez. */
  iniciales?: BudgetItem[];
  /** Avisa los renglones al padre (en vivo), p. ej. para armar el WhatsApp. */
  onFilasChange?: (filas: Renglon[]) => void;
}

export default function BudgetList({
  orderId,
  borrador,
  onBorradorChange,
  onTotalChange,
  iniciales,
  onFilasChange,
}: Props) {
  const enVivo = Boolean(orderId);
  const [filas, setFilas] = useState<Renglon[]>(
    enVivo && iniciales ? iniciales.map(desdeItem) : borrador ?? []
  );
  const [cargando, setCargando] = useState(enVivo && !iniciales);
  const yaCargada = useRef(Boolean(iniciales));
  const [guardando, setGuardando] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const ultimoRef = useRef<HTMLInputElement | null>(null);
  const enfocarUltimo = useRef(false);

  // Mantener sincronizado el borrador que controla el padre.
  const aplicar = useCallback(
    (siguiente: Renglon[] | ((prev: Renglon[]) => Renglon[])) => {
      setFilas((prev) => {
        const val = typeof siguiente === 'function' ? siguiente(prev) : siguiente;
        if (!enVivo) onBorradorChange?.(val);
        return val;
      });
    },
    [enVivo, onBorradorChange]
  );

  // Carga inicial (solo en vivo y si no llegó con los ítems).
  useEffect(() => {
    if (!orderId || yaCargada.current) return;
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/budget`, { cache: 'no-store' });
        if (!res.ok) throw new Error('No se pudo cargar el presupuesto');
        const data: BudgetItem[] = await res.json();
        if (!vivo) return;
        setFilas(data.map(desdeItem));
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : 'Error al cargar');
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [orderId]);

  const total = totalDe(filas);
  const repuestos = repuestosDe(filas);
  const manoDeObra = manoDeObraDe(filas);
  const aprobado =
    filas
      .filter((f) => f.decision === 'aprobado')
      .reduce((acc, f) => acc + centavos(f.amount) + centavos(f.labor), 0) / 100;
  const hayDecisiones = filas.some((f) => f.decision && f.decision !== 'pendiente');

  useEffect(() => {
    onTotalChange?.(total);
  }, [total, onTotalChange]);

  useEffect(() => {
    if (enVivo) onFilasChange?.(filas);
  }, [enVivo, filas, onFilasChange]);

  // Enfocar el renglón recién agregado para poder escribir de una vez.
  useEffect(() => {
    if (enfocarUltimo.current && ultimoRef.current) {
      ultimoRef.current.focus();
      enfocarUltimo.current = false;
    }
  }, [filas.length]);

  function agregar() {
    enfocarUltimo.current = true;
    aplicar((prev) => [...prev, nuevoRenglon()]);
  }

  function editar(key: string, campo: 'description' | 'amount' | 'labor', valor: string) {
    aplicar((prev) => prev.map((f) => (f.key === key ? { ...f, [campo]: valor } : f)));
  }

  async function conGuardado<T>(fn: () => Promise<T>): Promise<T | null> {
    setGuardando((n) => n + 1);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
      return null;
    } finally {
      setGuardando((n) => n - 1);
    }
  }

  // En vivo: al salir del campo se guarda. Un renglón sin nombre no se manda
  // (la base lo rechaza), así que se queda en pantalla hasta que se escriba.
  async function alSalir(key: string) {
    if (!enVivo) return;
    const fila = filas.find((f) => f.key === key);
    if (!fila) return;
    const description = fila.description.trim();
    const amount = parseAmount(fila.amount) ?? 0;
    const labor_amount = parseAmount(fila.labor) ?? 0;
    if (!description) return;

    setError(null);

    if (fila.id) {
      await conGuardado(async () => {
        const res = await fetch(`/api/orders/${orderId}/budget/${fila.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description, amount, labor_amount }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo guardar');
        const guardado: BudgetItem = await res.json();
        aplicar((prev) => prev.map((f) => (f.key === key ? { ...desdeItem(guardado), key } : f)));
      });
      return;
    }

    await conGuardado(async () => {
      const res = await fetch(`/api/orders/${orderId}/budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, amount, labor_amount }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo guardar');
      const [creado]: BudgetItem[] = await res.json();
      if (!creado) return;
      aplicar((prev) => prev.map((f) => (f.key === key ? desdeItem(creado) : f)));
    });
  }

  async function borrar(key: string) {
    const fila = filas.find((f) => f.key === key);
    if (!fila) return;
    // Fuera de pantalla de inmediato: si el servidor falla, se avisa y se
    // recarga; esperar al ida y vuelta se siente trabado en el teléfono.
    aplicar((prev) => prev.filter((f) => f.key !== key));
    if (!enVivo || !fila.id) return;

    await conGuardado(async () => {
      const res = await fetch(`/api/orders/${orderId}/budget/${fila.id}`, { method: 'DELETE' });
      if (!res.ok) {
        aplicar((prev) => [...prev, fila]);
        throw new Error('No se pudo eliminar el ítem');
      }
    });
  }

  if (cargando) {
    return <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Cargando presupuesto…</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {filas.length === 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            padding: '18px 10px',
            color: 'var(--color-text-muted)',
            textAlign: 'center',
          }}
        >
          <Receipt size={26} style={{ opacity: 0.35 }} />
          <p style={{ fontSize: 13 }}>
            Todavía no hay nada cobrado.
            <br />
            Agrega el primer repuesto o servicio.
          </p>
        </div>
      )}

      {filas.map((f, i) => (
        <div
          key={f.key}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 10,
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input
              ref={i === filas.length - 1 ? ultimoRef : undefined}
              className="form-input"
              placeholder="Nombre del repuesto o servicio"
              aria-label="Nombre del repuesto o servicio"
              value={f.description}
              maxLength={120}
              onChange={(e) => editar(f.key, 'description', e.target.value)}
              onBlur={() => alSalir(f.key)}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button
              type="button"
              onClick={() => borrar(f.key)}
              aria-label={`Eliminar ${f.description || 'ítem'}`}
              style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                color: '#ef4444',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={15} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <CampoMonto
              etiqueta="Repuesto o servicio"
              valor={f.amount}
              onChange={(v) => editar(f.key, 'amount', v)}
              onBlur={() => alSalir(f.key)}
            />
            <CampoMonto
              etiqueta="Mano de obra"
              valor={f.labor}
              onChange={(v) => editar(f.key, 'labor', v)}
              onBlur={() => alSalir(f.key)}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              fontSize: 12,
            }}
          >
            <EstadoCliente decision={f.decision} revisado={f.revisado} enVivo={enVivo && !!f.id} />
            <span style={{ color: 'var(--color-text-secondary)' }}>
              Subtotal{' '}
              <strong style={{ color: 'var(--color-text-primary)' }}>
                {formatUsd((centavos(f.amount) + centavos(f.labor)) / 100)}
              </strong>
            </span>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={agregar}
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
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
        }}
      >
        <Plus size={15} />
        Agregar ítem
      </button>

      {error && <p style={{ color: 'var(--color-danger)', fontSize: 12 }}>{error}</p>}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          marginTop: 2,
          paddingTop: 12,
          borderTop: '1px solid var(--color-border)',
          fontSize: 13,
          color: 'var(--color-text-secondary)',
        }}
      >
        <FilaTotal etiqueta="Repuestos y servicios" valor={repuestos} />
        <FilaTotal etiqueta="Mano de obra" valor={manoDeObra} />
        {hayDecisiones && (
          <FilaTotal etiqueta="Aprobado por el cliente" valor={aprobado} color={DECISION_COLORS.aprobado} />
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          Total general
          {guardando > 0 && (
            <span style={{ fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 8 }}>
              guardando…
            </span>
          )}
        </span>
        <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-brand-400)' }}>
          {formatUsd(total)}
        </span>
      </div>
    </div>
  );
}

function CampoMonto({
  etiqueta,
  valor,
  onChange,
  onBlur,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>{etiqueta}</span>
      <span style={{ position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-text-muted)',
            fontSize: 13,
            pointerEvents: 'none',
          }}
        >
          $
        </span>
        <input
          className="form-input"
          // decimal, no "number": en el teléfono abre el teclado numérico
          // sin las flechitas que cambian el monto sin querer al rozarlas.
          inputMode="decimal"
          placeholder="0,00"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          style={{ paddingLeft: 24, width: '100%' }}
        />
      </span>
    </label>
  );
}

function FilaTotal({ etiqueta, valor, color }: { etiqueta: string; valor: number; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color }}>
      <span>{etiqueta}</span>
      <span style={{ fontWeight: 600 }}>{formatUsd(valor)}</span>
    </div>
  );
}

/** Lo que el cliente decidió en su enlace. En el borrador no se muestra nada. */
function EstadoCliente({
  decision,
  revisado,
  enVivo,
}: {
  decision?: BudgetDecision;
  revisado?: boolean;
  enVivo: boolean;
}) {
  if (!enVivo) return <span />;
  if (decision === 'aprobado' || decision === 'rechazado') {
    const Icono = decision === 'aprobado' ? Check : X;
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontWeight: 700,
          color: DECISION_COLORS[decision],
        }}
      >
        <Icono size={13} />
        {decision === 'aprobado' ? 'El cliente lo aprobó' : 'El cliente lo rechazó'}
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)' }}>
      {revisado && <RefreshCw size={12} />}
      {revisado ? 'Actualizado: espera al cliente' : 'Esperando al cliente'}
    </span>
  );
}
