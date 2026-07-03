'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { WorkshopAdminRow } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { Building2, Star, ClipboardList, LogOut, Search } from 'lucide-react';

interface SuperadminClientProps {
  rows: WorkshopAdminRow[];
  adminEmail: string | null;
}

export default function SuperadminClient({ rows: initialRows, adminEmail }: SuperadminClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<WorkshopAdminRow[]>(initialRows);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const metrics = useMemo(() => {
    const total = rows.length;
    const subscribed = rows.filter((r) => r.is_subscribed).length;
    const orders = rows.reduce((sum, r) => sum + r.order_count, 0);
    return { total, subscribed, orders };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.owner_name ?? '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  async function toggleSubscription(row: WorkshopAdminRow) {
    const next = !row.is_subscribed;
    setSavingId(row.id);
    // Optimista: reflejar el cambio y revertir si el servidor falla.
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_subscribed: next } : r)));

    const res = await fetch(`/api/superadmin/workshops/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_subscribed: next }),
    });
    setSavingId(null);

    if (!res.ok) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_subscribed: !next } : r)));
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'No se pudo actualizar la suscripción.');
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/superadmin/login');
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px 48px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Panel de plataforma</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 2 }}>
            {adminEmail ?? 'Superadministrador'}
          </p>
        </div>
        <button
          onClick={handleLogout}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <LogOut size={14} />
          Salir
        </button>
      </div>

      {/* Métricas */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          marginBottom: 24,
        }}
      >
        <MetricCard icon={<Building2 size={18} />} label="Talleres" value={metrics.total} />
        <MetricCard icon={<Star size={18} />} label="Suscritos" value={metrics.subscribed} />
        <MetricCard icon={<ClipboardList size={18} />} label="Órdenes" value={metrics.orders} />
      </div>

      {/* Buscador */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <Search
          size={15}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-text-muted)',
          }}
        />
        <input
          className="form-input"
          placeholder="Buscar taller o dueño..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: 36 }}
        />
      </div>

      {/* Lista de talleres */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <Building2 size={48} />
          <p>{search ? 'No hay resultados para tu búsqueda' : 'Aún no hay talleres registrados'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((row) => (
            <div
              key={row.id}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 15,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.name}
                  </span>
                  {row.is_subscribed && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--color-brand-400)',
                        background: 'rgba(245,158,11,0.12)',
                        border: '1px solid rgba(245,158,11,0.3)',
                        borderRadius: 999,
                        padding: '2px 8px',
                        flexShrink: 0,
                      }}
                    >
                      PRO
                    </span>
                  )}
                </div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 3 }}>
                  {row.owner_name ? `${row.owner_name} · ` : ''}
                  {row.order_count} {row.order_count === 1 ? 'orden' : 'órdenes'} ·{' '}
                  {formatDate(row.created_at)}
                </p>
              </div>

              {/* Interruptor de suscripción */}
              <Toggle
                checked={row.is_subscribed}
                disabled={savingId === row.id}
                onChange={() => toggleSubscription(row)}
                label="Suscrito"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="card" style={{ padding: '14px 12px', textAlign: 'center' }}>
      <div style={{ color: 'var(--color-brand-400)', display: 'flex', justifyContent: 'center' }}>
        {icon}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      style={{
        position: 'relative',
        width: 46,
        height: 26,
        borderRadius: 999,
        border: 'none',
        flexShrink: 0,
        cursor: disabled ? 'default' : 'pointer',
        background: checked ? 'var(--color-brand-500)' : 'var(--color-surface-3)',
        transition: 'background 0.15s',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 23 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.15s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  );
}
