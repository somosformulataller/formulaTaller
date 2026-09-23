'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Receipt } from 'lucide-react';
import type { BudgetItem } from '@/lib/types';
import { formatUsd, parseAmount } from '@/lib/budget';

// ============================================================================
// Lista de presupuesto — repuestos y servicios con su precio
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
  /** Texto crudo mientras se teclea ("12,5"); se convierte al guardar. */
  amount: string;
}

let contador = 0;
export function nuevoRenglon(description = '', amount = ''): Renglon {
  contador += 1;
  return { key: `r${contador}`, id: null, description, amount };
}

export function totalDe(renglones: Renglon[]): number {
  const centavos = renglones.reduce(
    (acc, r) => acc + Math.round((parseAmount(r.amount) ?? 0) * 100),
    0
  );
  return centavos / 100;
}

interface Props {
  /** Con id: se guarda solo. Sin id: es un borrador en memoria. */
  orderId?: string | null;
  /** Borrador controlado por el padre (solo sin orderId). */
  borrador?: Renglon[];
  onBorradorChange?: (r: Renglon[]) => void;
  /** Avisa el total al padre (para pintarlo fuera de la lista). */
  onTotalChange?: (total: number) => void;
}

export default function BudgetList({
  orderId,
  borrador,
  onBorradorChange,
  onTotalChange,
}: Props) {
  const enVivo = Boolean(orderId);
  const [filas, setFilas] = useState<Renglon[]>(borrador ?? []);
  const [cargando, setCargando] = useState(enVivo);
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

  // Carga inicial (solo en vivo).
  useEffect(() => {
    if (!orderId) return;
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/budget`, { cache: 'no-store' });
        if (!res.ok) throw new Error('No se pudo cargar el presupuesto');
        const data: BudgetItem[] = await res.json();
        if (!vivo) return;
        setFilas(
          data.map((i) => ({
            key: i.id,
            id: i.id,
            description: i.description,
            amount: String(Number(i.amount)),
          }))
        );
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
  useEffect(() => {
    onTotalChange?.(total);
  }, [total, onTotalChange]);

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

  function editar(key: string, campo: 'description' | 'amount', valor: string) {
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
    if (!description) return;

    setError(null);

    if (fila.id) {
      await conGuardado(async () => {
        const res = await fetch(`/api/orders/${orderId}/budget/${fila.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description, amount }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo guardar');
        const guardado: BudgetItem = await res.json();
        aplicar((prev) =>
          prev.map((f) =>
            f.key === key ? { ...f, description: guardado.description, amount: String(Number(guardado.amount)) } : f
          )
        );
      });
      return;
    }

    await conGuardado(async () => {
      const res = await fetch(`/api/orders/${orderId}/budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, amount }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo guardar');
      const [creado]: BudgetItem[] = await res.json();
      if (!creado) return;
      aplicar((prev) =>
        prev.map((f) =>
          f.key === key
            ? { key: creado.id, id: creado.id, description: creado.description, amount: String(Number(creado.amount)) }
            : f
        )
      );
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
        <div key={f.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <input
            ref={i === filas.length - 1 ? ultimoRef : undefined}
            className="form-input"
            placeholder="Repuesto o servicio"
            value={f.description}
            maxLength={120}
            onChange={(e) => editar(f.key, 'description', e.target.value)}
            onBlur={() => alSalir(f.key)}
            style={{ flex: 1, minWidth: 0 }}
          />
          <div style={{ position: 'relative', width: 112, flexShrink: 0 }}>
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
              value={f.amount}
              onChange={(e) => editar(f.key, 'amount', e.target.value)}
              onBlur={() => alSalir(f.key)}
              style={{ paddingLeft: 24, width: '100%' }}
            />
          </div>
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
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              color: '#ef4444',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={15} />
          </button>
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
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
          marginTop: 2,
          paddingTop: 12,
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          Total
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
