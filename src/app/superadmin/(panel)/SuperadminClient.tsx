'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { WorkshopAdminRow } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import PhoneInput from '@/components/ui/PhoneInput';
import {
  Building2,
  Star,
  ClipboardList,
  LogOut,
  Search,
  Save,
  SlidersHorizontal,
  Phone,
  Plus,
  Trash2,
  Mail,
  KeyRound,
  Send,
  Copy,
  Check,
  ChevronDown,
  IdCard,
} from 'lucide-react';

// Para armar el enlace de acceso propio de cada taller (/login/su-slug).
const sitio = process.env.NEXT_PUBLIC_SITE_URL || 'https://formulataller.com';

interface SuperadminClientProps {
  rows: WorkshopAdminRow[];
  adminEmail: string | null;
  freeOrderLimit: number;
  supportPhones: string[];
}

export default function SuperadminClient({
  rows: initialRows,
  adminEmail,
  freeOrderLimit,
  supportPhones,
}: SuperadminClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<WorkshopAdminRow[]>(initialRows);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Qué fichas de registro están abiertas. Cerradas por defecto: la lista sirve
  // para barrer muchos talleres de un vistazo, y la ficha es para mirar uno.
  const [fichaAbierta, setFichaAbierta] = useState<Record<string, boolean>>({});
  const [copiado, setCopiado] = useState<string | null>(null);

  async function copiar(texto: string, clave: string) {
    try {
      await navigator.clipboard?.writeText(texto);
      setCopiado(clave);
      setTimeout(() => setCopiado((c) => (c === clave ? null : c)), 1500);
    } catch {
      /* si el navegador no deja copiar, el texto igual está a la vista */
    }
  }

  // Límite global del plan gratuito (aplicado) + valor del input.
  const [globalLimit, setGlobalLimit] = useState<number>(freeOrderLimit);
  const [globalInput, setGlobalInput] = useState<string>(String(freeOrderLimit));
  const [savingGlobal, setSavingGlobal] = useState(false);

  // Override por taller como texto editable ('' = usar el global).
  const [overrides, setOverrides] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialRows.map((r) => [r.id, r.order_limit == null ? '' : String(r.order_limit)])
    )
  );

  // Números de atención al cliente (lista editable con id estable por fila para
  // que borrar/reordenar no confunda los campos).
  const phoneKey = useRef(0);
  const [phoneDraft, setPhoneDraft] = useState<{ id: number; value: string }[]>(() =>
    (supportPhones.length ? supportPhones : ['']).map((value) => ({
      id: phoneKey.current++,
      value,
    }))
  );
  const [savingPhones, setSavingPhones] = useState(false);

  // Restablecimiento de contraseña por taller.
  const [resetting, setResetting] = useState<{ id: string; mode: 'email' | 'temp' } | null>(null);
  const [resetResult, setResetResult] = useState<
    Record<string, { kind: 'email' | 'temp'; email: string; password?: string }>
  >({});

  const metrics = useMemo(() => {
    // Los talleres de prueba (etiqueta Test) no cuentan en el total.
    const real = rows.filter((r) => !r.is_test);
    const total = real.length;
    const subscribed = real.filter((r) => r.is_subscribed).length;
    const orders = real.reduce((sum, r) => sum + r.order_count, 0);
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

  async function saveGlobal() {
    const n = parseInt(globalInput, 10);
    if (isNaN(n) || n < 0) {
      alert('El límite debe ser un número entero mayor o igual a 0.');
      return;
    }
    setSavingGlobal(true);
    try {
      const res = await fetch('/api/superadmin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ free_order_limit: n }),
      });
      if (res.ok) {
        const data = await res.json();
        setGlobalLimit(data.free_order_limit);
        setGlobalInput(String(data.free_order_limit));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'No se pudo guardar el límite global.');
      }
    } catch {
      alert('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSavingGlobal(false);
    }
  }

  async function savePhones() {
    const cleaned = phoneDraft.map((p) => p.value.trim()).filter((p) => p.length > 0);
    setSavingPhones(true);
    try {
      const res = await fetch('/api/superadmin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ support_phones: cleaned }),
      });
      if (res.ok) {
        const data = await res.json();
        const saved: string[] = data.support_phones ?? cleaned;
        setPhoneDraft((saved.length ? saved : ['']).map((value) => ({ id: phoneKey.current++, value })));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'No se pudieron guardar los números.');
      }
    } catch {
      alert('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSavingPhones(false);
    }
  }

  async function toggleSubscription(row: WorkshopAdminRow) {
    const next = !row.is_subscribed;
    setSavingId(row.id);
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_subscribed: next } : r)));

    try {
      const res = await fetch(`/api/superadmin/workshops/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_subscribed: next }),
      });
      if (!res.ok) {
        // Revierte el interruptor al valor real: no se guardó nada.
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_subscribed: !next } : r)));
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'No se pudo actualizar la suscripción.');
      }
    } catch {
      // Fallo de red: el fetch lanza y nunca llegó al servidor. Sin este
      // rollback el interruptor quedaría mostrando un cambio que no ocurrió.
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_subscribed: !next } : r)));
      alert('No se pudo conectar. El cambio no se guardó.');
    } finally {
      setSavingId(null);
    }
  }

  async function toggleTest(row: WorkshopAdminRow) {
    const next = !row.is_test;
    setSavingId(row.id);
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_test: next } : r)));

    try {
      const res = await fetch(`/api/superadmin/workshops/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_test: next }),
      });
      if (!res.ok) {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_test: !next } : r)));
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'No se pudo actualizar la etiqueta de prueba.');
      }
    } catch {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_test: !next } : r)));
      alert('No se pudo conectar. El cambio no se guardó.');
    } finally {
      setSavingId(null);
    }
  }

  async function saveOverride(row: WorkshopAdminRow) {
    const raw = (overrides[row.id] ?? '').trim();
    let value: number | null;
    if (raw === '') {
      value = null;
    } else {
      const n = parseInt(raw, 10);
      if (isNaN(n) || n < 0) {
        alert('El límite debe ser un número entero mayor o igual a 0 (o vacío para usar el global).');
        return;
      }
      value = n;
    }

    setSavingId(row.id);
    try {
      const res = await fetch(`/api/superadmin/workshops/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_limit: value }),
      });
      if (res.ok) {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, order_limit: value } : r)));
        setOverrides((prev) => ({ ...prev, [row.id]: value == null ? '' : String(value) }));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'No se pudo actualizar el límite del taller.');
      }
    } catch {
      alert('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSavingId(null);
    }
  }

  async function resetPassword(row: WorkshopAdminRow, mode: 'email' | 'temp') {
    if (
      mode === 'temp' &&
      !confirm(
        `¿Generar una nueva contraseña temporal para ${row.owner_email}? La contraseña actual dejará de funcionar.`
      )
    ) {
      return;
    }
    setResetting({ id: row.id, mode });
    try {
      const res = await fetch(`/api/superadmin/workshops/${row.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'No se pudo restablecer la contraseña.');
        return;
      }
      setResetResult((prev) => ({
        ...prev,
        [row.id]:
          mode === 'email'
            ? { kind: 'email', email: data.email }
            : { kind: 'temp', email: data.email, password: data.password },
      }));
      // La contraseña temporal no debe quedarse en pantalla (ni en memoria del
      // navegador) indefinidamente: se borra sola a los 90 s. Antes de eso, el
      // superadmin la copia; también puede ocultarla a mano con el botón.
      if (mode === 'temp') {
        setTimeout(() => clearResetResult(row.id), 90_000);
      }
    } catch {
      alert('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setResetting(null);
    }
  }

  function clearResetResult(id: string) {
    setResetResult((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } finally {
      router.replace('/superadmin/login');
    }
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
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}
      >
        <MetricCard icon={<Building2 size={18} />} label="Talleres" value={metrics.total} />
        <MetricCard icon={<Star size={18} />} label="Suscritos" value={metrics.subscribed} />
        <MetricCard icon={<ClipboardList size={18} />} label="Órdenes" value={metrics.orders} />
      </div>

      {/* Límite global del plan gratuito */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <SlidersHorizontal size={16} color="var(--color-brand-400)" />
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Límite del plan gratuito</h2>
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
          Órdenes máximas para talleres no suscritos. Aplica a todos los talleres que no tengan un
          límite propio.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="number"
            min={0}
            className="form-input"
            value={globalInput}
            onChange={(e) => setGlobalInput(e.target.value)}
            style={{ width: 120 }}
          />
          <button
            onClick={saveGlobal}
            disabled={savingGlobal || globalInput.trim() === String(globalLimit)}
            style={primaryBtn(savingGlobal || globalInput.trim() === String(globalLimit))}
          >
            <Save size={14} />
            Guardar
          </button>
        </div>
      </div>

      {/* Números de atención al cliente */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Phone size={16} color="var(--color-brand-400)" />
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Números de atención al cliente</h2>
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
          Aparecen en el mensaje del límite gratuito para que el taller escriba y pague la
          suscripción. Usa formato internacional (ej. <b>+58 424 234 9786</b>) para que el enlace de
          WhatsApp abra bien.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {phoneDraft.map((item) => (
            <div key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <PhoneInput
                  value={item.value}
                  onChange={(v) =>
                    setPhoneDraft((prev) =>
                      prev.map((p) => (p.id === item.id ? { ...p, value: v } : p))
                    )
                  }
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  setPhoneDraft((prev) => {
                    const next = prev.filter((p) => p.id !== item.id);
                    return next.length ? next : [{ id: phoneKey.current++, value: '' }];
                  })
                }
                aria-label="Eliminar número"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 42,
                  height: 42,
                  flexShrink: 0,
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 8,
                  color: '#f87171',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setPhoneDraft((prev) => [...prev, { id: phoneKey.current++, value: '' }])}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <Plus size={14} />
            Agregar número
          </button>
          <button onClick={savePhones} disabled={savingPhones} style={primaryBtn(savingPhones)}>
            <Save size={14} />
            Guardar números
          </button>
        </div>
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
          {filtered.map((row) => {
            const stored = row.order_limit == null ? '' : String(row.order_limit);
            const current = overrides[row.id] ?? '';
            const changed = current.trim() !== stored;
            const busy = savingId === row.id;
            const effectiveLimit = row.order_limit ?? globalLimit;
            const result = resetResult[row.id];
            const resettingEmail = resetting?.id === row.id && resetting.mode === 'email';
            const resettingTemp = resetting?.id === row.id && resetting.mode === 'temp';
            return (
              <div key={row.id} className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
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
                      {row.is_test && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: 'var(--color-text-secondary)',
                            background: 'var(--color-surface-3)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 999,
                            padding: '2px 8px',
                            flexShrink: 0,
                          }}
                        >
                          TEST
                        </span>
                      )}
                    </div>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 3 }}>
                      {row.owner_name ? `${row.owner_name} · ` : ''}
                      {row.is_subscribed
                        ? `${row.order_count} órdenes`
                        : `${row.order_count} / ${effectiveLimit} órdenes`}{' '}
                      · {formatDate(row.created_at)}
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                        Suscrito
                      </span>
                      <Toggle
                        checked={row.is_subscribed}
                        disabled={busy}
                        onChange={() => toggleSubscription(row)}
                        label="Suscrito"
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                        Test
                      </span>
                      <Toggle
                        checked={row.is_test}
                        disabled={busy}
                        onChange={() => toggleTest(row)}
                        label="Test"
                      />
                    </div>
                  </div>
                </div>

                <Link
                  href={`/superadmin/talleres/${row.id}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--color-brand-400)',
                    textDecoration: 'none',
                  }}
                >
                  Ver detalle (órdenes y mecánicos) →
                </Link>

                {/* Ficha de registro: todo lo que el taller puso al darse de
                    alta, más lo que la propia cuenta cuenta de sí misma. */}
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() =>
                      setFichaAbierta((prev) => ({ ...prev, [row.id]: !prev[row.id] }))
                    }
                    aria-expanded={!!fichaAbierta[row.id]}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    <IdCard size={13} />
                    Datos de registro
                    <ChevronDown
                      size={14}
                      style={{
                        transition: 'transform 0.15s',
                        transform: fichaAbierta[row.id] ? 'rotate(180deg)' : 'none',
                      }}
                    />
                  </button>

                  {fichaAbierta[row.id] && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: '12px 14px',
                        background: 'var(--color-surface-2)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                      }}
                    >
                      <Bloque titulo="El taller">
                        <Dato etiqueta="Nombre" valor={row.name} />
                        <Dato
                          etiqueta="Su enlace de acceso"
                          valor={`${sitio}/login/${row.slug}`}
                          alCopiar={() => copiar(`${sitio}/login/${row.slug}`, `link-${row.id}`)}
                          copiado={copiado === `link-${row.id}`}
                        />
                        <Dato
                          etiqueta="WhatsApp del taller"
                          valor={row.whatsapp}
                          alCopiar={row.whatsapp ? () => copiar(row.whatsapp!, `wa-${row.id}`) : undefined}
                          copiado={copiado === `wa-${row.id}`}
                        />
                        <Dato etiqueta="Se registró el" valor={formatDate(row.created_at)} />
                        <Dato etiqueta="Logo" valor={row.has_logo ? 'Sí, ya lo subió' : 'Todavía no subió'} />
                      </Bloque>

                      <Bloque titulo="Quien lo registró">
                        <Dato etiqueta="Nombre y apellido" valor={row.owner_name} />
                        <Dato
                          etiqueta="Correo"
                          valor={row.owner_email}
                          alCopiar={row.owner_email ? () => copiar(row.owner_email!, `mail-${row.id}`) : undefined}
                          copiado={copiado === `mail-${row.id}`}
                        />
                        <Dato
                          etiqueta="Correo confirmado"
                          valor={
                            row.owner_email_confirmed_at
                              ? `Sí, el ${formatDate(row.owner_email_confirmed_at)}`
                              : 'No'
                          }
                          alarma={!row.owner_email_confirmed_at}
                        />
                        {/* Al registrarse, el teléfono del perfil es el mismo
                            WhatsApp del taller; solo se enseña si cambió. */}
                        {row.owner_phone && row.owner_phone !== row.whatsapp && (
                          <Dato etiqueta="Su teléfono" valor={row.owner_phone} />
                        )}
                        <Dato
                          etiqueta="Cuenta creada"
                          valor={row.owner_created_at ? formatDate(row.owner_created_at) : null}
                        />
                        <Dato
                          etiqueta="Última vez que entró"
                          // Un taller que nunca entró no es un cliente todavía:
                          // es un formulario a medio llenar. Se marca en rojo.
                          valor={
                            row.owner_last_sign_in_at
                              ? formatDate(row.owner_last_sign_in_at)
                              : 'Nunca ha entrado'
                          }
                          alarma={!row.owner_last_sign_in_at}
                        />
                      </Bloque>

                      <Bloque titulo="Cómo lo está usando">
                        <Dato etiqueta="Órdenes creadas" valor={String(row.order_count)} />
                        <Dato
                          etiqueta="Mecánicos"
                          valor={
                            row.mechanic_count === 0
                              ? 'Ninguno todavía'
                              : `${row.mechanic_count} (sin contar al dueño)`
                          }
                        />
                        <Dato
                          etiqueta="Plan"
                          valor={
                            row.is_subscribed
                              ? 'Suscrito (órdenes ilimitadas)'
                              : `Gratuito · ${effectiveLimit} órdenes${
                                  row.order_limit == null ? ' (límite global)' : ' (límite propio)'
                                }`
                          }
                        />
                        {row.is_test && <Dato etiqueta="Marcado como" valor="Taller de prueba" />}
                      </Bloque>
                    </div>
                  )}
                </div>

                {/* Editor del límite (solo si no está suscrito) */}
                {row.is_subscribed ? (
                  <p style={{ fontSize: 12, color: 'var(--color-brand-400)', marginTop: 10, fontWeight: 600 }}>
                    Órdenes ilimitadas (suscrito)
                  </p>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: '1px solid var(--color-border)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                      Límite:
                    </span>
                    <input
                      type="number"
                      min={0}
                      className="form-input"
                      placeholder={`global (${globalLimit})`}
                      value={current}
                      onChange={(e) => setOverrides((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      style={{ width: 130 }}
                    />
                    <button
                      onClick={() => saveOverride(row)}
                      disabled={busy || !changed}
                      style={primaryBtn(busy || !changed)}
                    >
                      <Save size={13} />
                      Guardar
                    </button>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {current.trim() === '' ? `usa el global (${globalLimit})` : 'límite propio'}
                    </span>
                  </div>
                )}

                {/* Datos de contacto + acceso */}
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    <Mail size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.owner_email ?? 'Sin correo registrado'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    <Phone size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                    <span>{row.whatsapp ? row.whatsapp : 'Sin teléfono'}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={() => resetPassword(row, 'email')}
                      disabled={!row.owner_email || resettingEmail || resettingTemp}
                      style={smallBtn(!row.owner_email || resettingEmail || resettingTemp)}
                    >
                      <Send size={13} />
                      {resettingEmail ? 'Enviando...' : 'Enviar enlace por correo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => resetPassword(row, 'temp')}
                      disabled={!row.owner_email || resettingEmail || resettingTemp}
                      style={smallBtn(!row.owner_email || resettingEmail || resettingTemp)}
                    >
                      <KeyRound size={13} />
                      {resettingTemp ? 'Generando...' : 'Contraseña temporal'}
                    </button>
                  </div>

                  {result?.kind === 'email' && (
                    <p style={{ fontSize: 12, color: '#34d399', marginTop: 2 }}>
                      Enlace de restablecimiento enviado a {result.email}.
                    </p>
                  )}
                  {result?.kind === 'temp' && result.password && (
                    <div
                      style={{
                        marginTop: 4,
                        padding: '10px 12px',
                        background: 'var(--color-surface-2)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    >
                      <p style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>
                        Nueva contraseña temporal (compártela con el taller):
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <code style={{ fontWeight: 700, fontSize: 14 }}>{result.password}</code>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard?.writeText(result.password!)}
                          aria-label="Copiar contraseña"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 8px',
                            background: 'var(--color-surface-3)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 6,
                            color: 'var(--color-text-secondary)',
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                        >
                          <Copy size={12} />
                          Copiar
                        </button>
                        <button
                          type="button"
                          onClick={() => clearResetResult(row.id)}
                          aria-label="Ocultar contraseña"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 8px',
                            background: 'var(--color-surface-3)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 6,
                            color: 'var(--color-text-secondary)',
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                        >
                          Ocultar
                        </button>
                      </div>
                      <p style={{ color: 'var(--color-text-muted)', marginTop: 6, fontSize: 11 }}>
                        Se ocultará sola en 90 s. Cópiala y compártela ahora.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function smallBtn(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 12px',
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    background: disabled ? 'var(--color-surface-3)' : 'var(--color-brand-500)',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    color: disabled ? 'var(--color-text-muted)' : '#0D0F1A',
    cursor: disabled ? 'default' : 'pointer',
    flexShrink: 0,
  };
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

/**
 * Un grupo de la ficha de registro ("El taller", "Quien lo registró", …).
 * La ficha se lee de arriba abajo, así que los datos van en filas de
 * etiqueta + valor y no en columnas, que en el teléfono se parten.
 */
function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          marginBottom: 6,
        }}
      >
        {titulo}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
    </div>
  );
}

/**
 * Una línea de la ficha. `alarma` la pinta en rojo: se usa para lo que pide
 * actuar (un correo sin confirmar, un taller que nunca entró), no para
 * cualquier dato ausente.
 */
function Dato({
  etiqueta,
  valor,
  alCopiar,
  copiado,
  alarma,
}: {
  etiqueta: string;
  valor: string | null | undefined;
  alCopiar?: () => void;
  copiado?: boolean;
  alarma?: boolean;
}) {
  const vacio = valor === null || valor === undefined || valor === '';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
      <span style={{ color: 'var(--color-text-muted)', minWidth: 130, flexShrink: 0 }}>
        {etiqueta}
      </span>
      <span
        style={{
          color: vacio
            ? 'var(--color-text-muted)'
            : alarma
            ? '#f87171'
            : 'var(--color-text-primary)',
          fontWeight: vacio ? 400 : 600,
          overflowWrap: 'anywhere',
          minWidth: 0,
        }}
      >
        {vacio ? 'Sin dato' : valor}
      </span>
      {!vacio && alCopiar && (
        <button
          type="button"
          onClick={alCopiar}
          aria-label={`Copiar ${etiqueta}`}
          title={`Copiar ${etiqueta}`}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: copiado ? '#34d399' : 'var(--color-text-muted)',
            flexShrink: 0,
            lineHeight: 0,
          }}
        >
          {copiado ? <Check size={13} /> : <Copy size={13} />}
        </button>
      )}
    </div>
  );
}
