import { Wrench } from 'lucide-react';

/** Colores de Formula Taller: los usa quien no subió logo ni eligió colores. */
export const MARCA_FT = { c1: '#f59e0b', c2: '#b45309' };

/** «#rrggbb» + transparencia → rgba(). */
function alfa(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * Cabecera con la marca del taller para lo que ve el cliente (seguimiento y
 * enlace del presupuesto): logo, nombre en grande y los colores del logo
 * (0031). Sin logo, el nombre en grande con los colores de Formula Taller.
 */
export default function CabeceraTaller({
  nombre,
  logoUrl,
  color,
  color2,
  etiqueta,
  children,
}: {
  nombre: string;
  logoUrl: string | null;
  color?: string | null;
  color2?: string | null;
  /** Texto pequeño bajo el nombre («Seguimiento de servicio», «Presupuesto»). */
  etiqueta: string;
  /** Lo que va dentro, abajo (p. ej. el estado de la orden). */
  children?: React.ReactNode;
}) {
  const c1 = color || MARCA_FT.c1;
  const c2 = color2 || color || MARCA_FT.c2;
  // El nombre lo más grande que quepa sin partir palabras.
  const n = nombre.length;
  const tamano = n <= 10 ? 30 : n <= 14 ? 25 : n <= 20 ? 22 : 19;

  return (
    <div
      className="animate-fade-in"
      style={{
        padding: 2,
        borderRadius: 20,
        marginBottom: 20,
        background: 'linear-gradient(135deg, #f8fafc 0%, #94a3b8 22%, #e2e8f0 45%, #475569 70%, #cbd5e1 100%)',
        boxShadow: `0 10px 30px ${alfa(c1, 0.28)}, 0 2px 6px rgba(0,0,0,0.5)`,
      }}
    >
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 18,
          padding: '18px 16px 16px',
          background: `radial-gradient(ellipse at 20% 0%, ${alfa(c1, 0.6)} 0%, transparent 60%), radial-gradient(ellipse at 100% 100%, ${alfa(c2, 0.45)} 0%, transparent 55%), linear-gradient(160deg, #111827 0%, #05070d 100%)`,
        }}
      >
        {/* Brillo de arriba, como un vidrio. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            height: '48%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 100%)',
            pointerEvents: 'none',
          }}
        />
        <Cuadros />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
          {logoUrl ? (
            <div
              style={{
                width: 68,
                height: 68,
                flexShrink: 0,
                borderRadius: '50%',
                padding: 3,
                background: `linear-gradient(135deg, #f8fafc, ${c1} 45%, #334155)`,
                boxShadow: `0 0 18px ${alfa(c1, 0.55)}`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={nombre}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', background: '#fff', display: 'block' }}
              />
            </div>
          ) : (
            <div
              style={{
                width: 52,
                height: 52,
                flexShrink: 0,
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `linear-gradient(135deg, ${c1}, ${c2})`,
                boxShadow: `0 0 18px ${alfa(c1, 0.5)}`,
              }}
            >
              <Wrench size={26} color="#0D0F1A" strokeWidth={2.5} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: logoUrl ? tamano - 2 : tamano,
                fontWeight: 900,
                lineHeight: 1.08,
                letterSpacing: '-0.01em',
                overflowWrap: 'break-word',
                // backgroundImage y no background: al cambiar el atajo, React
                // borra el backgroundClip y el nombre quedaba como un bloque blanco.
                backgroundImage: logoUrl
                  ? 'linear-gradient(180deg, #ffffff 0%, #e2e8f0 55%, #94a3b8 100%)'
                  : `linear-gradient(180deg, #fde68a 0%, ${c1} 60%, ${c2} 100%)`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.6))',
              }}
            >
              {nombre}
            </p>
            <p style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.65)', marginTop: 4, letterSpacing: '0.02em' }}>
              {etiqueta}
            </p>
          </div>
        </div>

        {children && <div style={{ position: 'relative', marginTop: 14 }}>{children}</div>}
      </div>
    </div>
  );
}

/** Bandera a cuadros de la esquina (detalle de carreras). */
function Cuadros() {
  const filas = 4;
  const cols = 9;
  const t = 7;
  return (
    <svg
      aria-hidden
      width={cols * t}
      height={filas * t}
      style={{
        position: 'absolute',
        right: 0,
        bottom: 0,
        opacity: 0.35,
        pointerEvents: 'none',
        maskImage: 'linear-gradient(90deg, transparent, #000 60%)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 60%)',
      }}
    >
      {Array.from({ length: filas * cols }, (_, n) => {
        const f = Math.floor(n / cols);
        const c = n % cols;
        return (f + c) % 2 === 0 ? <rect key={n} x={c * t} y={f * t} width={t} height={t} fill="#fff" /> : null;
      })}
    </svg>
  );
}
