'use client';

import { useEffect, useRef, useState } from 'react';
import type { Profile } from '@/lib/types';
import { ChevronDown, Check, Plus } from 'lucide-react';

// Ancho mínimo de la lista desplegable, y la medida con la que se decide si
// cabe hacia la derecha o hay que anclarla por el otro lado.
const ANCHO_MINIMO = 230;

interface MechanicSelectProps {
  mechanics: Profile[];
  /**
   * Nombre del taller. Solo se usa para el texto del botón cerrado cuando la
   * orden se enseña «como el taller»: dentro de la lista no aparece, porque
   * ahí solo van los mecánicos.
   */
  workshopName?: string | null;
  /** Los mecánicos asignados hoy. Varios: todos iguales (migración 0021). */
  value: string[];
  /** Si al cliente se le enseña el nombre del taller (migración 0020). */
  comoTaller?: boolean;
  onChange: (ids: string[], comoTaller: boolean) => void;
  disabled?: boolean;
  /** Texto cuando no hay nadie elegido (default "Sin asignar"). */
  placeholder?: string;
  /** Botón compacto de ancho automático (para la tarjeta de orden). */
  compact?: boolean;
  /** Lista flotante (absoluta) en vez de empujar el contenido. */
  float?: boolean;
  /** Si se pasa, agrega al final una opción para crear un mecánico nuevo. */
  onAddNew?: () => void;
}

/**
 * Selector de los mecánicos de una orden. Es de **varios**: un carro lo puede
 * tocar el de latonería, el de electricidad y quien hace la prueba de ruta, y
 * los tres tienen que poder abrirlo (migración 0021). Por eso son casillas y
 * no una lista de una sola opción, y por eso el menú NO se cierra al elegir:
 * casi siempre se marca a más de uno de una vez.
 *
 * El dueño del taller sale en la lista como uno más y sin etiqueta: muchos
 * dueños también reparan carros, y quien está mirando es él mismo.
 *
 * Dentro de la lista NO hay nada más: solo los mecánicos y la opción de
 * agregar uno. Lo de enseñarle al cliente el nombre del taller en vez de los
 * nombres (0020) es una casilla aparte, debajo del campo, donde hay sitio para
 * explicarla; metida aquí se leía como si fuera otro mecánico más.
 */
