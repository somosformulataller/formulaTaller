'use client';

import Button from '@/components/ui/Button';

/** Debajo de la lista de órdenes: «Ver más», cargando o el error con reintento. */
export default function ListaPie({
  hayMas,
  cargando,
  error,
  onVerMas,
  onReintentar,
}: {
  hayMas: boolean;
  cargando: boolean;
  error: string | null;
  onVerMas: () => void;
  onReintentar: () => void;
}) {
  if (error) {
    return (
      <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        <p style={{ marginBottom: 8 }}>{error}</p>
        <Button variant="secondary" size="sm" onClick={onReintentar}>
          Reintentar
        </Button>
      </div>
    );
  }
  if (!hayMas && !cargando) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
      <Button variant="secondary" size="sm" onClick={onVerMas} loading={cargando} disabled={cargando}>
        {cargando ? 'Cargando…' : 'Ver más órdenes'}
      </Button>
    </div>
  );
}
