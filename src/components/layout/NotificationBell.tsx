'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Bell, CalendarDays, MessageCircle, Receipt, X } from 'lucide-react';
import type { AppNotification, Reminder } from '@/lib/types';
import { formatDia } from '@/lib/recordatorios';
import EnviarRecordatorioModal from '@/components/reminders/EnviarRecordatorioModal';
import { formatDate } from '@/lib/utils';

const CADA_MS = 60_000;

/**
 * La campana del administrador: respuestas de los clientes al presupuesto y
 * recordatorios que ya toca enviar. Se consulta cada minuto mientras la
 * pestaña está visible.
 */
export default function NotificationBell({ workshopName }: { workshopName: string }) {
  const [abierto, setAbierto] = useState(false);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [sinLeer, setSinLeer] = useState(0);
  const [recordatorios, setRecordatorios] = useState<Reminder[]>([]);
  const [montado, setMontado] = useState(false);
  const [enviando, setEnviando] = useState<Reminder | null>(null);
  const vivo = useRef(true);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (!res.ok || !vivo.current) return;
      const data = await res.json();
      setNotifs(data.notifications ?? []);
      setSinLeer(data.unread_count ?? 0);
      setRecordatorios(data.due_reminders ?? []);
    } catch {
      /* sin conexión: se reintenta en el próximo ciclo */
    }
  }, []);

  useEffect(() => {
    vivo.current = true;
    setMontado(true);
    cargar();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') cargar();
    }, CADA_MS);
    const alVolver = () => document.visibilityState === 'visible' && cargar();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vivo.current = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [cargar]);

  async function marcarLeidas(body: Record<string, unknown>) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    cargar();
  }

  // El mensaje lo redacta la IA y el taller lo revisa antes de enviarlo.
  function enviar(r: Reminder) {
    if (!r.client?.whatsapp) {
      alert('Este cliente no tiene un WhatsApp válido.');
      return;
    }
    setAbierto(false);
    setEnviando(r);
  }

  async function marcarEnviado(r: Reminder) {
    await fetch(`/api/reminders/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'enviado' }),
    }).catch(() => null);
    setRecordatorios((prev) => prev.filter((x) => x.id !== r.id));
  }

  const total = sinLeer + recordatorios.length;

  return (
    <>
      {enviando && (
        <EnviarRecordatorioModal
          reminder={enviando}
          workshopName={workshopName}
          onClose={() => setEnviando(null)}
          onEnviado={() => marcarEnviado(enviando)}
        />
      )}
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={`Notificaciones${total ? `: ${total} nuevas` : ''}`}
        title="Notificaciones"
        style={{
          position: 'relative',
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: '6px 8px',
          color: total ? 'var(--color-brand-400)' : 'var(--color-text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Bell size={16} />
        {total > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              minWidth: 18,
              height: 18,
              padding: '0 4px',
              borderRadius: 999,
              background: '#ef4444',
              color: '#fff',
              fontSize: 10.5,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--color-bg)',
            }}
          >
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {abierto &&
        montado &&
        createPortal(
          <div
            onClick={(e) => e.target === e.currentTarget && setAbierto(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 100,
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <div
              style={{
                width: 'min(420px, 100%)',
                height: '100%',
                background: 'var(--color-bg)',
                borderLeft: '1px solid var(--color-border)',
                overflowY: 'auto',
                padding: '16px 16px calc(24px + env(safe-area-inset-bottom))',
                paddingTop: 'calc(16px + env(safe-area-inset-top))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800 }}>Notificaciones</h2>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  aria-label="Cerrar"
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <Seccion icono={<CalendarDays size={14} />} titulo="Recordatorios para enviar">
                {recordatorios.length === 0 && <Vacio texto="No hay recordatorios pendientes de enviar." />}
                {recordatorios.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface-2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <p style={{ fontSize: 14, fontWeight: 700 }}>{r.title}</p>
                    <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                      {r.client ? `${r.client.first_name} ${r.client.last_name}` : ''} · {formatDia(r.due_date)}
                    </p>
                    <button
                      type="button"
                      onClick={() => enviar(r)}
                      style={{
                        alignSelf: 'flex-start',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '7px 12px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#25D366',
                        color: '#08130b',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <MessageCircle size={14} />
                      Enviar por WhatsApp
                    </button>
                  </div>
                ))}
                <Link
                  href="/admin/recordatorios"
                  onClick={() => setAbierto(false)}
                  style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-brand-400)' }}
                >
                  Ver el calendario
                </Link>
              </Seccion>

              <Seccion
                icono={<Receipt size={14} />}
                titulo="Respuestas al presupuesto"
                accion={
                  sinLeer > 0 ? (
                    <button
                      type="button"
                      onClick={() => marcarLeidas({ all: true })}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--color-brand-400)',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Marcar todo como leído
                    </button>
                  ) : null
                }
              >
                {notifs.length === 0 && <Vacio texto="Aquí verás las respuestas de tus clientes al presupuesto y el estado de tus recargas de saldo." />}
                {notifs.map((n) => (
                  <Link
                    key={n.id}
                    href={n.order_id ? `/admin/ordenes/${n.order_id}` : n.kind === 'saldo' ? '/admin/saldo' : '#'}
                    onClick={() => {
                      if (!n.read_at) marcarLeidas({ ids: [n.id] });
                      setAbierto(false);
                    }}
                    style={{
                      display: 'block',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${n.read_at ? 'var(--color-border)' : 'rgba(245,158,11,0.4)'}`,
                      background: n.read_at ? 'transparent' : 'rgba(245,158,11,0.08)',
                      color: 'inherit',
                      textDecoration: 'none',
                    }}
                  >
                    <p style={{ fontSize: 13.5, fontWeight: n.read_at ? 500 : 700 }}>{n.message}</p>
                    <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 3 }}>{formatDate(n.created_at)}</p>
                  </Link>
                ))}
              </Seccion>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function Seccion({
  icono,
  titulo,
  accion,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          {icono}
          {titulo}
        </h3>
        {accion}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </section>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>{texto}</p>;
}
