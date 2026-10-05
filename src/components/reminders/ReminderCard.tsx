'use client';

import { useState } from 'react';
import { Bell, CalendarDays, Check, Edit2, FileText, MessageCircle, Trash2, User } from 'lucide-react';
import type { Reminder } from '@/lib/types';
import { TAG_COLOR_HEX, formatDia, notifyLabel, mensajeRecordatorio, hoyVE } from '@/lib/recordatorios';
import { waLink } from '@/lib/whatsapp';

/**
 * Un recordatorio: etiqueta, fecha, aviso, texto, nota de voz (con su texto a
 * un toque), imagen y las acciones. «Enviar por WhatsApp» abre el chat del
 * cliente con el mensaje ya escrito y lo marca como enviado.
 */
export default function ReminderCard({
  reminder,
  workshopName,
  mostrarCliente = false,
  onChanged,
  onDeleted,
  onEdit,
}: {
  reminder: Reminder;
  workshopName: string;
  mostrarCliente?: boolean;
  onChanged: (r: Reminder) => void;
  onDeleted: (id: string) => void;
  onEdit?: (r: Reminder) => void;
}) {
  const [verTexto, setVerTexto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const r = reminder;
  const color = r.tag ? TAG_COLOR_HEX[r.tag.color] ?? TAG_COLOR_HEX.neutral : 'var(--color-border)';
  const nombre = r.client ? `${r.client.first_name} ${r.client.last_name}`.trim() : '';
  const hoy = hoyVE();
  const tocaAvisar = r.status === 'pendiente' && r.notify_on <= hoy;
  const vencido = r.status !== 'hecho' && r.due_date < hoy;

  async function cambiarEstado(status: Reminder['status']) {
    setOcupado(true);
    try {
      const res = await fetch(`/api/reminders/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) onChanged(await res.json());
    } finally {
      setOcupado(false);
    }
  }

  function enviarWhatsApp() {
    const texto = mensajeRecordatorio({
      nombreCliente: r.client?.first_name ?? '',
      taller: workshopName,
      titulo: r.title,
      texto: r.body || r.transcript,
      fecha: r.due_date,
    });
    const link = waLink(r.client?.whatsapp, texto);
    if (!link) {
      alert('Este cliente no tiene un WhatsApp válido.');
      return;
    }
    window.open(link, '_blank', 'noopener');
    if (r.status === 'pendiente') cambiarEstado('enviado');
  }

  async function borrar() {
    if (!confirm(`¿Eliminar el recordatorio «${r.title}»?`)) return;
    setOcupado(true);
    const res = await fetch(`/api/reminders/${r.id}`, { method: 'DELETE' });
    setOcupado(false);
    if (res.ok) onDeleted(r.id);
    else alert('No se pudo eliminar el recordatorio.');
  }

  const accion = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 10px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  } as const;

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        boxShadow: `inset 4px 0 0 ${color}`,
        borderRadius: 10,
        padding: '12px 12px 12px 16px',
        background: 'var(--color-surface-2)',
        opacity: r.status === 'hecho' ? 0.6 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          {r.tag && (
            <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {r.tag.label}
            </span>
          )}
          <p
            style={{
              fontSize: 14.5,
              fontWeight: 700,
              textDecoration: r.status === 'hecho' ? 'line-through' : 'none',
              overflowWrap: 'anywhere',
            }}
          >
            {r.title}
          </p>
          {mostrarCliente && nombre && (
            <p style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              <User size={12} />
              {nombre}
            </p>
          )}
        </div>
        <span
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 999,
            background:
              r.status === 'hecho'
                ? 'rgba(16,185,129,0.15)'
                : r.status === 'enviado'
                ? 'rgba(59,130,246,0.15)'
                : tocaAvisar
                ? 'rgba(245,158,11,0.18)'
                : 'var(--color-surface)',
            color:
              r.status === 'hecho'
                ? '#34d399'
                : r.status === 'enviado'
                ? '#60a5fa'
                : tocaAvisar
                ? '#fbbf24'
                : 'var(--color-text-muted)',
          }}
        >
          {r.status === 'hecho' ? 'Hecho' : r.status === 'enviado' ? 'Enviado' : tocaAvisar ? 'Toca avisar' : 'Programado'}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: vencido ? '#f87171' : undefined }}>
          <CalendarDays size={13} />
          {formatDia(r.due_date)}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Bell size={13} />
          {notifyLabel(r.notify_offset)}
        </span>
      </div>

      {r.body && <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.body}</p>}

      {r.audio_url && <audio src={r.audio_url} controls style={{ width: '100%', height: 36 }} />}
      {r.transcript && (
        <div>
          <button
            type="button"
            onClick={() => setVerTexto((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--color-brand-400)',
              cursor: 'pointer',
            }}
          >
            <FileText size={13} />
            {verTexto ? 'Ocultar texto de la nota' : 'Ver texto de la nota de voz'}
          </button>
          {verTexto && (
            <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', marginTop: 6, color: 'var(--color-text-secondary)' }}>
              {r.transcript}
            </p>
          )}
        </div>
      )}

      {r.image_url && (
        <a href={r.image_url} target="_blank" rel="noopener noreferrer" style={{ alignSelf: 'flex-start' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={r.image_url}
            alt="Imagen del recordatorio"
            style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--color-border)' }}
          />
        </a>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
        {r.status !== 'hecho' && (
          <button
            type="button"
            onClick={enviarWhatsApp}
            disabled={ocupado}
            style={{ ...accion, background: '#25D366', borderColor: '#25D366', color: '#08130b' }}
          >
            <MessageCircle size={14} />
            Enviar por WhatsApp
          </button>
        )}
        {r.status !== 'hecho' ? (
          <button type="button" onClick={() => cambiarEstado('hecho')} disabled={ocupado} style={accion}>
            <Check size={14} />
            Marcar hecho
          </button>
        ) : (
          <button type="button" onClick={() => cambiarEstado('pendiente')} disabled={ocupado} style={accion}>
            Reabrir
          </button>
        )}
        {onEdit && (
          <button type="button" onClick={() => onEdit(r)} disabled={ocupado} style={accion} aria-label="Editar">
            <Edit2 size={13} />
          </button>
        )}
        <button
          type="button"
          onClick={borrar}
          disabled={ocupado}
          style={{ ...accion, color: '#ef4444' }}
          aria-label="Eliminar"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