export default function MechanicSelect({
  mechanics,
  workshopName,
  value,
  comoTaller = false,
  onChange,
  disabled,
  placeholder = 'Sin asignar',
  compact = false,
  float = false,
  onAddNew,
}: MechanicSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Hacia dónde abrir la lista y cuánto puede crecer. En el teléfono, una
  // tarjeta de orden queda cerca del borde de abajo: la lista se salía de la
  // pantalla, quedaba tapada por el botón flotante de Soporte y no había cómo
  // subirla con el dedo. Si abajo no cabe, se abre hacia arriba.
  const [haciaArriba, setHaciaArriba] = useState(false);
  const [altoMax, setAltoMax] = useState<number | undefined>(undefined);
  // Y lo mismo a lo ancho: el botón vive en el lado derecho de la tarjeta, así
  // que una lista anclada por su izquierda se salía por el borde de la
  // pantalla y se comía las casillas. Si no cabe, se ancla por la derecha.
  const [alaDerecha, setAlaDerecha] = useState(false);

  function alternarMenu() {
    if (disabled) return;
    if (open) { setOpen(false); return; }
    const caja = ref.current?.getBoundingClientRect();
    if (caja) {
      // Debajo hay que dejar libre la barra de navegación y el botón de
      // Soporte, que flotan encima de todo.
      const ESTORBO_ABAJO = 96;
      const sitioAbajo = window.innerHeight - caja.bottom - ESTORBO_ABAJO;
      const sitioArriba = caja.top - 16;
      const arriba = sitioAbajo < 170 && sitioArriba > sitioAbajo;
      setHaciaArriba(arriba);
      setAltoMax(Math.max(150, Math.min(280, arriba ? sitioArriba : sitioAbajo)));
      setAlaDerecha(caja.left + ANCHO_MINIMO > window.innerWidth - 12);
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const elegidos = mechanics.filter((m) => value.includes(m.id));

  // Lo que se lee en el botón cerrado. Con el taller de por medio, el botón
  // dice lo que va a ver el cliente, que es la decisión que se acaba de tomar.
  const resumen =
    elegidos.length === 0
      ? null
      : comoTaller && workshopName
      ? workshopName
      : elegidos.length === 1
      ? elegidos[0].full_name
      : `${elegidos.length} mecánicos`;

  function alternar(id: string) {
    const nuevos = value.includes(id) ? value.filter((v) => v !== id) : [...value, id];
    // Sin nadie asignado no hay nombre que tapar: la casilla del taller se
    // apaga sola para no dejarla encendida y olvidada.
    onChange(nuevos, nuevos.length > 0 && comoTaller);
  }

  const buttonStyle: React.CSSProperties = compact
    ? {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '8px 12px',
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        width: 'auto',
      }
    : {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
      };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className={compact ? undefined : 'form-input'}
        onClick={alternarMenu}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={buttonStyle}
      >
        <span
          style={{
            color: resumen ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {resumen ?? placeholder}
        </span>
        <ChevronDown
          size={16}
          style={{
            flexShrink: 0,
            color: 'var(--color-text-muted)',
            transition: 'transform 0.15s',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        />
      </button>

      {open && (
        <ul
          className="select-menu"
          role="listbox"
          aria-multiselectable
          style={
            float
              ? {
                  position: 'absolute',
                  ...(alaDerecha ? { right: 0 } : { left: 0 }),
                  // Por encima del botón flotante de Soporte (60), que si no
                  // se le montaba encima justo a los nombres.
                  zIndex: 70,
                  minWidth: ANCHO_MINIMO,
                  // Nunca más ancha que la pantalla, pase lo que pase con los
                  // nombres largos.
                  maxWidth: 'calc(100vw - 24px)',
                  maxHeight: altoMax,
                  ...(haciaArriba
                    ? { bottom: '100%', marginTop: 0, marginBottom: 6 }
                    : { top: '100%' }),
                }
              : undefined
          }
        >
          {mechanics.length === 0 && (
            <li>
              <span
                className="select-option"
                style={{ color: 'var(--color-text-muted)', cursor: 'default' }}
              >
                Todavía no hay mecánicos
              </span>
            </li>
          )}

          {mechanics.map((m) => {
            const marcado = value.includes(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={marcado}
                  className="select-option"
                  onClick={() => alternar(m.id)}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      overflow: 'hidden',
                      minWidth: 0,
                    }}
                  >
                    {/* La casilla se ve siempre, marcada o no: es lo que dice
                        que aquí se puede elegir a más de uno. Con solo la
                        palomita al marcar, la lista parecía de una sola
                        opción. */}
                    <span
                      aria-hidden
                      style={{
                        width: 18,
                        height: 18,
                        flexShrink: 0,
                        borderRadius: 5,
                        border: `1.5px solid ${
                          marcado ? 'var(--color-brand-500)' : 'var(--color-border)'
                        }`,
                        background: marcado ? 'var(--color-brand-500)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#1a1a1a',
                      }}
                    >
                      {marcado && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {m.full_name}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}

          {onAddNew && (
            <li style={{ borderTop: '1px solid var(--color-border)', marginTop: 2, paddingTop: 2 }}>
              <button
                type="button"
                className="select-option"
                onClick={() => {
                  setOpen(false);
                  onAddNew();
                }}
                style={{ color: 'var(--color-brand-400)', fontWeight: 700 }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={15} style={{ flexShrink: 0 }} />
                  {mechanics.length ? 'Agregar otro mecánico' : 'Agregar mecánico'}
                </span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
