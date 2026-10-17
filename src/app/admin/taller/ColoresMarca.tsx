'use client';

import { useState } from 'react';
import { Palette, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';
import CabeceraTaller, { MARCA_FT } from '@/components/tracking/CabeceraTaller';
import { coloresDelLogo } from '@/lib/colores-logo';

export interface Colores {
  c1: string | null;
  c2: string | null;
}

/** Guarda los colores de la marca del taller (0031). */
export async function guardarColores(workshopId: string, c: Colores): Promise<void> {
  const res = await fetch(`/api/workshops/${workshopId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brand_color: c.c1, brand_color_2: c.c2 }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || 'No se pudieron guardar los colores.');
  }
}

/**
 * «Colores de tu marca» en el Perfil del Taller: vista previa de la cabecera
 * que ve el cliente, con los colores detectados del logo y para cambiarlos.
 */
export default function ColoresMarca({
  workshopId,
  nombre,
  logoUrl,
  colores,
  onColores,
  aviso,
}: {
  workshopId: string;
  nombre: string;
  logoUrl: string | null;
  colores: Colores;
  onColores: (c: Colores) => void;
  /** Mensaje tras detectar los colores al subir el logo. */
  aviso?: string | null;
}) {
  const [borrador, setBorrador] = useState<Colores>(colores);
  const [estado, setEstado] = useState<'' | 'guardando' | 'detectando'>('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visto, setVisto] = useState(colores);

  // Si los colores cambian desde fuera (al subir un logo), el borrador los sigue.
  if (visto !== colores) {
    setVisto(colores);
    setBorrador(colores);
  }

  const cambiado = borrador.c1 !== colores.c1 || borrador.c2 !== colores.c2;

  async function guardar(c: Colores, texto: string) {
    setError(null);
    setMensaje(null);
    setEstado('guardando');
    try {
      await guardarColores(workshopId, c);
      onColores(c);
      setMensaje(texto);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron guardar los colores.');
    } finally {
      setEstado('');
    }
  }

  async function detectar() {
    if (!logoUrl) return;
    setError(null);
    setMensaje(null);
    setEstado('detectando');
    try {
      const blob = await (await fetch(logoUrl)).blob();
      const c = await coloresDelLogo(blob);
      if (!c) {
        setError('Tu logo no tiene colores claros (es blanco y negro). Elige los colores a mano.');
        return;
      }
      setBorrador({ c1: c.c1, c2: c.c2 });
    } catch {
      setError('No se pudo leer el logo.');
    } finally {
      setEstado('');
    }
  }

  return (
    <div className="card" style={{ padding: 24, marginBottom: 16 }}>
      <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
        <Palette size={15} style={{ color: 'var(--color-brand-400)' }} />
        Colores de tu marca
      </p>
      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
        Así ven tus clientes la cabecera del seguimiento y del presupuesto.
        {logoUrl ? ' Los colores salen de tu logo; puedes cambiarlos.' : ' Sube tu logo para usar sus colores.'}
      </p>

      <CabeceraTaller
        nombre={nombre || 'Tu taller'}
        logoUrl={logoUrl}
        color={borrador.c1}
        color2={borrador.c2}
        etiqueta="Seguimiento de servicio"
      />

      {aviso && !cambiado && <p style={{ fontSize: 12.5, color: '#34d399', marginBottom: 10 }}>{aviso}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <SelectorColor
          etiqueta="Color principal"
          valor={borrador.c1 ?? MARCA_FT.c1}
          onChange={(v) => setBorrador((b) => ({ ...b, c1: v }))}
        />
        <SelectorColor
          etiqueta="Color secundario"
          valor={borrador.c2 ?? borrador.c1 ?? MARCA_FT.c2}
          onChange={(v) => setBorrador((b) => ({ ...b, c2: v }))}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cambiado && (
          <Button
            variant="primary"
            fullWidth
            loading={estado === 'guardando'}
            disabled={estado !== ''}
            onClick={() => guardar(borrador, 'Colores guardados.')}
          >
            Guardar colores
          </Button>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: logoUrl ? '1fr 1fr' : '1fr', gap: 8 }}>
          {logoUrl && (
            <Button variant="secondary" size="sm" disabled={estado !== ''} loading={estado === 'detectando'} onClick={detectar}>
              <Sparkles size={14} />
              Detectar del logo
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={estado !== '' || (colores.c1 === null && colores.c2 === null && !cambiado)}
            onClick={() => guardar({ c1: null, c2: null }, 'Volviste a los colores de Formula Taller.')}
          >
            Colores de Formula Taller
          </Button>
        </div>
      </div>
      {mensaje && <p style={{ fontSize: 12.5, color: '#34d399', marginTop: 10 }}>{mensaje}</p>}
      {error && <p style={{ fontSize: 12.5, color: 'var(--color-danger)', marginTop: 10 }}>{error}</p>}
    </div>
  );
}

function SelectorColor({ etiqueta, valor, onChange }: { etiqueta: string; valor: string; onChange: (v: string) => void }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 10,
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface-2)',
        cursor: 'pointer',
      }}
    >
      <input
        type="color"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 34, height: 34, border: 'none', padding: 0, background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
      />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 700 }}>{etiqueta}</span>
        <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{valor}</span>
      </span>
    </label>
  );
}
