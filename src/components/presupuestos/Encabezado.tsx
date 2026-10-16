import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/** Título con flecha para volver, en las pantallas del presupuesto suelto. */
export default function Encabezado({ titulo, volver = '/admin' }: { titulo: string; volver?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <Link
        href={volver}
        aria-label="Volver"
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface-2)',
          color: 'var(--color-text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <ArrowLeft size={18} />
      </Link>
      <h1 style={{ fontSize: 20, fontWeight: 800 }}>{titulo}</h1>
    </div>
  );
}
